/**
 * QA-01 — headless full-season smoke test.
 *
 * The safety net for "siempre jugable": it simulates a whole Liga 96/97 season
 * from the real database and asserts the invariants that keep the game correct
 * and deterministic. If the goal-average band fails, tune engine/match/config.ts
 * (never weaken this test).
 */
import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import { newSeason, advanceMatchday, currentStandings, isSeasonOver, type SeasonState } from '@game';

const league = loadPrimera9697();
const firstTeam = league.equipos[0];
if (!firstTeam) throw new Error('league has no teams');
const humanTeamId = firstTeam.id;

function playFullSeason(seed: number): SeasonState {
  let state = newSeason(league, humanTeamId, seed);
  let guard = 0;
  while (!isSeasonOver(state)) {
    state = advanceMatchday(state).state;
    guard += 1;
    if (guard > 100) throw new Error('season did not terminate');
  }
  return state;
}

describe('QA-01: full season smoke test', () => {
  const season = playFullSeason(19_9697);

  it('plays exactly 462 matches over 42 matchdays', () => {
    expect(season.results).toHaveLength(462);
    expect(season.totalMatchdays).toBe(42);
    expect(season.currentMatchday).toBe(43);
  });

  it('every team plays 42 games (21 home, 21 away)', () => {
    const home = new Map<string, number>();
    const away = new Map<string, number>();
    for (const r of season.results) {
      home.set(r.homeId, (home.get(r.homeId) ?? 0) + 1);
      away.set(r.awayId, (away.get(r.awayId) ?? 0) + 1);
    }
    for (const team of season.teams) {
      expect(home.get(team.id)).toBe(21);
      expect(away.get(team.id)).toBe(21);
    }
  });

  it('has a plausible goal average (~2.6, band 2.0-3.4)', () => {
    const totalGoals = season.results.reduce((n, r) => n + r.homeGoals + r.awayGoals, 0);
    const mean = totalGoals / season.results.length;
    expect(mean).toBeGreaterThanOrEqual(2.0);
    expect(mean).toBeLessThanOrEqual(3.4);
  });

  it('produces a coherent 22-row table', () => {
    const table = currentStandings(season);
    expect(table).toHaveLength(22);
    for (const row of table) {
      expect(row.played).toBe(42);
      expect(row.won + row.drawn + row.lost).toBe(42);
      expect(row.points).toBe(row.won * 3 + row.drawn);
    }
    const gf = table.reduce((n, r) => n + r.goalsFor, 0);
    const ga = table.reduce((n, r) => n + r.goalsAgainst, 0);
    expect(gf).toBe(ga);
  });

  it('orders the table by points (descending)', () => {
    const table = currentStandings(season);
    for (let i = 1; i < table.length; i += 1) {
      const prev = table[i - 1];
      const cur = table[i];
      if (!prev || !cur) continue;
      expect(prev.points).toBeGreaterThanOrEqual(cur.points);
    }
  });

  it('is deterministic: same seed replays an identical season', () => {
    const a = playFullSeason(42);
    const b = playFullSeason(42);
    expect(currentStandings(a)).toEqual(currentStandings(b));
    expect(JSON.stringify(a.results)).toBe(JSON.stringify(b.results));
  });

  it('is sensitive: a different seed yields a different season', () => {
    const a = JSON.stringify(currentStandings(playFullSeason(1)));
    const b = JSON.stringify(currentStandings(playFullSeason(2)));
    expect(a).not.toBe(b);
  });

  it('keeps event integrity: scorers belong to the scoring team, minutes are legal', () => {
    const squadIds = new Map<string, Set<string>>();
    for (const team of season.teams) {
      squadIds.set(team.id, new Set(team.players.map((p) => p.id)));
    }
    for (const r of season.results) {
      const goalHome = r.events.filter((e) => e.type === 'goal' && e.team === 'home').length;
      const goalAway = r.events.filter((e) => e.type === 'goal' && e.team === 'away').length;
      expect(goalHome).toBe(r.homeGoals);
      expect(goalAway).toBe(r.awayGoals);
      for (const e of r.events) {
        const teamId = e.team === 'home' ? r.homeId : r.awayId;
        expect(squadIds.get(teamId)?.has(e.playerId)).toBe(true);
        expect(e.min).toBeGreaterThanOrEqual(1);
        expect(e.min).toBeLessThanOrEqual(90);
      }
    }
  });
});
