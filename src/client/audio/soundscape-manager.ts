import { SimEvent } from '../../schemas/events.schema.js';
import { StratumId } from '../../schemas/primitives.schema.js';
import { ProceduralWebAudioSynth } from './procedural-synth.js';
import { mapSimEventToAudioPresets } from './synth-definitions.js';

export class SoundscapeManager {
  private synth: ProceduralWebAudioSynth;
  private currentStratum: StratumId = 'STREET';

  constructor(synth?: ProceduralWebAudioSynth) {
    this.synth = synth ?? new ProceduralWebAudioSynth();
  }

  public initOnUserGesture(): void {
    this.synth.initContext();
  }

  public toggleMute(): boolean {
    const next = !this.synth.getMuted();
    this.synth.setMuted(next);
    return next;
  }

  public isMuted(): boolean {
    return this.synth.getMuted();
  }

  public updateStratum(stratum: StratumId): void {
    if (this.currentStratum !== stratum) {
      this.currentStratum = stratum;
      this.synth.setStratumAmbience(stratum);
    }
  }

  public processSimEvents(events: ReadonlyArray<SimEvent>): void {
    for (const evt of events) {
      if (evt.type === 'STRATUM_CHANGED') {
        this.updateStratum(evt.toStratum);
      }
      const effects = mapSimEventToAudioPresets(evt);
      for (const effect of effects) {
        this.synth.playSoundEffect(effect);
      }
    }
  }

  public getSynth(): ProceduralWebAudioSynth {
    return this.synth;
  }

  public suspend(): void {
    this.synth.suspend();
  }

  public resume(): void {
    this.synth.resume();
  }
}

let globalSoundscape: SoundscapeManager | null = null;

export function getSoundscapeManager(): SoundscapeManager {
  if (!globalSoundscape) {
    globalSoundscape = new SoundscapeManager();
  }
  return globalSoundscape;
}
