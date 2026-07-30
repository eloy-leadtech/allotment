import { describe, it, expect } from 'vitest';
import type { StandingRow } from '@engine';
import { relegationZone, promotionZone, humanFate, nextDivision } from './promotion';

/** Minimal best-first table of `n` teams named t1..tn (order = position). */
function table(n: number): StandingRow[] {
  return Array.from({ length: n }, (_, i) => ({
    teamId: `t${i + 1}`,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: (n - i) * 3, // decreasing so order is already best-first
  }));
}

describe('relegationZone / promotionZone', () => {
  const t = table(20);
  it('relegation zone is the bottom N', () => {
    expect(relegationZone(t, 3)).toEqual(['t18', 't19', 't20']);
  });
  it('promotion zone is the top N', () => {
    expect(promotionZone(t, 3)).toEqual(['t1', 't2', 't3']);
  });
  it('handles zero and oversized spots', () => {
    expect(relegationZone(t, 0)).toEqual([]);
    expect(promotionZone(t, 0)).toEqual([]);
    expect(relegationZone(table(2), 5)).toHaveLength(2);
  });
});

describe('humanFate', () => {
  const t = table(20);
  const base = { standings: t, relegationSpots: 3, promotionSpots: 3 };

  it('relegates a Primera team inside the bottom three', () => {
    expect(humanFate({ ...base, division: 'primera', humanTeamId: 't19' })).toBe('relegated');
    expect(humanFate({ ...base, division: 'primera', humanTeamId: 't18' })).toBe('relegated');
  });
  it('keeps a mid-table Primera team', () => {
    expect(humanFate({ ...base, division: 'primera', humanTeamId: 't10' })).toBe('stays');
    expect(humanFate({ ...base, division: 'primera', humanTeamId: 't17' })).toBe('stays');
  });
  it('promotes a Segunda team inside the top three', () => {
    expect(humanFate({ ...base, division: 'segunda', humanTeamId: 't2' })).toBe('promoted');
    expect(humanFate({ ...base, division: 'segunda', humanTeamId: 't3' })).toBe('promoted');
  });
  it('keeps a mid-table Segunda team', () => {
    expect(humanFate({ ...base, division: 'segunda', humanTeamId: 't4' })).toBe('stays');
  });
  it('a team not in the table stays', () => {
    expect(humanFate({ ...base, division: 'primera', humanTeamId: 'ghost' })).toBe('stays');
  });
});

describe('nextDivision', () => {
  it('moves the human between divisions on the matching outcome', () => {
    expect(nextDivision('primera', 'relegated')).toBe('segunda');
    expect(nextDivision('segunda', 'promoted')).toBe('primera');
    expect(nextDivision('primera', 'stays')).toBe('primera');
    expect(nextDivision('segunda', 'stays')).toBe('segunda');
    // Nonsensical combinations are no-ops.
    expect(nextDivision('primera', 'promoted')).toBe('primera');
    expect(nextDivision('segunda', 'relegated')).toBe('segunda');
  });
});
