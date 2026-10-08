/**
 * Carrera de seleccionador (national-team manager career).
 *
 * A continuous career where the human manages ONE national team across editions
 * (ciclos). Each edition runs: convocatoria (pick a formation) → amistosos (warm-up
 * friendlies) → fase de clasificación (qualifying groups over the full national-team
 * pool) → and, if the team qualifies, the final tournament (reusing `runTournament`,
 * the very engine the standalone torneos use). Continuity carries history and
 * palmarés into the next cycle.
 *
 * Pure and deterministic — everything derives from the seed and the cycle and reuses
 * the league match engine (`buildCalendar`/`simulateFixture`/`computeStandings`) and
 * the knockout engine (`runTournament`). No React, no browser APIs: the store loads
 * the national-team database and hands this module the mapped `CompetitionTeam[]`
 * pool, exactly like `tournament.ts`. A career therefore replays identically.
 */
import { z } from 'zod';
import {
  buildCalendar,
  computeStandings,
  createRng,
  hashSeed,
  simulateFixture,
  simulateMatch,
  type CompetitionTeam,
  type MatchPlayer,
  type MatchResult,
  type StandingRow,
} from '@engine';
import {
  runTournament,
  teamProgress,
  TOURNAMENTS,
  type TournamentDef,
  type TournamentResult,
} from '../tournament';
import type { CareerTactics } from './types';

/** How many warm-up friendlies are played before the qualifying phase. */
export const FRIENDLY_COUNT = 2;

/** The points awarded for a win in a qualifying group (modern 3-points). */
const POINTS_FOR_WIN = 3;

/** The playable tournament id (`'euro2000' | 'mundial98'`). */
export type SeleccionTournamentId = TournamentDef['id'];

/** The phases one edition of a seleccion career moves through. */
export type SeleccionPhase = 'convocatoria' | 'amistosos' | 'clasificacion' | 'final' | 'fin';

/** Look up a tournament definition by id (throws if unknown). */
export function seleccionDef(id: SeleccionTournamentId): TournamentDef {
  const def = TOURNAMENTS.find((t) => t.id === id);
  if (!def) throw new Error(`Unknown tournament: ${id}`);
  return def;
}

/** The final tournament's field size (4 teams per finals group). */
export function finalsFieldSize(def: TournamentDef): number {
  return def.numGroups * 4;
}

/**
 * The number of qualifying groups: half the finals field, so the TOP TWO of every
 * qualifying group fill the finals exactly (euro: 8 groups → 16; mundial: 16 → 32).
 */
export function qualifyingGroupCount(def: TournamentDef): number {
  return finalsFieldSize(def) / 2;
}

const toScoreline = (r: MatchResult) => ({
  homeId: r.homeId,
  awayId: r.awayId,
  homeGoals: r.homeGoals,
  awayGoals: r.awayGoals,
});

/** Deterministic Fisher–Yates shuffle of ids (same primitive as tournament.ts). */
function shuffle(ids: readonly string[], seed: number): string[] {
  const rng = createRng(seed);
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    const a = arr[i]!;
    const b = arr[j]!;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

/**
 * Split ids into `groupCount` groups as evenly as possible (sizes differ by at most
 * one). Deterministic: a seeded shuffle then a round-robin deal into the groups.
 */
export function distributeGroups(
  ids: readonly string[],
  groupCount: number,
  seed: number,
): string[][] {
  if (groupCount < 1) throw new Error('groupCount must be >= 1');
  const shuffled = shuffle(ids, seed);
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  shuffled.forEach((id, i) => groups[i % groupCount]!.push(id));
  return groups;
}

/** Resolve a human convocatoria (formation + optional XI) onto a national team. */
function applyTactics(team: CompetitionTeam, tactics?: CareerTactics): CompetitionTeam {
  if (!tactics) return team;
  const xi =
    tactics.xiIds && tactics.xiIds.length === 11
      ? tactics.xiIds
          .map((id) => team.players.find((p) => p.id === id))
          .filter((p): p is MatchPlayer => p !== undefined)
      : undefined;
  return {
    ...team,
    tactics: { formation: tactics.formation, ...(xi && xi.length === 11 ? { xi } : {}) },
  };
}

/** A qualifying group: its nations, final table and the full (double round-robin) results. */
export interface QualifyingGroup {
  nationIds: string[];
  standings: StandingRow[];
  results: MatchResult[];
}

/** Play a single qualifying group (home-and-away) and return its final table. */
function runQualifyingGroup(
  nationIds: string[],
  byId: Map<string, CompetitionTeam>,
  seed: number,
): QualifyingGroup {
  const fixtures = buildCalendar(nationIds, seed); // double round-robin (ida/vuelta)
  const results: MatchResult[] = [];
  for (const f of fixtures) {
    const home = byId.get(f.homeId);
    const away = byId.get(f.awayId);
    if (!home || !away) throw new Error(`Unknown qualifying team: ${f.homeId} vs ${f.awayId}`);
    results.push(simulateFixture(home, away, seed, f));
  }
  const standings = computeStandings(nationIds, results.map(toScoreline), POINTS_FOR_WIN);
  return { nationIds, standings, results };
}

/** One warm-up friendly, from the human nation's perspective (always at home). */
export interface Friendly {
  opponentId: string;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  /** The full simulated match, so the UI can replay the teletipo. */
  match: MatchResult;
}

/** Pick `n` distinct ids from `pool` deterministically (seeded). */
function pickDistinct(pool: readonly string[], n: number, seed: number): string[] {
  return shuffle(pool, seed).slice(0, Math.min(n, pool.length));
}

/** Build the warm-up friendlies for this edition (do NOT affect qualification). */
function buildFriendlies(
  allIds: readonly string[],
  byId: Map<string, CompetitionTeam>,
  humanNationId: string,
  editionSeed: number,
): Friendly[] {
  const others = allIds.filter((id) => id !== humanNationId);
  const opponents = pickDistinct(others, FRIENDLY_COUNT, hashSeed(editionSeed, 'friendly-draw'));
  return opponents.map((opponentId, i) => {
    const home = byId.get(humanNationId)!;
    const away = byId.get(opponentId)!;
    const match = simulateMatch({ home, away, seed: hashSeed(editionSeed, 'friendly', i) });
    return {
      opponentId,
      homeId: humanNationId,
      awayId: opponentId,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      match,
    };
  });
}

/**
 * One fully-played edition of the career: the warm-up friendlies, the human's
 * qualifying group, who qualified, and (only if the human qualified) the final
 * tournament with the human's run. Derived purely from (seed, cycle, tactics); it
 * is never persisted — a load rebuilds it with `buildEdition`.
 */
export interface SeleccionEdition {
  cycle: number;
  tournamentId: SeleccionTournamentId;
  /** The final tournament's name, e.g. "Eurocopa 2000". */
  nombre: string;
  humanNationId: string;
  friendlies: Friendly[];
  /** The human's qualifying group (full detail: table + results). */
  group: QualifyingGroup;
  /** 1-indexed position the human finished in their qualifying group. */
  humanGroupPosition: number;
  /** True when the human finished in a qualifying slot (top two of their group). */
  qualified: boolean;
  /** Every qualified nation id (the finals field), in canonical sorted order. */
  qualifiedIds: string[];
  /** The final tournament, present only when the human qualified. */
  final?: TournamentResult;
  /** Human's finish label: a `teamProgress` phrase when qualified, else "No clasificado". */
  finish: string;
  /** True when the human won the final (drives the palmarés). */
  champion: boolean;
}

/** The human's "No clasificado" finish label when they miss the finals. */
export const NOT_QUALIFIED_FINISH = 'No clasificado';

/**
 * Build one complete edition of the career for a given cycle. Pure and deterministic:
 * the qualifying draw, every match and the final tournament all derive from the seed
 * and cycle. The human's convocatoria (`tactics`) is applied to THEIR national team in
 * every match they play (friendlies, qualifiers and finals), so a better formation/XI
 * genuinely improves their results.
 */
export function buildEdition(
  pool: readonly CompetitionTeam[],
  def: TournamentDef,
  humanNationId: string,
  seed: number,
  cycle: number,
  tactics?: CareerTactics,
): SeleccionEdition {
  if (!pool.some((t) => t.id === humanNationId)) {
    throw new Error(`Human nation not in pool: ${humanNationId}`);
  }
  const editionSeed = hashSeed(seed, 'seleccion', cycle);
  // Attach the convocatoria to the human's national team; rivals stay neutral.
  const byId = new Map(
    pool.map((t) => [t.id, t.id === humanNationId ? applyTactics(t, tactics) : t] as const),
  );
  const allIds = pool.map((t) => t.id);

  const friendlies = buildFriendlies(allIds, byId, humanNationId, editionSeed);

  // Qualification: draw the whole pool into groups, play them home-and-away, and
  // take the top two of each as the finals field.
  const groupCount = qualifyingGroupCount(def);
  const drawn = distributeGroups(allIds, groupCount, hashSeed(editionSeed, 'q-draw'));
  const groups = drawn.map((ids, i) => runQualifyingGroup(ids, byId, hashSeed(editionSeed, 'q-group', i)));
  const qualifiedIds = groups
    .flatMap((g) => g.standings.slice(0, 2).map((r) => r.teamId))
    .sort((a, b) => a.localeCompare(b));

  const humanGroupIndex = drawn.findIndex((ids) => ids.includes(humanNationId));
  const humanGroup = groups[humanGroupIndex]!;
  const humanGroupPosition =
    humanGroup.standings.findIndex((r) => r.teamId === humanNationId) + 1;
  const qualified = qualifiedIds.includes(humanNationId);

  let final: TournamentResult | undefined;
  let finish = NOT_QUALIFIED_FINISH;
  let champion = false;
  if (qualified) {
    const finalTeams = qualifiedIds.map((id) => byId.get(id)!);
    final = runTournament(finalTeams, hashSeed(editionSeed, 'finals'), def.numGroups, humanNationId);
    finish = teamProgress(final, humanNationId);
    champion = final.championId === humanNationId;
  }

  return {
    cycle,
    tournamentId: def.id,
    nombre: def.nombre,
    humanNationId,
    friendlies,
    group: humanGroup,
    humanGroupPosition,
    qualified,
    qualifiedIds,
    ...(final ? { final } : {}),
    finish,
    champion,
  };
}

/** A past edition's summary, kept in the career history. */
export interface SeleccionHistoryEntry {
  cycle: number;
  tournamentId: SeleccionTournamentId;
  nombre: string;
  qualified: boolean;
  finish: string;
  champion: boolean;
  /** The final's champion id (present only when a final was played). */
  championId?: string;
}

/** One title won in the career (the human was champion of a final). */
export interface SeleccionTitle {
  cycle: number;
  tournamentId: SeleccionTournamentId;
  nombre: string;
}

/**
 * The whole seleccion career. `edition` is DERIVED from (seed, cycle, tactics) and is
 * never persisted; `history` and `palmares` accumulate across cycles and ARE persisted
 * (mirroring how the club career persists its history/palmarés rather than re-deriving
 * them). `phase` tracks how far the human has progressed through the current edition.
 */
export interface SeleccionCareer {
  seed: number;
  humanNationId: string;
  tournamentId: SeleccionTournamentId;
  /** 1-indexed current edition number. */
  cycle: number;
  phase: SeleccionPhase;
  /** The human's convocatoria (formation + optional XI); absent means auto-XI 4-4-2. */
  tactics?: CareerTactics;
  edition: SeleccionEdition;
  history: SeleccionHistoryEntry[];
  palmares: SeleccionTitle[];
}

/** The ordered phases for an edition where the human DID qualify. */
const PHASES_QUALIFIED: readonly SeleccionPhase[] = [
  'convocatoria',
  'amistosos',
  'clasificacion',
  'final',
  'fin',
];
/** The ordered phases when the human did NOT qualify (the final is skipped). */
const PHASES_ELIMINATED: readonly SeleccionPhase[] = [
  'convocatoria',
  'amistosos',
  'clasificacion',
  'fin',
];

/** The phase order for the current edition (skips 'final' when not qualified). */
function phaseOrder(career: SeleccionCareer): readonly SeleccionPhase[] {
  return career.edition.qualified ? PHASES_QUALIFIED : PHASES_ELIMINATED;
}

/** Start a brand-new seleccion career at cycle 1, sitting in the convocatoria phase. */
export function newSeleccionCareer(
  pool: readonly CompetitionTeam[],
  def: TournamentDef,
  humanNationId: string,
  seed: number,
): SeleccionCareer {
  const cycle = 1;
  const edition = buildEdition(pool, def, humanNationId, seed, cycle, undefined);
  return {
    seed,
    humanNationId,
    tournamentId: def.id,
    cycle,
    phase: 'convocatoria',
    edition,
    history: [],
    palmares: [],
  };
}

/**
 * Set the convocatoria (formation + optional XI). Only allowed in the 'convocatoria'
 * phase — once the edition is under way, changing it would retroactively rewrite
 * already-played results (the club career locks staff the same way). Re-derives the
 * edition so the new tactics apply from the first friendly.
 */
export function setSeleccionTactics(
  career: SeleccionCareer,
  pool: readonly CompetitionTeam[],
  tactics: CareerTactics,
): SeleccionCareer {
  if (career.phase !== 'convocatoria') return career;
  const def = seleccionDef(career.tournamentId);
  const edition = buildEdition(pool, def, career.humanNationId, career.seed, career.cycle, tactics);
  return { ...career, tactics, edition };
}

/** Advance to the next phase of the current edition (a no-op once at 'fin'). */
export function advanceSeleccionPhase(career: SeleccionCareer): SeleccionCareer {
  const order = phaseOrder(career);
  const idx = order.indexOf(career.phase);
  const next = order[idx + 1];
  return next ? { ...career, phase: next } : career;
}

/**
 * Continuity: close the finished edition (summarise it into history, award a title if
 * the human was champion) and start the next cycle's edition in the convocatoria phase.
 * Only allowed once the current edition has reached 'fin'. The convocatoria carries over
 * as the starting default for the new cycle (still editable).
 */
export function nextSeleccionCycle(
  career: SeleccionCareer,
  pool: readonly CompetitionTeam[],
): SeleccionCareer {
  if (career.phase !== 'fin') return career;
  const finished = career.edition;
  const historyEntry: SeleccionHistoryEntry = {
    cycle: finished.cycle,
    tournamentId: finished.tournamentId,
    nombre: finished.nombre,
    qualified: finished.qualified,
    finish: finished.finish,
    champion: finished.champion,
    ...(finished.final ? { championId: finished.final.championId } : {}),
  };
  const palmares = finished.champion
    ? [
        ...career.palmares,
        { cycle: finished.cycle, tournamentId: finished.tournamentId, nombre: finished.nombre },
      ]
    : career.palmares;
  const cycle = career.cycle + 1;
  const def = seleccionDef(career.tournamentId);
  const edition = buildEdition(pool, def, career.humanNationId, career.seed, cycle, career.tactics);
  return {
    ...career,
    cycle,
    phase: 'convocatoria',
    edition,
    history: [...career.history, historyEntry],
    palmares,
  };
}

// --- Persistence: versioned snapshot + deterministic replay (mirrors save.ts) ---

const SELECCION_SAVE_VERSION = 1;

const FormationSchema = z.enum(['5-4-1', '5-3-2', '4-5-1', '4-4-2', '4-3-3', '3-5-2', '3-4-3']);
const TournamentIdSchema = z.enum(['euro2000', 'mundial98']);
const PhaseSchema = z.enum(['convocatoria', 'amistosos', 'clasificacion', 'final', 'fin']);

const TacticsSchema = z.object({
  formation: FormationSchema,
  xiIds: z.array(z.string()).optional(),
});

const HistoryEntrySchema = z.object({
  cycle: z.number().int().min(1),
  tournamentId: TournamentIdSchema,
  nombre: z.string().min(1),
  qualified: z.boolean(),
  finish: z.string().min(1),
  champion: z.boolean(),
  championId: z.string().optional(),
});

const TitleSchema = z.object({
  cycle: z.number().int().min(1),
  tournamentId: TournamentIdSchema,
  nombre: z.string().min(1),
});

export const SeleccionSaveSchema = z.object({
  version: z.literal(SELECCION_SAVE_VERSION),
  seed: z.number().int(),
  humanNationId: z.string().min(1),
  tournamentId: TournamentIdSchema,
  cycle: z.number().int().min(1),
  phase: PhaseSchema,
  tactics: TacticsSchema.optional(),
  history: z.array(HistoryEntrySchema).default([]),
  palmares: z.array(TitleSchema).default([]),
});
/** The validated save (history/palmarés always present after parsing). */
export type SeleccionSave = z.infer<typeof SeleccionSaveSchema>;
/** The accepted save INPUT (history/palmarés optional — the schema defaults them). */
export type SeleccionSaveInput = z.input<typeof SeleccionSaveSchema>;

/** Snapshot a seleccion career into a small, deterministic save. */
export function serializeSeleccion(career: SeleccionCareer): SeleccionSave {
  return {
    version: SELECCION_SAVE_VERSION,
    seed: career.seed,
    humanNationId: career.humanNationId,
    tournamentId: career.tournamentId,
    cycle: career.cycle,
    phase: career.phase,
    tactics: career.tactics,
    history: career.history,
    palmares: career.palmares,
  };
}

/**
 * Rebuild a seleccion career from a validated save. The in-progress edition is
 * re-derived with `buildEdition`, so a load reconstructs the live career exactly.
 * `pool` is the national-team field (the store loads the committed DB and maps it).
 */
export function restoreSeleccion(
  save: SeleccionSaveInput,
  pool: readonly CompetitionTeam[],
): SeleccionCareer {
  const parsed = SeleccionSaveSchema.parse(save);
  const def = seleccionDef(parsed.tournamentId);
  const edition = buildEdition(
    pool,
    def,
    parsed.humanNationId,
    parsed.seed,
    parsed.cycle,
    parsed.tactics,
  );
  return {
    seed: parsed.seed,
    humanNationId: parsed.humanNationId,
    tournamentId: parsed.tournamentId,
    cycle: parsed.cycle,
    phase: parsed.phase,
    tactics: parsed.tactics,
    edition,
    history: parsed.history,
    palmares: parsed.palmares,
  };
}
