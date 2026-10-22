import {
  AcousticSoundEffect,
  SynthVoiceSpec,
  StratumAmbientProfile,
} from '../../schemas/audio-synth.schema.js';
import { StratumId } from '../../schemas/primitives.schema.js';
import { STRATUM_AMBIENCE_PROFILES } from './synth-definitions.js';

export class ProceduralWebAudioSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseBuffers: Map<string, AudioBuffer> = new Map();
  private activeDroneOscs: OscillatorNode[] = [];
  private isMuted = false;
  private currentStratum: StratumId | null = null;

  constructor() {
    // Lazily initialized on first user gesture to comply with browser autoplay policies
  }

  public initContext(): boolean {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return true;
    }
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    this.ambientGain.connect(this.masterGain);

    this.prebuildNoiseBuffers();
    return true;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private prebuildNoiseBuffers(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 2; // 2 seconds

    // White noise
    const whiteBuf = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const whiteOut = whiteBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      whiteOut[i] = ((i * 1337) % 2000) / 1000 - 1.0;
    }
    this.noiseBuffers.set('white', whiteBuf);

    // Pink noise
    const pinkBuf = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const pinkOut = pinkBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = ((i * 2749) % 2000) / 1000 - 1.0;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkOut[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    this.noiseBuffers.set('pink', pinkBuf);

    // Brown noise
    const brownBuf = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const brownOut = brownBuf.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = ((i * 3989) % 2000) / 1000 - 1.0;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      brownOut[i] = lastOut * 3.5;
    }
    this.noiseBuffers.set('brown', brownBuf);
  }

  public playSoundEffect(effect: AcousticSoundEffect): void {
    if (this.isMuted) return;
    if (!this.initContext() || !this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    for (const voice of effect.voices) {
      this.renderVoice(voice, effect.masterVolume, now);
    }
  }

  private renderVoice(voice: SynthVoiceSpec, masterVol: number, now: number): void {
    if (!this.ctx || !this.masterGain) return;

    const gainNode = this.ctx.createGain();
    const env = voice.envelope;
    const peakGain = voice.gain * masterVol;
    const sustainGain = peakGain * env.sustainLevel;

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(peakGain, now + Math.max(0.001, env.attackSec));
    gainNode.gain.linearRampToValueAtTime(
      sustainGain,
      now + env.attackSec + Math.max(0.001, env.decaySec),
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      now + env.attackSec + env.decaySec + Math.max(0.001, env.releaseSec),
    );

    let filterNode: BiquadFilterNode | null = null;
    if (voice.filter) {
      filterNode = this.ctx.createBiquadFilter();
      filterNode.type = voice.filter.filterType;
      filterNode.Q.setValueAtTime(voice.filter.resonanceQ, now);
      filterNode.frequency.setValueAtTime(voice.filter.startCutoffHz, now);
      filterNode.frequency.exponentialRampToValueAtTime(
        Math.max(20, voice.filter.endCutoffHz),
        now + voice.filter.sweepDurationSec,
      );
    }

    const outputDest = filterNode ? filterNode : gainNode;
    if (filterNode) {
      filterNode.connect(gainNode);
    }
    gainNode.connect(this.masterGain);

    if (voice.waveform === 'noise') {
      const buf = this.noiseBuffers.get(voice.noiseType ?? 'white');
      if (buf) {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(outputDest);
        src.start(now);
        src.stop(now + env.attackSec + env.decaySec + env.releaseSec + 0.05);
      }
    } else {
      const osc = this.ctx.createOscillator();
      osc.type = voice.waveform;
      osc.frequency.setValueAtTime(voice.pitch.startFreqHz, now);
      if (voice.pitch.curve === 'exponential') {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, voice.pitch.endFreqHz),
          now + voice.pitch.sweepDurationSec,
        );
      } else {
        osc.frequency.linearRampToValueAtTime(
          voice.pitch.endFreqHz,
          now + voice.pitch.sweepDurationSec,
        );
      }
      if (voice.detuneCents) {
        osc.detune.setValueAtTime(voice.detuneCents, now);
      }
      osc.connect(outputDest);
      osc.start(now);
      osc.stop(now + env.attackSec + env.decaySec + env.releaseSec + 0.05);
    }
  }

  public setStratumAmbience(stratum: StratumId): void {
    if (this.currentStratum === stratum) return;
    this.currentStratum = stratum;
    if (!this.initContext() || !this.ctx || !this.ambientGain) return;

    const profile: StratumAmbientProfile | undefined = STRATUM_AMBIENCE_PROFILES[stratum];
    if (!profile) return;

    const now = this.ctx.currentTime;
    for (const osc of this.activeDroneOscs) {
      try {
        osc.stop(now + 0.5);
      } catch {
        // already stopped
      }
    }
    this.activeDroneOscs = [];

    for (const ratio of profile.harmonicRatios) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(profile.rootFreqHz * ratio, now);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.001, now);
      oscGain.gain.linearRampToValueAtTime(profile.droneGain / profile.harmonicRatios.length, now + 1.0);

      osc.connect(oscGain);
      oscGain.connect(this.ambientGain);
      osc.start(now);
      this.activeDroneOscs.push(osc);
    }
  }

  public close(): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close();
    }
    this.ctx = null;
  }
}
