import { describe, it, expect } from 'vitest';
import { generateDoubleRoundRobin } from './roundRobin';

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `t${i}`);
}

describe('generateDoubleRoundRobin', () => {
  it('produces 462 fixtures over 42 rounds for 22 teams', () => {
    const fixtures = generateDoubleRoundRobin(ids(22));
    expect(fixtures).toHaveLength(22 * 21);
    const rounds = new Set(fixtures.map((f) => f.round));
    expect(rounds.size).toBe(42);
  });

  it('schedules 11 matches per round with every team playing once', () => {
    const fixtures = generateDoubleRoundRobin(ids(22));
    for (let round = 1; round <= 42; round += 1) {
      const inRound = fixtures.filter((f) => f.round === round);
      expect(inRound).toHaveLength(11);
      const teams = new Set(inRound.flatMap((f) => [f.homeId, f.awayId]));
      expect(teams.size).toBe(22);
    }
  });

  it('every ordered pairing occurs exactly once (home & away)', () => {
    const fixtures = generateDoubleRoundRobin(ids(22));
    const seen = new Set(fixtures.map((f) => `${f.homeId}>${f.awayId}`));
    expect(seen.size).toBe(fixtures.length);
    // Each unordered pair should appear exactly twice (once each venue).
    expect(fixtures.length).toBe(22 * 21);
  });

  it('gives each team a balanced 21 home / 21 away split', () => {
    const fixtures = generateDoubleRoundRobin(ids(22));
    const home = new Map<string, number>();
    const away = new Map<string, number>();
    for (const f of fixtures) {
      home.set(f.homeId, (home.get(f.homeId) ?? 0) + 1);
      away.set(f.awayId, (away.get(f.awayId) ?? 0) + 1);
    }
    for (const id of ids(22)) {
      expect(home.get(id)).toBe(21);
      expect(away.get(id)).toBe(21);
    }
  });

  it('is deterministic for the same input order', () => {
    expect(generateDoubleRoundRobin(ids(8))).toEqual(generateDoubleRoundRobin(ids(8)));
  });

  it('handles an odd number of teams with byes (no team plays twice per round)', () => {
    const fixtures = generateDoubleRoundRobin(ids(5));
    // 5 teams -> each plays 4 opponents twice = 8 matches -> 20 total.
    expect(fixtures).toHaveLength(5 * 4);
    const rounds = new Set(fixtures.map((f) => f.round));
    for (const round of rounds) {
      const inRound = fixtures.filter((f) => f.round === round);
      const teams = inRound.flatMap((f) => [f.homeId, f.awayId]);
      expect(new Set(teams).size).toBe(teams.length); // no repeats within a round
    }
  });

  it('throws with fewer than 2 teams', () => {
    expect(() => generateDoubleRoundRobin(['solo'])).toThrow();
  });
});
