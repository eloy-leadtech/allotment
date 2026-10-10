import { describe, it, expect } from 'vitest';
import { getCalendarByLeagueId, loadPrimera9697 } from '@data';
import type { MatchResult, RealMatchInput } from '@engine';
import { newSeason, advanceMatchday, isSeasonOver, type SeasonState, realCalendarFor } from './season';

const league = loadPrimera9697();
const real = realCalendarFor('es-primera-9697');
const calendar = getCalendarByLeagueId('es-primera-9697');
if (!real || !calendar) throw new Error('expected a committed calendar for es-primera-9697');

const firstTeam = league.equipos[0];
if (!firstTeam) throw new Error('league has no teams');
const humanTeamId = firstTeam.id;

/** Real score keyed by ordered pairing (every pairing is unique in a season). */
const expectedScore = new Map<string, { homeGoals: number; awayGoals: number }>(
  calendar.partidos.map((p) => [`${p.homeId}>${p.awayId}`, { homeGoals: p.homeGoals, awayGoals: p.awayGoals }]),
);

function playFullSeason(seed: number, fixtures = real): { state: SeasonState; results: MatchResult[] } {
  let state = newSeason(league, humanTeamId, seed, fixtures);
  const results: MatchResult[] = [];
  while (!isSeasonOver(state)) {
    const step = advanceMatchday(state);
    state = step.state;
    results.push(...step.played);
  }
  return { state, results };
}

const isHuman = (r: MatchResult): boolean => r.homeId === humanTeamId || r.awayId === humanTeamId;

describe('season on the authentic 96/97 calendar', () => {
  it('uses the real pairings and dates (not a generated round-robin)', () => {
    const state = newSeason(league, humanTeamId, 2024, real);
    expect(state.totalMatchdays).toBe(42);
    expect(state.fixtures).toHaveLength(462);
    // Every fixture matches the committed calendar one-to-one (round/pairing/date).
    const projected = state.fixtures.map((f) => ({
      round: f.round,
      homeId: f.homeId,
      awayId: f.awayId,
      date: f.date,
    }));
    const expected = real.map((m: RealMatchInput) => ({
      round: m.round,
      homeId: m.homeId,
      awayId: m.awayId,
      date: m.date,
    }));
    expect(projected).toEqual(expected);
    // The opening fixture is the real one: Deportivo 1-1 Real Madrid, 31/08/1996.
    expect(state.fixtures[0]).toMatchObject({ homeId: 'deportivo', awayId: 'real-madrid', date: '1996-08-31' });
  });

  it('replays the real score for every match NOT involving the human club', () => {
    const { results } = playFullSeason(2024);
    const aiResults = results.filter((r) => !isHuman(r));
    expect(aiResults).toHaveLength(42 * 10); // 10 non-human matches per matchday
    for (const r of aiResults) {
      const exp = expectedScore.get(`${r.homeId}>${r.awayId}`);
      expect(exp).toBeDefined();
      expect({ homeGoals: r.homeGoals, awayGoals: r.awayGoals }).toEqual(exp);
      expect(r.events).toEqual([]); // replayed: no reconstructed scorers/cards
    }
  });

  it('simulates the human club\'s own matches (seed-dependent, unlike the replayed rest)', () => {
    const humanA = playFullSeason(2024).results.filter(isHuman);
    const humanB = playFullSeason(777).results.filter(isHuman);
    expect(humanA).toHaveLength(42);
    expect(humanB).toHaveLength(42);
    // Different seed -> the human's simulated scores change somewhere across the season.
    const scoreSeq = (rs: MatchResult[]) => rs.map((r) => `${r.homeGoals}-${r.awayGoals}`).join(',');
    expect(scoreSeq(humanA)).not.toBe(scoreSeq(humanB));
  });

  it('keeps the rest of the league identical to history regardless of the human seed', () => {
    const aiSeq = (seed: number) =>
      playFullSeason(seed)
        .results.filter((r) => !isHuman(r))
        .map((r) => `${r.homeId}>${r.awayId}:${r.homeGoals}-${r.awayGoals}`)
        .join('|');
    expect(aiSeq(2024)).toBe(aiSeq(777)); // non-human matches are real history, seed-independent
  });

  it('is deterministic: same seed replays byte-identical results', () => {
    const a = playFullSeason(2024).results;
    const b = playFullSeason(2024).results;
    expect(a).toEqual(b);
  });
});

describe('newSeason default follows the authentic calendar (slice 2 switch-on)', () => {
  it('uses the real 96/97 calendar when no fixtures are passed', () => {
    const state = newSeason(league, humanTeamId, 2024);
    // Opening fixture is the real one: Deportivo 1-1 Real Madrid, 31/08/1996.
    expect(state.fixtures[0]).toMatchObject({ homeId: 'deportivo', awayId: 'real-madrid', date: '1996-08-31' });
    expect(state.fixtures.some((f) => f.historicalScore !== undefined)).toBe(true);
  });

  it('an explicit [] forces the generated round-robin (no dates or historical scores)', () => {
    const state = newSeason(league, humanTeamId, 2024, []);
    expect(state.totalMatchdays).toBe(42);
    expect(state.fixtures).toHaveLength(462);
    expect(state.fixtures.every((f) => f.date === undefined)).toBe(true);
    expect(state.fixtures.every((f) => f.historicalScore === undefined)).toBe(true);
  });

  it('realCalendarFor returns undefined for a league with no committed calendar', () => {
    expect(realCalendarFor('es-primera-9798')).toBeUndefined();
  });
});
