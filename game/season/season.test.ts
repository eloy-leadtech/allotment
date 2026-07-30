import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import {
  newSeason,
  advanceMatchday,
  currentStandings,
  isSeasonOver,
  fixturesForMatchday,
  nextHumanFixture,
  teamName,
} from './season';
import { serializeSeason, restoreSeason } from '../save/save';
import { narrateMatch } from '../narration/narrate';

const league = loadPrimera9697();
const firstTeam = league.equipos[0];
if (!firstTeam) throw new Error('league has no teams');
const humanTeamId = firstTeam.id;

function playN(n: number) {
  let state = newSeason(league, humanTeamId, 2024);
  const lastResults = [];
  for (let i = 0; i < n; i += 1) {
    const step = advanceMatchday(state);
    state = step.state;
    lastResults.push(step.played);
  }
  return { state, lastResults };
}

describe('season', () => {
  it('starts a 22-team, 42-matchday season', () => {
    const state = newSeason(league, humanTeamId, 2024);
    expect(state.teams).toHaveLength(22);
    expect(state.totalMatchdays).toBe(42);
    expect(state.currentMatchday).toBe(1);
    expect(state.results).toHaveLength(0);
    expect(fixturesForMatchday(state, 1)).toHaveLength(11);
  });

  it('nextHumanFixture returns the human match each matchday, then null when over', () => {
    let state = newSeason(league, humanTeamId, 2024);
    const first = nextHumanFixture(state);
    expect(first).not.toBeNull();
    expect(first!.round).toBe(1);
    expect(first!.homeId === humanTeamId || first!.awayId === humanTeamId).toBe(true);
    // Play the whole season; the last state is over -> no fixture.
    for (let i = 0; i < state.totalMatchdays; i += 1) state = advanceMatchday(state).state;
    expect(isSeasonOver(state)).toBe(true);
    expect(nextHumanFixture(state)).toBeNull();
  });

  it('advances matchdays and accumulates results', () => {
    const { state } = playN(3);
    expect(state.currentMatchday).toBe(4);
    expect(state.results).toHaveLength(3 * 11);
    const table = currentStandings(state);
    expect(table).toHaveLength(22);
    // every team has played 3 games
    for (const row of table) expect(row.played).toBe(3);
  });

  it('narrates a match in Spanish ending with the final score', () => {
    const { lastResults } = playN(1);
    const result = lastResults[0]?.[0];
    expect(result).toBeDefined();
    if (!result) return;
    const lines = narrateMatch(result, teamName(playN(1).state, result.homeId), teamName(playN(1).state, result.awayId));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[lines.length - 1]?.startsWith('FINAL:')).toBe(true);
  });

  it('save/restore round-trips to the same state', () => {
    const { state } = playN(5);
    const save = serializeSeason(state);
    const restored = restoreSeason(save, league);
    expect(restored.currentMatchday).toBe(state.currentMatchday);
    expect(restored.results).toHaveLength(state.results.length);
    expect(currentStandings(restored)).toEqual(currentStandings(state));
  });

  it('is deterministic: same seed replays identical results', () => {
    const a = playN(4).state;
    const b = playN(4).state;
    expect(currentStandings(a)).toEqual(currentStandings(b));
  });

  it('reports season over after the last matchday', () => {
    let state = newSeason(league, humanTeamId, 7);
    while (!isSeasonOver(state)) {
      state = advanceMatchday(state).state;
    }
    expect(state.currentMatchday).toBe(43);
    expect(state.results).toHaveLength(462);
  });
});
