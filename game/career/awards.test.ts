import { describe, it, expect } from 'vitest';
import { loadPrimera9697, loadPrimera9798 } from '@data';
import { newCareer } from './career';
import { applyTransition } from './transition';
import { currentSeasonAwards } from './awards';
import { advanceMatchday, isSeasonOver, currentStandings } from '../season/season';
import { serializeCareer, restoreCareer } from '../save/save';
import type { CareerState } from './types';

const HUMAN = 'barcelona';

/** Play the in-progress season to its very end (all matchdays). */
function playFullSeason(career: CareerState): CareerState {
  let season = career.season;
  while (!isSeasonOver(season)) season = advanceMatchday(season).state;
  return { ...career, season };
}

describe('individual trophies (Pichichi / Zamora)', () => {
  it('computes a Pichichi and a Zamora from a finished season', () => {
    const finished = playFullSeason(newCareer(loadPrimera9697(), HUMAN, 2024));
    const awards = currentSeasonAwards(finished);

    expect(awards.pichichi).not.toBeNull();
    expect(awards.zamora).not.toBeNull();
    // The Pichichi has actually scored, and belongs to a real team.
    expect(awards.pichichi!.goals).toBeGreaterThan(0);
    const teamIds = new Set(finished.season.teams.map((t) => t.id));
    expect(teamIds.has(awards.pichichi!.teamId)).toBe(true);
    // The Zamora played the whole season and keeps for a real team.
    expect(teamIds.has(awards.zamora!.teamId)).toBe(true);
    expect(awards.zamora!.matches).toBeGreaterThan(0);
    // Its keeper is really a goalkeeper on that side.
    const zTeam = finished.season.teams.find((t) => t.id === awards.zamora!.teamId)!;
    const keeper = zTeam.players.find((p) => p.id === awards.zamora!.playerId);
    expect(keeper?.esPortero).toBe(true);
  });

  it('the Zamora side really conceded the fewest goals', () => {
    const finished = playFullSeason(newCareer(loadPrimera9697(), HUMAN, 2024));
    const zamora = currentSeasonAwards(finished).zamora!;
    const table = currentStandings(finished.season);
    const minAgainst = Math.min(...table.map((r) => r.goalsAgainst));
    const zRow = table.find((r) => r.teamId === zamora.teamId)!;
    expect(zRow.goalsAgainst).toBe(minAgainst);
    expect(zamora.goalsConceded).toBe(minAgainst);
  });

  it('is deterministic across replays of the same season', () => {
    const a = currentSeasonAwards(playFullSeason(newCareer(loadPrimera9697(), HUMAN, 2024)));
    const b = currentSeasonAwards(playFullSeason(newCareer(loadPrimera9697(), HUMAN, 2024)));
    expect(a).toEqual(b);
  });

  it('records the season trophies in the palmarés on transition', () => {
    const finished = playFullSeason(newCareer(loadPrimera9697(), HUMAN, 2024));
    const expected = currentSeasonAwards(finished);
    const next = applyTransition(finished, loadPrimera9798(), new Set());

    const line = next.history.find((h) => h.seasonNumber === finished.seasonNumber);
    expect(line?.pichichi).toEqual(expected.pichichi);
    expect(line?.zamora).toEqual(expected.zamora);
  });

  it('survives a v2 save round-trip', () => {
    const finished = playFullSeason(newCareer(loadPrimera9697(), HUMAN, 2024));
    const next = applyTransition(finished, loadPrimera9798(), new Set());

    const restored = restoreCareer(serializeCareer(next), loadPrimera9798());
    const line = restored.history.find((h) => h.seasonNumber === finished.seasonNumber);
    const original = next.history.find((h) => h.seasonNumber === finished.seasonNumber);
    expect(line?.pichichi).toEqual(original?.pichichi);
    expect(line?.zamora).toEqual(original?.zamora);
  });
});
