import { z } from 'zod';
import { PlayerSchema, TeamColorsSchema, type League } from '@data';
import { advanceMatchday, isSeasonOver, newSeason, type SeasonState } from '../season/season';
import { newCareer, seasonFromCareer } from '../career/career';
import type { CareerState, CareerTeam, SeasonSummary } from '../career/types';

const SAVE_VERSION = 1;
const CAREER_SAVE_VERSION = 2;

/**
 * Minimal, deterministic season save (v1). Because results are a pure function of
 * the seed, we only persist the resume point; restoring replays the played
 * matchdays. Kept intact for backwards compatibility and migration.
 */
export interface SaveGame {
  version: number;
  leagueId: string;
  temporada: string;
  seed: number;
  humanTeamId: string;
  currentMatchday: number;
}

export function serializeSeason(state: SeasonState): SaveGame {
  return {
    version: SAVE_VERSION,
    leagueId: state.leagueId,
    temporada: state.temporada,
    seed: state.seed,
    humanTeamId: state.humanTeamId,
    currentMatchday: state.currentMatchday,
  };
}

export function restoreSeason(save: SaveGame, league: League): SeasonState {
  if (save.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version: ${save.version}`);
  }
  if (save.leagueId !== league.id) {
    throw new Error(`Save is for league ${save.leagueId}, not ${league.id}`);
  }
  return replaySeasonTo(newSeason(league, save.humanTeamId, save.seed), save.currentMatchday);
}

/**
 * Career save (v2): a SNAPSHOT of the career. A single-season replay (v1) is not
 * enough because squads EVOLVE between seasons, so we persist the full,
 * already-evolved `teams` as the source of truth. The in-progress season is not
 * stored as results: it is re-derived with `seasonFromCareer` over those teams
 * and replayed up to `currentMatchday`, which keeps the payload small while
 * staying fully deterministic.
 */
const CareerTeamSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  colores: TeamColorsSchema.optional(),
  players: z.array(PlayerSchema),
});

const SeasonSummarySchema = z.object({
  seasonNumber: z.number().int(),
  temporada: z.string().min(1),
  championId: z.string().min(1),
});

export const CareerSaveSchema = z.object({
  version: z.literal(CAREER_SAVE_VERSION),
  seed: z.number().int(),
  leagueId: z.string().min(1),
  humanTeamId: z.string().min(1),
  temporada: z.string().min(1),
  seasonNumber: z.number().int().min(1),
  pointsForWin: z.union([z.literal(2), z.literal(3)]),
  relegationSpots: z.number().int().min(0),
  /** Human's division; defaults to primera for pre-pyramid saves. */
  division: z.enum(['primera', 'segunda']).default('primera'),
  /** Human's tactics; absent means neutral auto-XI. */
  tactics: z
    .object({
      formation: z.enum(['5-4-1', '5-3-2', '4-5-1', '4-4-2', '3-5-2', '4-3-3', '3-4-3']),
      xiIds: z.array(z.string()).optional(),
    })
    .optional(),
  /** Human club's transfer budget; defaults to 0 for pre-market saves. */
  budget: z.number().int().min(0).default(0),
  teams: z.array(CareerTeamSchema).min(2),
  history: z.array(SeasonSummarySchema),
  /** Next matchday to play in the in-progress season (1-indexed). */
  currentMatchday: z.number().int().min(1),
});
export type CareerSave = z.infer<typeof CareerSaveSchema>;

/** Any persisted save this module can restore (v1 season or v2 career). */
export type AnySave = SaveGame | CareerSave;

/** Replay a fresh season up to (but not playing) `targetMatchday`. */
function replaySeasonTo(state: SeasonState, targetMatchday: number): SeasonState {
  let s = state;
  while (s.currentMatchday < targetMatchday && !isSeasonOver(s)) {
    s = advanceMatchday(s).state;
  }
  return s;
}

/** Snapshot a career into a small, deterministic v2 save. */
export function serializeCareer(career: CareerState): CareerSave {
  const teams: CareerTeam[] = career.teams;
  const history: SeasonSummary[] = career.history;
  return {
    version: CAREER_SAVE_VERSION,
    seed: career.seed,
    leagueId: career.leagueId,
    humanTeamId: career.humanTeamId,
    temporada: career.temporada,
    seasonNumber: career.seasonNumber,
    pointsForWin: career.pointsForWin,
    relegationSpots: career.relegationSpots,
    division: career.division,
    tactics: career.tactics,
    budget: career.budget,
    teams,
    history,
    // The in-progress season is derived from `teams`; only its resume point is saved.
    currentMatchday: career.season.currentMatchday,
  };
}

/** Rebuild the full CareerState from a validated v2 save (self-contained snapshot). */
function restoreCareerV2(save: CareerSave): CareerState {
  const meta: Omit<CareerState, 'season' | 'history'> = {
    seed: save.seed,
    leagueId: save.leagueId,
    humanTeamId: save.humanTeamId,
    seasonNumber: save.seasonNumber,
    temporada: save.temporada,
    pointsForWin: save.pointsForWin,
    relegationSpots: save.relegationSpots,
    division: save.division,
    tactics: save.tactics,
    budget: save.budget,
    teams: save.teams,
  };
  const season = replaySeasonTo(seasonFromCareer(meta), save.currentMatchday);
  return { ...meta, season, history: save.history };
}

/**
 * Migrate a v1 season save into a career: rebuild season 1 from the league with
 * `newCareer` and replay to the saved resume point. The result is a full career
 * sitting in its first season (no history, evolved teams yet to come). Reads
 * only the fields common to both save shapes, so no version narrowing is needed.
 */
function migrateSeasonSaveToCareer(save: AnySave, league: League): CareerState {
  const career = newCareer(league, save.humanTeamId, save.seed);
  return { ...career, season: replaySeasonTo(career.season, save.currentMatchday) };
}

/**
 * Restore a career from either save format. Version detection mirrors
 * `restoreSeason`: `version === 2` is a career snapshot (validated with
 * `CareerSaveSchema` so a corrupt payload fails loudly), `version === 1` is a
 * legacy season save that is migrated into a season-1 career.
 */
export function restoreCareer(save: AnySave, league: League): CareerState {
  if (save.leagueId !== league.id) {
    throw new Error(`Save is for league ${save.leagueId}, not ${league.id}`);
  }
  if (save.version === CAREER_SAVE_VERSION) {
    return restoreCareerV2(CareerSaveSchema.parse(save));
  }
  if (save.version === SAVE_VERSION) {
    return migrateSeasonSaveToCareer(save, league);
  }
  throw new Error(`Unsupported career save version: ${save.version}`);
}
