import { describe, it, expect } from 'vitest';
import { hashSeed } from './hash';

describe('hashSeed', () => {
  it('is deterministic for the same inputs', () => {
    expect(hashSeed('liga', 5, 'BAR-RMA')).toBe(hashSeed('liga', 5, 'BAR-RMA'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const value = hashSeed('anything', 123);
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffff_ffff);
  });

  it('is order-sensitive', () => {
    expect(hashSeed(1, 2)).not.toBe(hashSeed(2, 1));
  });

  it('distinguishes different inputs', () => {
    const seeds = new Set([
      hashSeed('liga', 1, 'A'),
      hashSeed('liga', 1, 'B'),
      hashSeed('liga', 2, 'A'),
      hashSeed('copa', 1, 'A'),
    ]);
    expect(seeds.size).toBe(4);
  });
});
