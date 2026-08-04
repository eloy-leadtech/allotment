import { z } from 'zod';
import { PlayerSchema, TeamColorsSchema, type League } from '@data';
import { advanceMatchday, isSeasonOver, newSeason, type SeasonState } from '../season/season';
import { newCareer, seasonFromCareer } from '../career/career';
import { computeSeasonObjective, type BoardState } from '../career/board';
import { DEFAULT_CONFIANZA, type ConfianzaState } from '../career/confianza';
import { initialContracts, type Contract } from '../career/contracts';
import { seasonStartYear } from '../career/development';
import { DEFAULT_TRAINING_FOCUS } from '../career/training';
import { DEFAULT_STADIUM, MAX_STADIUM_LEVEL } from '../career/stadium';
import { DEFAULT_SPONSOR } from '../career/sponsors';
import { DEFAULT_CREDIT } from '../career/credit';
import { DEFAULT_LOANS } from '../career/loans';
import { DEFAULT_WINTER } from '../career/winterMovements';
import { replaySeasonCareer } from '../career/winterMarket';
import type { CareerState, CareerTeam, PalmaresTitle, PressState, SeasonSummary } from '../career/types';

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

/** Season top scorer (Pichichi); optional so pre-trophies saves still load. */
const PichichiSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  teamId: z.string().min(1),
  goals: z.number().int().min(0),
});

/** Season least-conceded keeper (Zamora); optional for pre-trophies saves. */
const ZamoraSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  teamId: z.string().min(1),
  goalsConceded: z.number().int().min(0),
  matches: z.number().int().min(0),
});

const SeasonSummarySchema = z.object({
  seasonNumber: z.number().int(),
  temporada: z.string().min(1),
  championId: z.string().min(1),
  pichichi: PichichiSchema.optional(),
  zamora: ZamoraSchema.optional(),
});

/** One palmarés title: the competition won and the season it was won in. */
const PalmaresTitleSchema = z.object({
  competition: z.enum(['liga', 'copa', 'champions', 'uefa']),
  seasonNumber: z.number().int().min(1),
  temporada: z.string().min(1),
  division: z.enum(['primera', 'segunda']).optional(),
});

/** A squad contract: annual salary and full seasons remaining. */
const ContractSchema = z.object({
  salary: z.number().int().min(0),
  yearsLeft: z.number().int().min(1),
});

/** A player away on loan: his snapshot + set-aside deal, the club and season. */
const LoanedOutSchema = z.object({
  player: PlayerSchema,
  contract: ContractSchema,
  toClubId: z.string().min(1),
  seasonNumber: z.number().int().min(1),
});

/** The club's loan book; defaults to empty for pre-cesiones saves. */
const LoansStateSchema = z
  .object({
    out: z.array(LoanedOutSchema).default([]),
    in: z.array(z.string()).default([]),
  })
  .default({ out: [], in: [] });

/** One winter-window transfer: a player moving between two clubs at the midpoint. */
const WinterMovementSchema = z.object({
  playerId: z.string().min(1),
  fromClubId: z.string().min(1),
  toClubId: z.string().min(1),
});

/** The winter transfer window's state; defaults to untouched for pre-invierno saves. */
const WinterStateSchema = z
  .object({
    movements: z.array(WinterMovementSchema).default([]),
    closed: z.boolean().default(false),
  })
  .default({ ...DEFAULT_WINTER });

/** A youth-academy prospect: its full player data plus its entry season. */
const YouthProspectSchema = z.object({
  player: PlayerSchema,
  entrySeason: z.number().int().min(1),
});

/** A rival-scouting record: how many times and when the player was ojeado. */
const ScoutingRecordSchema = z.object({
  observations: z.number().int().min(0),
  lastSeason: z.number().int().min(0),
});

const BoardObjectiveSchema = z.object({
  type: z.enum(['title', 'europe', 'promotion', 'mid-table', 'avoid-relegation']),
  targetPosition: z.number().int().min(1),
});

const BoardStateSchema = z.object({
  objective: BoardObjectiveSchema,
  lastEvaluation: z
    .object({
      satisfaction: z.enum(['contento', 'normal', 'enfadado']),
      dismissed: z.boolean(),
      shortfall: z.number().int(),
    })
    .optional(),
});

/** The two institutional confidence meters; defaults to 50/50 for pre-confianza saves. */
const ConfianzaSchema = z.object({
  directiva: z.number().int().min(0).max(100),
  aficion: z.number().int().min(0).max(100),
});

/** One press-conference decision: the matchday, question and chosen option. */
const PressAnswerSchema = z.object({
  matchday: z.number().int().min(1),
  questionId: z.string().min(1),
  optionId: z.string().min(1),
});

/** The season's press-conference decisions; defaults to none for pre-rueda saves. */
const PressStateSchema = z.object({
  answers: z.array(PressAnswerSchema).default([]),
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
  /** Board objective + last verdict; absent in pre-board saves (recomputed on load). */
  board: BoardStateSchema.optional(),
  /** Institutional confidence meters; absent in pre-confianza saves (defaults 50/50 on load). */
  confianza: ConfianzaSchema.optional(),
  /** Press-conference decisions this season; defaults to none for pre-rueda saves. */
  press: PressStateSchema.default({ answers: [] }),
  /** Human's tactics; absent means neutral auto-XI. */
  tactics: z
    .object({
      formation: z.enum(['5-4-1', '5-3-2', '4-5-1', '4-4-2', '3-5-2', '4-3-3', '3-4-3']),
      xiIds: z.array(z.string()).optional(),
    })
    .optional(),
  /** Human's training focus; absent in pre-training saves (defaults on load). */
  training: z
    .object({ focus: z.enum(['ataque', 'defensa', 'fisico', 'equilibrado']) })
    .optional(),
  /** Human club's transfer budget; defaults to 0 for pre-market saves. */
  budget: z.number().int().min(0).default(0),
  /** Human club's stadium; defaults to the base ground for pre-estadio saves. */
  stadium: z
    .object({ capacityLevel: z.number().int().min(0).max(MAX_STADIUM_LEVEL) })
    .default({ ...DEFAULT_STADIUM }),
  /** Human club's chosen sponsor; defaults to the basic tier for pre-patrocinios saves. */
  sponsor: z
    .object({ sponsorId: z.enum(['basico', 'estandar', 'ambicioso', 'premium']) })
    .default({ ...DEFAULT_SPONSOR }),
  /** Human club's bank/board credit and debt; defaults to debt-free for pre-crédito saves. */
  credit: z
    .object({
      loan: z.number().int().min(0),
      seasonsOverLimit: z.number().int().min(0),
    })
    .default({ ...DEFAULT_CREDIT }),
  /** Loan book (out/in); defaults to empty for pre-cesiones saves. */
  loans: LoansStateSchema,
  /** Winter transfer window (movements + closed); defaults to untouched for pre-invierno saves. */
  winter: WinterStateSchema,
  teams: z.array(CareerTeamSchema).min(2),
  /** Squad contracts by player id; defaults to {} for pre-contract saves (recomputed on load). */
  contracts: z.record(z.string(), ContractSchema).default({}),
  /** Youth-academy prospects; defaults to [] for pre-cantera saves. */
  youthProspects: z.array(YouthProspectSchema).default([]),
  /** Rival-scouting reports by player id; defaults to {} for pre-ojeo saves. */
  scouting: z.record(z.string(), ScoutingRecordSchema).default({}),
  history: z.array(SeasonSummarySchema),
  /** The club's palmarés; defaults to [] for pre-palmarés saves. */
  palmares: z.array(PalmaresTitleSchema).default([]),
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
  const palmares: PalmaresTitle[] = career.palmares;
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
    board: career.board,
    confianza: career.confianza ?? DEFAULT_CONFIANZA,
    press: career.press ?? { answers: [] },
    tactics: career.tactics,
    training: career.training,
    budget: career.budget,
    stadium: career.stadium,
    sponsor: career.sponsor ?? DEFAULT_SPONSOR,
    credit: career.credit ?? DEFAULT_CREDIT,
    loans: career.loans ?? DEFAULT_LOANS,
    winter: career.winter ?? DEFAULT_WINTER,
    teams,
    contracts: career.contracts,
    youthProspects: career.youthProspects,
    scouting: career.scouting,
    history,
    palmares,
    // The in-progress season is derived from `teams`; only its resume point is saved.
    currentMatchday: career.season.currentMatchday,
  };
}

/** Rebuild the full CareerState from a validated v2 save (self-contained snapshot). */
function restoreCareerV2(save: CareerSave): CareerState {
  // Pre-board saves have no objective persisted: recompute it deterministically
  // from the snapshotted squads so the board relationship is always present.
  const board: BoardState = save.board ?? {
    objective: computeSeasonObjective({
      teams: save.teams,
      division: save.division,
      humanTeamId: save.humanTeamId,
      relegationSpots: save.relegationSpots,
    }),
  };
  // Pre-contract saves have no wage book: recompute deterministic initial deals
  // from the snapshotted squad so the masa salarial is always present on load.
  const humanPlayers = save.teams.find((t) => t.id === save.humanTeamId)?.players ?? [];
  const contracts: Record<string, Contract> =
    Object.keys(save.contracts).length > 0
      ? save.contracts
      : initialContracts(humanPlayers, save.seed, save.seasonNumber, seasonStartYear(save.temporada));
  const press: PressState = save.press ?? { answers: [] };
  // Pre-confianza saves have no meters persisted: default to a neutral 50/50.
  const confianza: ConfianzaState = save.confianza ?? DEFAULT_CONFIANZA;
  const meta: Omit<CareerState, 'season' | 'history' | 'palmares'> = {
    seed: save.seed,
    leagueId: save.leagueId,
    humanTeamId: save.humanTeamId,
    seasonNumber: save.seasonNumber,
    temporada: save.temporada,
    pointsForWin: save.pointsForWin,
    relegationSpots: save.relegationSpots,
    division: save.division,
    board,
    confianza,
    press,
    tactics: save.tactics,
    // Pre-training saves default to a balanced focus so training is always present.
    training: save.training ?? { focus: DEFAULT_TRAINING_FOCUS },
    budget: save.budget,
    // Pre-estadio saves default to the base ground so the stadium is always present.
    stadium: save.stadium ?? DEFAULT_STADIUM,
    // Pre-patrocinios saves default to the basic sponsor so it is always present.
    sponsor: save.sponsor ?? DEFAULT_SPONSOR,
    // Pre-crédito saves default to debt-free so the credit state is always present.
    credit: save.credit ?? DEFAULT_CREDIT,
    // Pre-cesiones saves have no loan book: default to empty (schema default).
    loans: save.loans,
    // Pre-invierno saves have no winter window: default to untouched (schema default).
    winter: save.winter,
    teams: save.teams,
    contracts,
    youthProspects: save.youthProspects,
    // Pre-ojeo saves have no scouting reports: default to none (schema default {}).
    scouting: save.scouting,
  };
  // Interleave the persisted press morale bumps AND the winter roster swap back into
  // the replay so a loaded career reconstructs the live one exactly. `seasonFromCareer`
  // rebuilds the pre-winter fresh season; the replay re-applies the movements at the
  // window matchday. With no answers or movements this is a plain matchday replay.
  const season = replaySeasonCareer(
    seasonFromCareer(meta),
    save.currentMatchday,
    save.humanTeamId,
    meta.tactics,
    press.answers,
    meta.winter,
  );
  return { ...meta, season, history: save.history, palmares: save.palmares };
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
