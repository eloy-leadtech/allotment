import { describe, it, expect } from 'vitest';
import {
  FRESH_FATIGUE,
  FATIGUE_MAX,
  clampFatigue,
  playerFatigue,
  fatigueMultiplier,
  nextFatigue,
  updateTeamFatigue,
  fatigueTier,
} from './fatigue';
import { computeStrength } from './strength';
import type { MatchPlayer } from './types';

function outfielder(id: string, fatigue?: number): MatchPlayer {
  return {
    id,
    nombre: id,
    posicion: 'DEL',
    esPortero: false,
    media: 70,
    remate: 70,
    ofensivo: 70,
    pase: 70,
    entrada: 70,
    porteria: 10,
    ...(fatigue === undefined ? {} : { fatigue }),
  };
}

describe('fatigueMultiplier', () => {
  it('is exactly 1 when fresh (no penalty) and defaults to fresh', () => {
    expect(fatigueMultiplier(FRESH_FATIGUE)).toBe(1);
    expect(fatigueMultiplier()).toBe(1);
    expect(fatigueMultiplier(undefined)).toBe(1);
  });

  it('only ever tires — never above 1, bottoms out around 0.95', () => {
    expect(fatigueMultiplier(FATIGUE_MAX)).toBeLessThan(1);
    expect(fatigueMultiplier(FATIGUE_MAX)).toBeGreaterThanOrEqual(0.94);
    // Monotonic: more fatigue never helps.
    for (let f = 1; f <= 100; f += 1) {
      expect(fatigueMultiplier(f)).toBeLessThanOrEqual(fatigueMultiplier(f - 1));
    }
  });

  it('clamps out-of-range fatigue', () => {
    expect(fatigueMultiplier(-50)).toBe(1);
    expect(fatigueMultiplier(200)).toBe(fatigueMultiplier(100));
  });
});

describe('nextFatigue', () => {
  it('adds fatigue for playing and recovers it with rest', () => {
    const afterPlaying = nextFatigue(FRESH_FATIGUE, true);
    expect(afterPlaying).toBeGreaterThan(FRESH_FATIGUE);
    // Resting sheds fatigue back toward fresh.
    expect(nextFatigue(afterPlaying, false)).toBeLessThan(afterPlaying);
  });

  it('never leaves the [0,100] range', () => {
    let f = FRESH_FATIGUE;
    for (let i = 0; i < 40; i += 1) f = nextFatigue(f, true);
    expect(f).toBeLessThanOrEqual(FATIGUE_MAX);
    expect(f).toBeGreaterThanOrEqual(0);
    // Long rest drains fully back to fresh.
    for (let i = 0; i < 40; i += 1) f = nextFatigue(f, false);
    expect(f).toBe(FRESH_FATIGUE);
  });

  it('rewards rotation: a permanent starter tires more than a rotated player', () => {
    let hardWorked = FRESH_FATIGUE;
    let rotated = FRESH_FATIGUE;
    for (let i = 0; i < 10; i += 1) {
      hardWorked = nextFatigue(hardWorked, true); // plays every week
      rotated = nextFatigue(rotated, i % 2 === 0); // plays every other week
    }
    expect(hardWorked).toBeGreaterThan(rotated);
  });

  it('plateaus below the maximum for a permanent starter (playable, not maxed)', () => {
    let f = FRESH_FATIGUE;
    for (let i = 0; i < 30; i += 1) f = nextFatigue(f, true);
    expect(f).toBeGreaterThan(40);
    expect(f).toBeLessThan(FATIGUE_MAX);
  });
});

describe('updateTeamFatigue', () => {
  it('tires the players who played and recovers the rest, without mutating input', () => {
    const players = [outfielder('a', 40), outfielder('b', 40)];
    const updated = updateTeamFatigue(players, new Set(['a']));
    const a = updated.find((p) => p.id === 'a');
    const b = updated.find((p) => p.id === 'b');
    expect(a?.fatigue).toBeGreaterThan(40 * 0.7); // played: recovered then +cost
    expect(b?.fatigue).toBeLessThan(40); // rested: recovered
    // Input untouched.
    expect(players[0]?.fatigue).toBe(40);
  });
});

describe('fatigue feeds computeStrength', () => {
  const xi = Array.from({ length: 11 }, (_, i) => outfielder(`p${i}`));

  it('a fresh XI is identical to one with no fatigue field (backwards compatible)', () => {
    const fresh = xi.map((p) => ({ ...p, fatigue: FRESH_FATIGUE }));
    expect(computeStrength(fresh)).toEqual(computeStrength(xi));
  });

  it('a fatigued XI is weaker in attack and defense than a fresh one', () => {
    const tired = xi.map((p) => ({ ...p, fatigue: FATIGUE_MAX }));
    const fresh = computeStrength(xi);
    const spent = computeStrength(tired);
    expect(spent.attack).toBeLessThan(fresh.attack);
    expect(spent.defense).toBeLessThan(fresh.defense);
  });
});

describe('helpers', () => {
  it('clampFatigue rounds and clamps', () => {
    expect(clampFatigue(33.6)).toBe(34);
    expect(clampFatigue(-5)).toBe(0);
    expect(clampFatigue(140)).toBe(100);
  });

  it('playerFatigue defaults to fresh', () => {
    expect(playerFatigue({})).toBe(FRESH_FATIGUE);
    expect(playerFatigue({ fatigue: 62 })).toBe(62);
  });

  it('fatigueTier buckets 0..3 by condition', () => {
    expect(fatigueTier(0)).toBe(0);
    expect(fatigueTier(24)).toBe(0);
    expect(fatigueTier(25)).toBe(1);
    expect(fatigueTier(50)).toBe(2);
    expect(fatigueTier(90)).toBe(3);
  });
});
