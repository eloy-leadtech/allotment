/**
 * Deterministic pseudo-random number generator.
 *
 * The whole simulation is reproducible by seed: given the same seed and the same
 * sequence of calls, the output is identical on every machine. This is a
 * deliberate improvement over the original PC Fútbol engine, which seeded from
 * the wall clock (`srand(time()*123)`) and was therefore not reproducible.
 */
export interface Rng {
  /** Next unsigned 32-bit integer in [0, 2^32). */
  nextU32(): number;
  /** Next float in [0, 1). */
  next01(): number;
  /** Integer in [0, n). Throws if n <= 0. */
  int(n: number): number;
}

/**
 * mulberry32: a small, fast, well-distributed 32-bit PRNG. Ideal here because
 * the state is a single 32-bit integer, so a run is fully described by its seed.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const nextU32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };

  return {
    nextU32,
    next01: (): number => nextU32() / 0x1_0000_0000,
    int: (n: number): number => {
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`Rng.int requires a positive integer, got ${n}`);
      }
      return Math.floor((nextU32() / 0x1_0000_0000) * n);
    },
  };
}
