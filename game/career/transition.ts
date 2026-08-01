/**
 * Historical season transition with KEEP/RELEASE decisions — the heart of
 * "the world follows history, but your team is yours".
 *
 * When you advance to the next season, every AI club adopts its REAL roster for
 * that year. Your club is different: the players history would take away are
 * shown to you, and you may RETAIN any of them (they stay, aged one season, and
 * are removed from the club history sent them to, so nobody is duplicated).
 * Incoming historical transfers to your club are accepted by default, keeping
 * your squad realistic.
 *
 * Pure and deterministic: retained players age via the seeded development curve.
 */
import { computeSeasonAwards, computeStandings, type StandingRow } from '@engine';
import type { League, Player } from '@data';
import type { CareerState, CareerTeam } from './types';
import { seasonFromCareer } from './career';
import { developPlayer, seasonStartYear } from './development';
import { advanceContracts } from './contracts';
import { currentStandings } from '../season/season';
import { humanFate, type Division, type PromotionOutcome } from './promotion';
import { rolloverYouth } from './cantera';
import { titlesWonThisSeason } from './palmares';
import { returnLoans, DEFAULT_LOANS } from './loans';
import {
  computeSeasonObjective,
  evaluateObjective,
  type BoardState,
  type ObjectiveEvaluation,
} from './board';

/** Club-independent identity for the same real person across seasons/clubs. */
function personKey(p: Player): string {
  return `${p.nombreCompleto}|${p.fechaNacimiento ?? '?'}`;
}

/** Turn a next-year real League into career teams (full player data). */
function worldTeams(nextWorld: League): CareerTeam[] {
  return nextWorld.equipos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    colores: t.colores,
    players: t.jugadores,
  }));
}

/** The winner of the just-finished season (current leader if unfinished). */
function championOf(career: CareerState): string {
  const table: StandingRow[] = computeStandings(
    career.season.teams.map((t) => t.id),
    career.season.results.map((r) => ({
      homeId: r.homeId,
      awayId: r.awayId,
      homeGoals: r.homeGoals,
      awayGoals: r.awayGoals,
    })),
    career.season.pointsForWin,
  );
  return table[0]?.teamId ?? career.humanTeamId;
}

/** The human's final league position (1-indexed) in the just-finished season. */
function humanPosition(career: CareerState): number {
  const table = currentStandings(career.season);
  const idx = table.findIndex((r) => r.teamId === career.humanTeamId);
  return idx < 0 ? table.length : idx + 1;
}

/** The finished-season history line, including the human's finish (for Europe). */
function finishedSummary(career: CareerState, championId: string) {
  // Individual trophies are derived from the season's results/rosters at the
  // moment it closes, so the palmarés can show each season's Pichichi/Zamora.
  const awards = computeSeasonAwards(career.season.results, career.season.teams);
  return {
    seasonNumber: career.seasonNumber,
    temporada: career.temporada,
    championId,
    division: career.division,
    humanPosition: humanPosition(career),
    pichichi: awards.pichichi ?? undefined,
    zamora: awards.zamora ?? undefined,
  };
}

/**
 * The board state for the NEXT season: a fresh objective from the incoming
 * squads/division plus the board's verdict on the season just finished (compared
 * against the objective that WAS set for it).
 */
function nextBoardState(
  finishedCareer: CareerState,
  nextTeams: readonly CareerTeam[],
  division: Division,
  relegationSpots: number,
): BoardState {
  return {
    objective: computeSeasonObjective({
      teams: nextTeams,
      division,
      humanTeamId: finishedCareer.humanTeamId,
      relegationSpots,
    }),
    lastEvaluation: evaluateObjective(
      finishedCareer.board.objective,
      humanPosition(finishedCareer),
      careerOutcome(finishedCareer),
    ),
  };
}

export interface TransitionPreview {
  temporadaActual: string;
  temporadaSiguiente: string;
  championId: string;
  /** Your current players history would take away (candidates to RETAIN). */
  departures: Player[];
  /** Players history brings to your club next year (accepted by default). */
  arrivals: Player[];
}

/** Your club's real roster for the next season, or [] if the club is absent. */
function yourNextReal(nextWorld: League, humanTeamId: string): Player[] {
  return nextWorld.equipos.find((t) => t.id === humanTeamId)?.jugadores ?? [];
}

/**
 * Preview the historical transition for the human club: who would leave (to
 * retain) and who would arrive. Read-only; makes no decisions.
 */
export function previewTransition(career: CareerState, nextWorld: League): TransitionPreview {
  const current = career.teams.find((t) => t.id === career.humanTeamId)?.players ?? [];
  const nextReal = yourNextReal(nextWorld, career.humanTeamId);
  const nextIds = new Set(nextReal.map((p) => p.id));
  const currentIds = new Set(current.map((p) => p.id));
  return {
    temporadaActual: career.temporada,
    temporadaSiguiente: nextWorld.temporada,
    championId: championOf(career),
    departures: current.filter((p) => !nextIds.has(p.id)),
    arrivals: nextReal.filter((p) => !currentIds.has(p.id)),
  };
}

/**
 * Advance the career one season into the real `nextWorld`.
 *
 * - AI clubs adopt their real next-year roster.
 * - Your club = your real next-year roster + the departures you chose to RETAIN
 *   (aged one season via the development curve; retirees drop out). Retained
 *   players are removed from whichever club history sent them to (no duplicates).
 *
 * `retainIds` holds current-squad player ids to keep. Ids not among the actual
 * departures are ignored.
 */
export function applyTransition(
  career: CareerState,
  nextWorld: League,
  retainIds: ReadonlySet<string>,
): CareerState {
  if (nextWorld.competicion.kind !== 'league') {
    throw new Error('applyTransition supports league competitions only');
  }
  // If your club isn't in the real next league (you kept it up against history,
  // or the season datasets don't share the same clubs), carry your whole squad
  // in — same division — instead of losing every player as a "departure".
  if (!nextWorld.equipos.some((t) => t.id === career.humanTeamId)) {
    return applyDivisionChange(career, career.division, nextWorld);
  }
  const seasonNumberNext = career.seasonNumber + 1;
  const temporadaNext = nextWorld.temporada;
  const startYear = seasonStartYear(temporadaNext);

  const preview = previewTransition(career, nextWorld);
  const retained = preview.departures.filter((p) => retainIds.has(p.id));

  // Age each retained player one season; drop those who retire. Retained players
  // are yours, so this season's training focus shapes how they evolve.
  const developedRetained: Player[] = [];
  for (const player of retained) {
    const result = developPlayer(player, {
      seed: career.seed,
      seasonNumber: seasonNumberNext,
      seasonStartYear: startYear,
      training: career.training?.focus,
    });
    if (!result.retired) developedRetained.push(result.player);
  }
  const retainedKeys = new Set(retained.map(personKey));

  const base = worldTeams(nextWorld);
  const rawTeams: CareerTeam[] = base.map((team) => {
    if (team.id === career.humanTeamId) {
      // Your real next roster plus the retained (aged) players.
      return { ...team, players: [...team.players, ...developedRetained] };
    }
    // Remove any retained player history would have moved to this club.
    if (retainedKeys.size === 0) return team;
    return { ...team, players: team.players.filter((p) => !retainedKeys.has(personKey(p))) };
  });

  // Tick every deal down a season: expired players leave FREE, new arrivals are
  // handed a fresh contract, so your wage book always matches your squad.
  const humanRaw = rawTeams.find((t) => t.id === career.humanTeamId)?.players ?? [];
  const advance = advanceContracts(humanRaw, career.contracts, {
    seed: career.seed,
    seasonNumber: seasonNumberNext,
    seasonStartYear: startYear,
  });
  const rebuiltTeams: CareerTeam[] = rawTeams.map((team) =>
    team.id === career.humanTeamId ? { ...team, players: advance.players } : team,
  );

  // Players you loaned out come home now — aged a season, deal restored — while
  // players brought in on loan are dropped by the real-world rebuild above. With
  // an empty loan book this is a no-op.
  const returned = returnLoans(career.loans, rebuiltTeams, advance.contracts, {
    seed: career.seed,
    seasonNumber: seasonNumberNext,
    seasonStartYear: startYear,
    training: career.training?.focus,
    humanTeamId: career.humanTeamId,
  });
  const teams = returned.teams;

  const meta = {
    seed: career.seed,
    leagueId: nextWorld.id,
    humanTeamId: career.humanTeamId,
    seasonNumber: seasonNumberNext,
    temporada: temporadaNext,
    pointsForWin: nextWorld.competicion.pointsForWin,
    relegationSpots: nextWorld.competicion.relegationSpots,
    // Same-division advance keeps the human where they were.
    division: career.division,
    board: nextBoardState(career, teams, career.division, nextWorld.competicion.relegationSpots),
    // The training focus carries into the next season (the manager may change it).
    training: career.training,
    // Budget carries over untouched; the market phase is what moves it.
    budget: career.budget,
    // The stadium you built stays yours into the next season.
    stadium: career.stadium,
    // The sponsor tier you signed carries forward (you can change it each season).
    sponsor: career.sponsor,
    // Loans are settled by this transition (returnees folded in, loanees dropped):
    // the next season starts with an empty loan book.
    loans: DEFAULT_LOANS,
    teams,
    contracts: returned.contracts,
    // Age out overstaying prospects and breed the new pretemporada hornada.
    youthProspects: rolloverYouth(career.youthProspects, {
      seed: career.seed,
      seasonNumber: seasonNumberNext,
      temporada: temporadaNext,
      humanTeamId: career.humanTeamId,
    }),
    // Your scouting reports are a decision: they carry forward and keep deepening.
    scouting: career.scouting,
  };

  return {
    ...meta,
    season: seasonFromCareer(meta),
    history: [...career.history, finishedSummary(career, preview.championId)],
    // Record any title the human won this season before advancing.
    palmares: [...career.palmares, ...titlesWonThisSeason(career, preview.championId)],
  };
}

// --- Promotion / relegation (two-division career) --------------------------

/** Standard promotion and relegation places for the career pyramid. */
export const RELEGATION_PLACES = 3;
export const PROMOTION_PLACES = 3;

/**
 * The board's verdict on the in-progress (finished) season: compares the human's
 * real final position and promotion/relegation outcome against the objective the
 * board set for it. Drives the season-end satisfaction banner and the dismissal
 * decision, and matches the `lastEvaluation` the next season carries forward.
 */
export function endOfSeasonEvaluation(career: CareerState): ObjectiveEvaluation {
  return evaluateObjective(
    career.board.objective,
    humanPosition(career),
    careerOutcome(career),
  );
}

/** The human's promotion/relegation outcome from their division's final table. */
export function careerOutcome(career: CareerState): PromotionOutcome {
  return humanFate({
    division: career.division,
    standings: currentStandings(career.season),
    humanTeamId: career.humanTeamId,
    relegationSpots: RELEGATION_PLACES,
    promotionSpots: PROMOTION_PLACES,
  });
}

/**
 * Advance the career when the human CHANGES division (promoted or relegated).
 * The whole squad moves with you — aged one season, retirees dropped — into the
 * real target division; the other clubs there are the real ones for that year.
 * There is no KEEP/RELEASE diff: you keep your team, you only change division.
 * Your players are removed from any real club history put them in (no dupes).
 */
export function applyDivisionChange(
  career: CareerState,
  targetDivision: Division,
  targetLeague: League,
): CareerState {
  if (targetLeague.competicion.kind !== 'league') {
    throw new Error('applyDivisionChange supports league competitions only');
  }
  const seasonNumberNext = career.seasonNumber + 1;
  const temporadaNext = targetLeague.temporada;
  const startYear = seasonStartYear(temporadaNext);

  const humanTeam = career.teams.find((t) => t.id === career.humanTeamId);
  const current = humanTeam?.players ?? [];
  const humanNombre = humanTeam?.nombre ?? career.humanTeamId;

  // The whole squad moves with you, aged one season; retirees drop out. It is
  // your squad, so this season's training focus shapes how it evolves.
  const aged: Player[] = [];
  for (const player of current) {
    const result = developPlayer(player, {
      seed: career.seed,
      seasonNumber: seasonNumberNext,
      seasonStartYear: startYear,
      training: career.training?.focus,
    });
    if (!result.retired) aged.push(result.player);
  }
  const humanKeys = new Set(current.map(personKey));

  // Tick every deal down a season alongside the squad's move up/down a division.
  const advance = advanceContracts(aged, career.contracts, {
    seed: career.seed,
    seasonNumber: seasonNumberNext,
    seasonStartYear: startYear,
  });

  let humanPresent = false;
  const rebuiltTeams: CareerTeam[] = worldTeams(targetLeague).map((team) => {
    if (team.id === career.humanTeamId) {
      humanPresent = true;
      return { ...team, players: advance.players };
    }
    return { ...team, players: team.players.filter((p) => !humanKeys.has(personKey(p))) };
  });
  if (!humanPresent) {
    rebuiltTeams.push({ id: career.humanTeamId, nombre: humanNombre, players: advance.players });
  }

  // Loanees return (aged, deal restored) even across a division change; players
  // brought in on loan are dropped by the rebuild. No-op with an empty loan book.
  const returned = returnLoans(career.loans, rebuiltTeams, advance.contracts, {
    seed: career.seed,
    seasonNumber: seasonNumberNext,
    seasonStartYear: startYear,
    training: career.training?.focus,
    humanTeamId: career.humanTeamId,
  });
  const teams = returned.teams;

  const meta = {
    seed: career.seed,
    leagueId: targetLeague.id,
    humanTeamId: career.humanTeamId,
    seasonNumber: seasonNumberNext,
    temporada: temporadaNext,
    pointsForWin: targetLeague.competicion.pointsForWin,
    relegationSpots: targetLeague.competicion.relegationSpots,
    division: targetDivision,
    board: nextBoardState(career, teams, targetDivision, targetLeague.competicion.relegationSpots),
    // The training focus carries into the next season (the manager may change it).
    training: career.training,
    budget: career.budget,
    // The stadium you built moves with you across divisions.
    stadium: career.stadium,
    // The sponsor tier you signed carries forward across divisions too.
    sponsor: career.sponsor,
    // The loan book is settled by the transition; start clean.
    loans: DEFAULT_LOANS,
    teams,
    contracts: returned.contracts,
    // Age out overstaying prospects and breed the new pretemporada hornada.
    youthProspects: rolloverYouth(career.youthProspects, {
      seed: career.seed,
      seasonNumber: seasonNumberNext,
      temporada: temporadaNext,
      humanTeamId: career.humanTeamId,
    }),
    // Your scouting reports are a decision: they carry forward and keep deepening.
    scouting: career.scouting,
  };
  const champ = championOf(career);
  return {
    ...meta,
    season: seasonFromCareer(meta),
    history: [...career.history, finishedSummary(career, champ)],
    // Record any title the human won this season before changing division.
    palmares: [...career.palmares, ...titlesWonThisSeason(career, champ)],
  };
}
