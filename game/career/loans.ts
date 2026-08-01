/**
 * Cesiones (préstamos): loaning players OUT for a season and bringing players IN
 * on loan, a faithful nod to the classic PC Fútbol "PEDIR CESIÓN" flow.
 *
 * Two moves, both only in the pre-season transfer window (like compraventa):
 *
 *  - CEDER (out-loan): send one of your squad players away for the upcoming
 *    season. He does NOT count for your XI that season (he is removed from the
 *    squad), you SAVE his ficha/sueldo (his contract is set aside, off the wage
 *    bill) and you pocket a small COMISIÓN. He RETURNS the following season, aged
 *    one year, with his deal restored (see `returnLoans`, called at the
 *    transition).
 *
 *  - INCORPORAR CEDIDO (in-loan): sign an AI club's player on loan for this
 *    season only. It is CHEAPER than buying (a small loan fee, not a transfer),
 *    he is available all season, and he LEAVES when the season ends — modelled as
 *    a 1-season contract, so the normal season rebuild simply drops him.
 *
 * Pure and deterministic: loan offers and fees derive only from the current
 * rosters (no RNG at offer time); the club that takes an out-loaned player is
 * picked from a seeded stream. Persisted in the save (`CareerState.loans`) with a
 * safe default for old saves, exactly like sponsors/contracts.
 */
import { createRng, hashSeed } from '@engine';
import type { Player } from '@data';
import type { CareerState, CareerTeam } from './types';
import type { Contract } from './contracts';
import type { TrainingFocus } from './training';
import { deriveSalary } from './contracts';
import { marketValue } from './market';
import { playerAge, developPlayer, seasonStartYear } from './development';
import { seasonFromCareer } from './career';

/** A player you have sent OUT on loan for the current season (returns next one). */
export interface LoanedOutPlayer {
  /** The player as he was when loaned out (aged one season on return). */
  player: Player;
  /** His deal, set aside while he is away (restored, term ticked, on return). */
  contract: Contract;
  /** The club that took him this season (flavour; deterministic per seed). */
  toClubId: string;
  /** 1-indexed career season the loan was agreed (the season he is out). */
  seasonNumber: number;
}

/**
 * The club's loan book. `out` holds players away on loan (returning next season);
 * `in` holds the ids of players currently in your squad on loan (they carry a
 * 1-season deal and leave at the transition — tracked here for the UI/marking).
 */
export interface LoansState {
  out: LoanedOutPlayer[];
  in: string[];
}

/** A fresh career (and every pre-cesiones save) starts with an empty loan book. */
export const DEFAULT_LOANS: LoansState = { out: [], in: [] };

/** Read a career's loan book, defaulting to empty for pre-cesiones saves. */
export function careerLoans(career: CareerState): LoansState {
  return career.loans ?? DEFAULT_LOANS;
}

/** Fraction of market value you RECEIVE as commission for loaning a player out. */
const COMMISSION_FRACTION = 0.05;
/** Fraction of market value you PAY as the fee to bring a player in on loan. */
const LOAN_FEE_FRACTION = 0.15;
/** Fraction of the player's derived wage you take on while he is on loan to you. */
const LOAN_WAGE_FRACTION = 0.6;

/** The commission a selling-on club pays you to take a player off their books. */
export function loanCommission(player: Player, age: number | null): number {
  return Math.round(marketValue(player, age) * COMMISSION_FRACTION);
}

/** The loan fee you pay to bring an AI club's player in for the season. */
export function loanFee(player: Player, age: number | null): number {
  return Math.round(marketValue(player, age) * LOAN_FEE_FRACTION);
}

/** The reduced season wage you take on for a player brought in on loan. */
export function loanWage(player: Player, age: number | null): number {
  return Math.round(deriveSalary(player, age) * LOAN_WAGE_FRACTION);
}

/**
 * Which AI players are offered ON LOAN this window: promising youngsters chasing
 * game time, and clear squad/fringe players — never prime stars (you cannot loan
 * a galáctico cheaply). Deterministic from the current rosters, no RNG.
 */
function loanEligible(player: Player, age: number | null): boolean {
  const young = age !== null && age <= 21;
  return (young && player.media < 78) || player.media < 66;
}

/** The market is only open in the pre-season (before any matchday is played). */
function assertMarketOpen(career: CareerState): void {
  if (career.season.results.length > 0) {
    throw new Error('El mercado solo está abierto antes de empezar la temporada');
  }
}

/** Re-derive the in-progress season after the rosters change. */
function withDerivedSeason(career: CareerState): CareerState {
  return { ...career, season: seasonFromCareer(career) };
}

/** Club-independent identity for the same real person across seasons/clubs. */
function personKey(p: Player): string {
  return `${p.nombreCompleto}|${p.fechaNacimiento ?? '?'}`;
}

/** A player you could offer OUT on loan (your squad, minus anyone already in on loan). */
export interface LoanOutCandidate {
  player: Player;
  value: number;
  commission: number;
}

/** An AI club's player you could bring IN on loan this window. */
export interface LoanOffer {
  player: Player;
  clubId: string;
  value: number;
  /** Loan fee you pay to sign him for the season. */
  fee: number;
  /** Reduced season wage you take on (his parent club pays the rest). */
  wage: number;
}

/**
 * Your squad players eligible to be loaned out, most valuable first. Players
 * already in your squad ON loan cannot be loaned on again.
 */
export function loanOutCandidates(career: CareerState): LoanOutCandidate[] {
  const startYear = seasonStartYear(career.temporada);
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  if (!human) return [];
  const inOnLoan = new Set(careerLoans(career).in);
  const candidates: LoanOutCandidate[] = [];
  for (const player of human.players) {
    if (inOnLoan.has(player.id)) continue;
    const age = playerAge(player, startYear);
    candidates.push({
      player,
      value: marketValue(player, age),
      commission: loanCommission(player, age),
    });
  }
  return candidates.sort((a, b) => b.value - a.value);
}

/**
 * Every AI player offered on loan this window, best rating first. Deterministic
 * from the current rosters; the eligible set is stable, so the same window always
 * shows the same offers.
 */
export function loanOffers(career: CareerState): LoanOffer[] {
  const startYear = seasonStartYear(career.temporada);
  const offers: LoanOffer[] = [];
  for (const team of career.teams) {
    if (team.id === career.humanTeamId) continue;
    for (const player of team.players) {
      const age = playerAge(player, startYear);
      if (!loanEligible(player, age)) continue;
      offers.push({
        player,
        clubId: team.id,
        value: marketValue(player, age),
        fee: loanFee(player, age),
        wage: loanWage(player, age),
      });
    }
  }
  return offers.sort((a, b) => b.player.media - a.player.media);
}

export interface LoanResult {
  career: CareerState;
  ok: boolean;
  reason?: 'no-encontrado' | 'presupuesto' | 'ya-cedido';
}

/** Deterministically pick which AI club takes an out-loaned player (flavour). */
function loanDestination(career: CareerState, playerId: string): string {
  const others = career.teams.filter((t) => t.id !== career.humanTeamId);
  if (others.length === 0) return career.humanTeamId;
  const rng = createRng(hashSeed(career.seed, 'loan-out', career.seasonNumber, playerId));
  return others[rng.int(others.length)]!.id;
}

/**
 * CEDER one of your players for the season: he leaves your squad (no longer
 * counts for the XI), his contract is set aside (off the wage bill) and you
 * pocket a commission. He returns next season via `returnLoans`. Soft-fails if
 * the player isn't in your squad or is himself a player you brought in on loan;
 * throws only if the market is closed.
 */
export function loanOutPlayer(career: CareerState, playerId: string): LoanResult {
  assertMarketOpen(career);
  const loans = careerLoans(career);
  if (loans.in.includes(playerId)) return { career, ok: false, reason: 'ya-cedido' };
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  const player = human?.players.find((p) => p.id === playerId);
  const contract = career.contracts[playerId];
  if (!player || !contract) return { career, ok: false, reason: 'no-encontrado' };

  const startYear = seasonStartYear(career.temporada);
  const commission = loanCommission(player, playerAge(player, startYear));
  const toClubId = loanDestination(career, playerId);

  const teams = career.teams.map((team) =>
    team.id === career.humanTeamId
      ? { ...team, players: team.players.filter((p) => p.id !== playerId) }
      : team,
  );
  // His deal leaves the active wage book with him, held aside until he returns.
  const contracts = { ...career.contracts };
  delete contracts[playerId];

  const out: LoanedOutPlayer[] = [
    ...loans.out,
    { player, contract, toClubId, seasonNumber: career.seasonNumber },
  ];

  return {
    career: withDerivedSeason({
      ...career,
      teams,
      contracts,
      budget: career.budget + commission,
      loans: { out, in: loans.in },
    }),
    ok: true,
  };
}

/**
 * INCORPORAR a CEDIDO: sign an AI club's player on loan for the season. You pay
 * the loan fee, take on his reduced wage on a 1-season deal (so he leaves at the
 * transition), and he joins your squad for this season. Soft-fails if the player
 * isn't offered on loan or you cannot afford the fee; throws if the market is
 * closed.
 */
export function loanInPlayer(career: CareerState, playerId: string): LoanResult {
  assertMarketOpen(career);
  const startYear = seasonStartYear(career.temporada);
  let owner: CareerTeam | undefined;
  let player: Player | undefined;
  for (const team of career.teams) {
    if (team.id === career.humanTeamId) continue;
    const found = team.players.find((p) => p.id === playerId);
    if (found) {
      owner = team;
      player = found;
      break;
    }
  }
  if (!owner || !player) return { career, ok: false, reason: 'no-encontrado' };
  const age = playerAge(player, startYear);
  if (!loanEligible(player, age)) return { career, ok: false, reason: 'no-encontrado' };

  const fee = loanFee(player, age);
  if (career.budget < fee) return { career, ok: false, reason: 'presupuesto' };

  const signed = player;
  const teams = career.teams.map((team) => {
    if (team.id === owner!.id) return { ...team, players: team.players.filter((p) => p.id !== playerId) };
    if (team.id === career.humanTeamId) return { ...team, players: [...team.players, signed] };
    return team;
  });
  // A loanee carries a 1-season deal at a reduced wage: the transition's roster
  // rebuild naturally drops him, modelling "leaves at the end of the season".
  const contracts = {
    ...career.contracts,
    [playerId]: { salary: loanWage(signed, age), yearsLeft: 1 },
  };
  const loans = careerLoans(career);

  return {
    career: withDerivedSeason({
      ...career,
      teams,
      contracts,
      budget: career.budget - fee,
      loans: { out: loans.out, in: [...loans.in, playerId] },
    }),
    ok: true,
  };
}

export interface LoanReturnContext {
  seed: number;
  /** 1-indexed NEXT career season being entered. */
  seasonNumber: number;
  /** Calendar start year of that season. */
  seasonStartYear: number;
  /** The human club's training focus (shapes how returning players evolve). */
  training?: TrainingFocus;
  humanTeamId: string;
}

export interface LoanReturnResult {
  teams: CareerTeam[];
  contracts: Record<string, Contract>;
}

/**
 * Fold players returning from loan back into a freshly-rebuilt next season.
 * Called from the transition AFTER the real world roster + retained players +
 * contract advance are in place. Each returning player is aged one season (via
 * the same development curve, honouring the training focus); retirees drop out.
 * Returning players are removed from any club history placed them at (dedup by
 * person), then added to the human squad with their deal restored (term ticked,
 * floored so a returnee never leaves the instant he is back).
 *
 * With an empty (or absent) loan book this is a no-op: the exact same references
 * are returned, so pre-cesiones careers and saves behave identically.
 */
export function returnLoans(
  loans: LoansState | undefined,
  teams: readonly CareerTeam[],
  contracts: Readonly<Record<string, Contract>>,
  ctx: LoanReturnContext,
): LoanReturnResult {
  if (!loans || loans.out.length === 0) {
    return { teams: teams as CareerTeam[], contracts: contracts as Record<string, Contract> };
  }

  const returnedContracts: Record<string, Contract> = { ...contracts };
  const returnedPlayers: Player[] = [];
  const returnedKeys = new Set<string>();
  for (const loan of loans.out) {
    const result = developPlayer(loan.player, {
      seed: ctx.seed,
      seasonNumber: ctx.seasonNumber,
      seasonStartYear: ctx.seasonStartYear,
      training: ctx.training,
    });
    if (result.retired) continue;
    returnedPlayers.push(result.player);
    returnedKeys.add(personKey(result.player));
    // Restore his deal, one season shorter for the year away (never below 1).
    returnedContracts[result.player.id] = {
      salary: loan.contract.salary,
      yearsLeft: Math.max(1, loan.contract.yearsLeft - 1),
    };
  }

  const nextTeams: CareerTeam[] = teams.map((team) => {
    if (team.id === ctx.humanTeamId) {
      // Drop any duplicate of a returnee history left in your real roster, then
      // add the aged returnees back.
      const kept = team.players.filter((p) => !returnedKeys.has(personKey(p)));
      return { ...team, players: [...kept, ...returnedPlayers] };
    }
    if (returnedKeys.size === 0) return team;
    return { ...team, players: team.players.filter((p) => !returnedKeys.has(personKey(p))) };
  });

  return { teams: nextTeams, contracts: returnedContracts };
}
