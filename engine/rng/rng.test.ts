import { describe, it, expect } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('is deterministic: same seed produces the same sequence', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 100 }, () => a.nextU32());
    const seqB = Array.from({ length: 100 }, () => b.nextU32());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 20 }, () => a.nextU32());
    const seqB = Array.from({ length: 20 }, () => b.nextU32());
    expect(seqA).not.toEqual(seqB);
  });

  it('next01 stays within [0, 1)', () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next01();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int(n) stays within [0, n)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.int(10);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(10);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('int throws on non-positive n', () => {
    const rng = createRng(1);
    expect(() => rng.int(0)).toThrow();
    expect(() => rng.int(-1)).toThrow();
  });

  it('produces a roughly uniform distribution over int(n)', () => {
    const rng = createRng(99);
    const buckets = new Array<number>(6).fill(0);
    const rolls = 60_000;
    for (let i = 0; i < rolls; i += 1) {
      const bucket = rng.int(6);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    // Each bucket should be near rolls/6 (10_000); allow a generous ±15% band.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(8_500);
      expect(count).toBeLessThan(11_500);
    }
  });
});
