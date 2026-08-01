import { describe, it, expect } from 'vitest';
import { loadPrimera9697, loadPrimera9798 } from '@data';
import { newCareer, seasonFromCareer } from '../career/career';
import { advanceMatchday, currentStandings, newSeason } from '../season/season';
import type { CareerState, SeasonSummary } from '../career/types';
import {
  serializeSeason,
  serializeCareer,
  restoreCareer,
  CareerSaveSchema,
} from './save';

const league = loadPrimera9697();
const firstTeam = league.equipos[0];
if (!firstTeam) throw new Error('league has no teams');
const humanTeamId = firstTeam.id;

/**
 * Build a career that has genuinely diverged from a fresh league start: squads
 * are evolved (a player's media dropped), it sits in season 2 with history, and
 * a handful of matchdays are already played. This is exactly what v1 replay
 * could NOT reconstruct, so it exercises the v2 snapshot.
 */
function evolvedCareer(playedMatchdays: number): CareerState {
  const base = newCareer(league, humanTeamId, 2024);
  const teams = base.teams.map((t, i) =>
    i === 0
      ? { ...t, players: t.players.map((p) => ({ ...p, media: Math.max(1, p.media - 5) })) }
      : t,
  );
  const meta: Omit<CareerState, 'season' | 'history'> = {
    seed: base.seed,
    leagueId: base.leagueId,
    humanTeamId: base.humanTeamId,
    seasonNumber: 2,
    temporada: base.temporada,
    pointsForWin: base.pointsForWin,
    relegationSpots: base.relegationSpots,
    division: base.division,
    budget: base.budget,
    teams,
    youthProspects: base.youthProspects,
  };
  let season = seasonFromCareer(meta);
  for (let i = 0; i < playedMatchdays; i += 1) {
    season = advanceMatchday(season).state;
  }
  const history: SeasonSummary[] = [
    { seasonNumber: 1, temporada: base.temporada, championId: humanTeamId },
  ];
  return { ...meta, season, history };
}

describe('career save v2 (snapshot)', () => {
  it('round-trips an evolved career: teams, seasonNumber, history, currentMatchday, standings', () => {
    const career = evolvedCareer(6);
    const save = serializeCareer(career);

    expect(save.version).toBe(2);
    expect(save.currentMatchday).toBe(7); // 6 played, next up is 7

    const restored = restoreCareer(save, league);

    // Evolved squads are preserved verbatim (v1 replay could not do this).
    expect(restored.teams).toEqual(career.teams);
    expect(restored.seasonNumber).toBe(2);
    expect(restored.temporada).toBe(career.temporada);
    expect(restored.history).toEqual(career.history);
    // In-progress season is re-derived + replayed to the same point.
    expect(restored.season.currentMatchday).toBe(career.season.currentMatchday);
    expect(currentStandings(restored.season)).toEqual(currentStandings(career.season));
  });

  it('round-trips youth-academy prospects', () => {
    const career = evolvedCareer(4);
    const restored = restoreCareer(serializeCareer(career), league);
    expect(career.youthProspects.length).toBeGreaterThan(0);
    expect(restored.youthProspects).toEqual(career.youthProspects);
  });

  it("does not fall back to the league's original squads", () => {
    const career = evolvedCareer(3);
    const restored = restoreCareer(serializeCareer(career), league);
    const restoredFirst = restored.teams.find((t) => t.id === humanTeamId);
    const originalFirst = firstTeam.jugadores[0];
    const restoredPlayer = restoredFirst?.players[0];
    expect(restoredPlayer).toBeDefined();
    expect(originalFirst).toBeDefined();
    if (!restoredPlayer || !originalFirst) return;
    // The evolved (-5) media survived the round-trip instead of the league value.
    expect(restoredPlayer.media).toBe(Math.max(1, originalFirst.media - 5));
  });

  it('is deterministic: restoring the same save twice yields identical results', () => {
    const save = serializeCareer(evolvedCareer(5));
    const a = restoreCareer(save, league);
    const b = restoreCareer(save, league);
    expect(a.season.results).toEqual(b.season.results);
    expect(currentStandings(a.season)).toEqual(currentStandings(b.season));
  });

  it('migrates a v1 season save into a season-1 career', () => {
    let state = newSeason(league, humanTeamId, 2024);
    for (let i = 0; i < 4; i += 1) state = advanceMatchday(state).state;
    const v1save = serializeSeason(state); // currentMatchday 5

    const career = restoreCareer(v1save, league);
    expect(career.seasonNumber).toBe(1);
    expect(career.history).toHaveLength(0);
    expect(career.teams).toHaveLength(22);
    expect(career.humanTeamId).toBe(humanTeamId);
    expect(career.season.currentMatchday).toBe(5);
  });

  it('rejects a corrupt payload via the Zod schema', () => {
    const good = serializeCareer(evolvedCareer(2));
    expect(() => CareerSaveSchema.parse({ ...good, teams: 'not-an-array' })).toThrow();
    expect(() => CareerSaveSchema.parse({ ...good, seasonNumber: 0 })).toThrow();
    expect(() => CareerSaveSchema.parse({ ...good, version: 1 })).toThrow();
  });

  it('rejects a save from a different league', () => {
    const save = serializeCareer(evolvedCareer(1));
    const other = loadPrimera9798();
    expect(() => restoreCareer(save, other)).toThrow(/different|league|es-primera/i);
  });

  it('rejects an unsupported save version', () => {
    const save = serializeCareer(evolvedCareer(1));
    expect(() => restoreCareer({ ...save, version: 99 }, league)).toThrow();
  });
});
