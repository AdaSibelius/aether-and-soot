import { z } from 'zod';

export const RNGStateSchema = z.tuple([
  z.number().int(),
  z.number().int(),
  z.number().int(),
  z.number().int(),
]);
export type RNGState = z.infer<typeof RNGStateSchema>;

/**
 * Deterministic xoshiro128** PRNG with serializable 4x32-bit state tuple.
 * Strictly replaces non-deterministic browser PRNGs inside the simulation core.
 */
export class SeededRNG {
  private s: [number, number, number, number];

  constructor(seedOrState: number | RNGState) {
    if (Array.isArray(seedOrState)) {
      this.s = [
        seedOrState[0] >>> 0,
        seedOrState[1] >>> 0,
        seedOrState[2] >>> 0,
        seedOrState[3] >>> 0,
      ];
    } else {
      let z = seedOrState | 0;
      const nextSplitMix = (): number => {
        z = (z + 0x9e3779b9) | 0;
        let t = z ^ (z >>> 16);
        t = Math.imul(t, 0x21f0aaad);
        t = t ^ (t >>> 15);
        t = Math.imul(t, 0x735a2d97);
        return (t ^ (t >>> 15)) >>> 0;
      };
      this.s = [nextSplitMix(), nextSplitMix(), nextSplitMix(), nextSplitMix()];
      if (this.s.every((v) => v === 0)) {
        this.s[0] = 0xdeadbeef;
      }
    }
  }

  public nextUint32(): number {
    const result = Math.imul(this.rotl(Math.imul(this.s[1], 5), 7), 9) >>> 0;
    const t = (this.s[1] << 9) >>> 0;

    this.s[2] = (this.s[2] ^ this.s[0]) >>> 0;
    this.s[3] = (this.s[3] ^ this.s[1]) >>> 0;
    this.s[1] = (this.s[1] ^ this.s[2]) >>> 0;
    this.s[0] = (this.s[0] ^ this.s[3]) >>> 0;
    this.s[2] = (this.s[2] ^ t) >>> 0;
    this.s[3] = this.rotl(this.s[3], 11);

    return result;
  }

  public nextFloat(): number {
    return this.nextUint32() / 0x100000000;
  }

  public nextInt(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) {
      throw new Error(`Invalid range: [${minInclusive}, ${maxInclusive}]`);
    }
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + (this.nextUint32() % span);
  }

  public getState(): RNGState {
    return [this.s[0] | 0, this.s[1] | 0, this.s[2] | 0, this.s[3] | 0];
  }

  private rotl(x: number, k: number): number {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
  }
}
