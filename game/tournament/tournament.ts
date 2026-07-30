/**
 * Knockout tournament (national teams): a group stage followed by a single-
 * elimination bracket. Pure and deterministic — everything derives from the seed
 * and reuses the league match engine, so a tournament replays identically.
 *
 * Tuned for the classic 16-team format (4 groups of 4, top 2 advance), but the
 * group runner and bracket are generic.
 */
import {
  buildCalendar,
  simulateFixture,
  simulateMatch,
  computeStandings,
  createRng,
  hashSeed,
  type CompetitionTeam,
  type MatchResult,
  type StandingRow,
} from '@engine';

/** The 16 finalists of Euro 2000, by their national-team id in the database. */
export const EURO2000_FINALIST_IDS: readonly string[] = [
  'alemania',
  'rumania',
  'portugal',
  'inglaterra',
  'belgica',
  'suecia',
  'italia',
  'turquia',
  'espana',
  'noruega',
  'yugoslavia',
  'eslovenia',
  'francia',
  'dinamarca',
  'holanda',
  'r-checa',
];

/** The 32 finalists of the 1998 World Cup, by their national-team id. */
export const MUNDIAL98_FINALIST_IDS: readonly string[] = [
  'brasil', 'francia', 'italia', 'alemania', 'argentina', 'holanda', 'espana', 'inglaterra',
  'rumania', 'croacia', 'yugoslavia', 'dinamarca', 'nigeria', 'paraguay', 'mexico', 'chile',
  'estados-unidos', 'colombia', 'marruecos', 'noruega', 'belgica', 'sudafrica', 'arabia-saudi', 'iran',
  'japon', 'corea-del-sur', 'austria', 'escocia', 'bulgaria', 'camerun', 'tunez', 'jamaica',
];

/** A playable tournament: which national-team database, finalists and format. */
export interface TournamentDef {
  id: 'euro2000' | 'mundial98';
  nombre: string;
  /** The committed national-team database id (for the store to load). */
  dbId: string;
  finalistIds: readonly string[];
  numGroups: number;
}

export const TOURNAMENTS: readonly TournamentDef[] = [
  { id: 'euro2000', nombre: 'Eurocopa 2000', dbId: 'seleccion-euro2000', finalistIds: EURO2000_FINALIST_IDS, numGroups: 4 },
  { id: 'mundial98', nombre: 'Mundial 98', dbId: 'seleccion-mundial98', finalistIds: MUNDIAL98_FINALIST_IDS, numGroups: 8 },
];

/** How far a team got in a finished tournament (for the summary line). */
export function teamProgress(result: TournamentResult, teamId: string): string {
  if (result.championId === teamId) return 'Campeón';
  // In single elimination a team loses exactly once — find that round.
  for (const round of result.knockout) {
    const tie = round.ties.find((t) => t.homeId === teamId || t.awayId === teamId);
    if (tie && tie.winnerId !== teamId) {
      return round.nombre === 'final' ? 'Subcampeón' : `Eliminado en ${round.nombre}`;
    }
  }
  return 'Fase de grupos';
}

const toScoreline = (r: MatchResult) => ({
  homeId: r.homeId,
  awayId: r.awayId,
  homeGoals: r.homeGoals,
  awayGoals: r.awayGoals,
});

export interface GroupResult {
  teamIds: string[];
  standings: StandingRow[];
  results: MatchResult[];
}

/** One knockout tie and who went through. */
export interface KnockoutTie {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  winnerId: string;
  /** True when the tie was level and decided by a penalty shootout. */
  onPenalties: boolean;
}

export interface KnockoutRound {
  /** Round name: "cuartos" | "semifinales" | "final" (or "ronda-N"). */
  nombre: string;
  ties: KnockoutTie[];
}

export interface TournamentResult {
  groups: GroupResult[];
  knockout: KnockoutRound[];
  championId: string;
}

/** Deterministic Fisher–Yates shuffle of ids. */
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

/** Split shuffled teams into `numGroups` groups of equal size. */
export function drawGroups(teamIds: readonly string[], numGroups: number, seed: number): string[][] {
  const shuffled = shuffle(teamIds, hashSeed(seed, 'draw'));
  const perGroup = Math.floor(shuffled.length / numGroups);
  const groups: string[][] = [];
  for (let g = 0; g < numGroups; g += 1) {
    groups.push(shuffled.slice(g * perGroup, (g + 1) * perGroup));
  }
  return groups;
}

/** Play a single round-robin group and return its final table. */
function runGroup(teamIds: string[], byId: Map<string, CompetitionTeam>, seed: number): GroupResult {
  // buildCalendar is a double round-robin (like a league); a group is single, so
  // keep only the first N-1 rounds — a complete single round-robin.
  const singleRounds = teamIds.length - 1;
  const fixtures = buildCalendar(teamIds, seed).filter((f) => f.round <= singleRounds);
  const results: MatchResult[] = [];
  for (const f of fixtures) {
    const home = byId.get(f.homeId);
    const away = byId.get(f.awayId);
    if (!home || !away) throw new Error(`Unknown group team: ${f.homeId} vs ${f.awayId}`);
    results.push(simulateFixture(home, away, seed, f));
  }
  const standings = computeStandings(teamIds, results.map(toScoreline), 3);
  return { teamIds, standings, results };
}

/** Play one knockout tie; a level score is settled by a seeded shootout. */
function playTie(homeId: string, awayId: string, byId: Map<string, CompetitionTeam>, seed: number): KnockoutTie {
  const home = byId.get(homeId);
  const away = byId.get(awayId);
  if (!home || !away) throw new Error(`Unknown knockout team: ${homeId} vs ${awayId}`);
  const r = simulateMatch({ home, away, seed });
  let winnerId: string;
  let onPenalties = false;
  if (r.homeGoals > r.awayGoals) winnerId = homeId;
  else if (r.awayGoals > r.homeGoals) winnerId = awayId;
  else {
    onPenalties = true;
    winnerId = createRng(hashSeed(seed, 'pens')).next01() < 0.5 ? homeId : awayId;
  }
  return { homeId, awayId, homeGoals: r.homeGoals, awayGoals: r.awayGoals, winnerId, onPenalties };
}

const ROUND_NAMES: Record<number, string> = { 2: 'final', 4: 'semifinales', 8: 'cuartos', 16: 'octavos' };
const roundName = (n: number): string => ROUND_NAMES[n] ?? `ronda-${n}`;

/**
 * Order the group qualifiers into a bracket. For the canonical 4-group format
 * this is the real cross-pairing (1A-2B, 1B-2A, 1C-2D, 1D-2C); otherwise winners
 * are simply paired against runners-up.
 */
function bracketOrder(winners: string[], runners: string[]): string[] {
  if (winners.length === 4 && runners.length === 4) {
    return [winners[0]!, runners[1]!, winners[1]!, runners[0]!, winners[2]!, runners[3]!, winners[3]!, runners[2]!];
  }
  const order: string[] = [];
  for (let i = 0; i < winners.length; i += 1) {
    order.push(winners[i]!, runners[i % runners.length]!);
  }
  return order;
}

/**
 * Run a full tournament: draw groups, play them, take the top two of each, then
 * a single-elimination bracket to the champion.
 */
export function runTournament(
  teams: readonly CompetitionTeam[],
  seed: number,
  numGroups = 4,
): TournamentResult {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const groupsIds = drawGroups(teams.map((t) => t.id), numGroups, seed);

  const groups = groupsIds.map((ids, i) => runGroup(ids, byId, hashSeed(seed, 'group', i)));

  const winners = groups.map((g) => g.standings[0]!.teamId);
  const runners = groups.map((g) => g.standings[1]!.teamId);
  let alive = bracketOrder(winners, runners);

  const knockout: KnockoutRound[] = [];
  let round = 0;
  while (alive.length > 1) {
    const ties: KnockoutTie[] = [];
    for (let i = 0; i < alive.length; i += 2) {
      ties.push(playTie(alive[i]!, alive[i + 1]!, byId, hashSeed(seed, 'ko', round, i)));
    }
    knockout.push({ nombre: roundName(alive.length), ties });
    alive = ties.map((t) => t.winnerId);
    round += 1;
  }

  return { groups, knockout, championId: alive[0]! };
}
