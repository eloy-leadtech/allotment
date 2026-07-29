import { describe, it, expect } from 'vitest';
import { computeStandings } from './standings';
import type { Scoreline } from './types';

describe('computeStandings', () => {
  const teams = ['a', 'b', 'c'];
  const results: Scoreline[] = [
    { homeId: 'a', awayId: 'b', homeGoals: 2, awayGoals: 0 }, // a wins
    { homeId: 'b', awayId: 'c', homeGoals: 1, awayGoals: 1 }, // draw
    { homeId: 'c', awayId: 'a', homeGoals: 3, awayGoals: 3 }, // draw
  ];

  it('computes points with 3-for-a-win', () => {
    const table = computeStandings(teams, results, 3);
    const byId = new Map(table.map((r) => [r.teamId, r]));
    expect(byId.get('a')?.points).toBe(4); // W + D
    expect(byId.get('b')?.points).toBe(1); // L + D
    expect(byId.get('c')?.points).toBe(2); // D + D
  });

  it('supports the pre-95/96 2-for-a-win rule', () => {
    const table = computeStandings(teams, results, 2);
    const byId = new Map(table.map((r) => [r.teamId, r]));
    expect(byId.get('a')?.points).toBe(3); // 2 + 1
  });

  it('balances goals for and against across the whole set', () => {
    const table = computeStandings(teams, results, 3);
    const gf = table.reduce((n, r) => n + r.goalsFor, 0);
    const ga = table.reduce((n, r) => n + r.goalsAgainst, 0);
    expect(gf).toBe(ga);
  });

  it('sorts by points then goal difference', () => {
    const table = computeStandings(teams, results, 3);
    expect(table[0]?.teamId).toBe('a');
    for (let i = 1; i < table.length; i += 1) {
      const prev = table[i - 1];
      const cur = table[i];
      if (!prev || !cur) continue;
      expect(prev.points >= cur.points).toBe(true);
    }
  });

  it('includes teams that have not played yet', () => {
    const table = computeStandings(['a', 'b', 'x'], [], 3);
    expect(table).toHaveLength(3);
    expect(table.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });

  it('throws on a result with an unknown team', () => {
    expect(() =>
      computeStandings(['a'], [{ homeId: 'a', awayId: 'ghost', homeGoals: 1, awayGoals: 0 }], 3),
    ).toThrow();
  });
});
