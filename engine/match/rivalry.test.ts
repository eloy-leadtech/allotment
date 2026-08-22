import { describe, it, expect } from 'vitest';
import {
  RIVALRIES,
  canonicalClub,
  derbyInfo,
  derbyName,
  isDerby,
} from './rivalry';

describe('canonicalClub', () => {
  it('folds season-to-season id variants of the same club', () => {
    expect(canonicalClub('atletico-de-madrid')).toBe('atletico-madrid');
    expect(canonicalClub('at-madrid')).toBe('atletico-madrid');
    expect(canonicalClub('athletic-de-bilbao')).toBe('athletic');
    expect(canonicalClub('celta-de-vigo')).toBe('celta');
    expect(canonicalClub('real-zaragoza')).toBe('zaragoza');
    expect(canonicalClub('atletico-osasuna')).toBe('osasuna');
  });

  it('leaves already-canonical ids untouched', () => {
    expect(canonicalClub('barcelona')).toBe('barcelona');
    expect(canonicalClub('real-madrid')).toBe('real-madrid');
    expect(canonicalClub('unknown-team')).toBe('unknown-team');
  });
});

describe('isDerby / derbyInfo', () => {
  it('detects the classic derbis regardless of order', () => {
    expect(isDerby('real-madrid', 'barcelona')).toBe(true);
    expect(isDerby('barcelona', 'real-madrid')).toBe(true);
    expect(isDerby('sevilla', 'betis')).toBe(true);
    expect(isDerby('betis', 'sevilla')).toBe(true);
    expect(isDerby('athletic', 'real-sociedad')).toBe(true);
    expect(isDerby('deportivo', 'celta')).toBe(true);
    expect(isDerby('valencia', 'levante')).toBe(true);
    expect(isDerby('barcelona', 'espanyol')).toBe(true);
  });

  it('detects a derbi across season id variants', () => {
    // At. Madrid appears as `atletico-de-madrid` (93/94) and `at-madrid` (later).
    expect(isDerby('atletico-de-madrid', 'real-madrid')).toBe(true);
    expect(isDerby('at-madrid', 'real-madrid')).toBe(true);
    // Celta appears as `celta-de-vigo` and `celta`.
    expect(isDerby('deportivo', 'celta-de-vigo')).toBe(true);
  });

  it('is not a derbi for unrelated teams', () => {
    expect(isDerby('real-madrid', 'valencia')).toBe(false);
    expect(isDerby('sevilla', 'celta')).toBe(false);
    expect(isDerby('barcelona', 'deportivo')).toBe(false);
  });

  it('never marks a team as its own rival', () => {
    expect(isDerby('real-madrid', 'real-madrid')).toBe(false);
    expect(isDerby('barcelona', 'barcelona')).toBe(false);
  });

  it('exposes the derby name via derbyInfo/derbyName', () => {
    expect(derbyName('real-madrid', 'barcelona')).toBe('El Clásico');
    expect(derbyName('barcelona', 'real-madrid')).toBe('El Clásico');
    expect(derbyInfo('sevilla', 'betis')?.name).toBe('Derbi sevillano');
    expect(derbyName('real-madrid', 'valencia')).toBeNull();
  });

  it('has a well-formed rivalry table (distinct pairs, non-empty names)', () => {
    const seen = new Set<string>();
    for (const r of RIVALRIES) {
      const a = canonicalClub(r.a);
      const b = canonicalClub(r.b);
      expect(a).not.toBe(b);
      expect(r.name.length).toBeGreaterThan(0);
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
