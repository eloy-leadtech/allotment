/**
 * Crédito bancario y DEUDA (números rojos): the club's bank/board credit line and
 * the interest it charges when you run into the red. A faithful nod to the classic
 * PC Fútbol, where the treasury could go NEGATIVE ("números rojos"), the board
 * granted a CREDIT capped by the club's strength/stadium, unpaid debt piled up
 * INTEREST season after season ("CRÉDITOS E INTERESES"), and staying deep in the
 * red for too long got you SACKED for "pésima gestión económica".
 *
 * Pure and deterministic. The debt is simply an overdrawn `budget` (negative euros)
 * plus any outstanding board `loan`; nothing here uses RNG, the clock or the locale,
 * so the same career always liquidates to the same figures and is fully save/load
 * stable. The season's money movements are applied once per transition (see
 * `liquidateSeason`), matching our per-season economy.
 */
import type { CareerState } from './types';
import type { Division } from './promotion';
import { squadValue } from './market';
import { seasonStartYear } from './development';
import { gateMultiplier } from './stadium';

/**
 * The club's credit/debt state, carried on the career and persisted in save v2.
 * `budget` (on the career) may itself be negative — an overdrawn treasury — which
 * is the visible "números rojos"; this only tracks the board LOAN taken on top of
 * it and how long the club has been beyond what the board will bankroll.
 */
export interface CreditState {
  /** Outstanding board loan principal, in whole euros (>= 0). Repaid before interest bites. */
  loan: number;
  /** Consecutive seasons the total debt has sat ABOVE the board's credit limit. */
  seasonsOverLimit: number;
}

/** A fresh career (and every pre-crédito save) starts debt-free. */
export const DEFAULT_CREDIT: CreditState = { loan: 0, seasonsOverLimit: 0 };

/** Interest charged each season on the carried debt (loan + overdrawn treasury). */
export const SEASON_INTEREST_RATE = 0.12;

/** Seasons ABOVE the credit limit the board tolerates before sacking you. */
export const MAX_SEASONS_OVER_LIMIT = 3;

/** Flat per-division floor for the board's credit limit (euros). */
const CREDIT_DIVISION_FLOOR: Record<Division, number> = {
  primera: 6_000_000,
  segunda: 2_000_000,
};

/** How much of the squad's value the board will bankroll as credit (bigger club = more). */
const CREDIT_STRENGTH_FRACTION = 0.08;
/** Cap on the strength component so a galáctico squad can't borrow the economy away. */
const CREDIT_STRENGTH_CAP = 30_000_000;
/** How much extra credit a fully expanded stadium (its aforo) unlocks. */
const CREDIT_AFORO_WEIGHT = 10_000_000;

/**
 * The board's CREDIT LIMIT for the club: the most total debt (board loan plus an
 * overdrawn treasury) it will bankroll before it starts counting the seasons
 * toward an economic sacking. Scales with the squad's value ("fuerza") and the
 * stadium's aforo, so a big club with a full ground gets a fatter line of credit.
 * Pure and deterministic from the current squad and stadium.
 */
export function creditLimit(career: CareerState): number {
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  const startYear = seasonStartYear(career.temporada);
  const strength = human
    ? Math.min(CREDIT_STRENGTH_CAP, Math.round(squadValue(human, startYear) * CREDIT_STRENGTH_FRACTION))
    : 0;
  const aforoBonus = Math.max(0, Math.round((gateMultiplier(career.stadium) - 1) * CREDIT_AFORO_WEIGHT));
  return CREDIT_DIVISION_FLOOR[career.division] + strength + aforoBonus;
}

/** The overdrawn part of the treasury (positive euros when the budget is red, else 0). */
export function overdraft(budget: number): number {
  return Math.max(0, -budget);
}

/**
 * The club's TOTAL debt in whole euros: the outstanding board loan plus any
 * overdrawn treasury. Zero for a solvent club. This is the figure interest is
 * charged on and that the board weighs against its credit limit.
 */
export function totalDebt(career: CareerState): number {
  const loan = career.credit?.loan ?? 0;
  return loan + overdraft(career.budget);
}

/** True when the club is in the red: it owes money (loan and/or an overdrawn budget). */
export function isInDebt(career: CareerState): boolean {
  return totalDebt(career) > 0;
}

/** How much more the board will lend right now (credit limit minus the outstanding loan). */
export function creditAvailable(career: CareerState): number {
  return Math.max(0, creditLimit(career) - (career.credit?.loan ?? 0));
}

/** The outcome of asking the board for credit. */
export interface CreditGrant {
  career: CareerState;
  ok: boolean;
  /** Euros actually advanced (0 on a soft failure). */
  granted: number;
  reason?: 'cantidad' | 'limite';
}

/**
 * Ask the board for CREDIT: it advances cash into the transfer budget (so you can
 * fund a signing) and books the same amount as an outstanding loan you will repay,
 * with interest, out of future income. The advance is capped at the credit still
 * available (limit minus what you already owe). A pure DECISION: it moves only the
 * budget and the loan — rosters and the in-progress season are untouched.
 * Soft-fails (ok:false) on a non-positive request or when no credit is left.
 */
export function requestCredit(career: CareerState, amount: number): CreditGrant {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { career, ok: false, granted: 0, reason: 'cantidad' };
  }
  const credit = career.credit ?? DEFAULT_CREDIT;
  const room = creditAvailable(career);
  if (room <= 0) return { career, ok: false, granted: 0, reason: 'limite' };
  const granted = Math.min(Math.round(amount), room);
  return {
    career: {
      ...career,
      budget: career.budget + granted,
      credit: { ...credit, loan: credit.loan + granted },
    },
    ok: true,
    granted,
  };
}

/** Everything the season-end liquidation needs (all pure inputs). */
export interface LiquidationInput {
  /** Budget carried into the transition (may be negative = an overdrawn treasury). */
  budget: number;
  /** Outstanding board loan carried in (>= 0). */
  loan: number;
  /** Total season income (see seasonIncome). */
  income: number;
  /** Season masa salarial charged against the budget. */
  wages: number;
  /** The board's credit limit for the club entering the new season. */
  creditLimit: number;
  /** Consecutive over-limit seasons carried in. */
  seasonsOverLimit: number;
}

/** The result of liquidating a season: the new budget, credit state and the interest booked. */
export interface Liquidation {
  budget: number;
  credit: CreditState;
  /** Interest charged this season on the carried debt (for the UI ledger). */
  interest: number;
}

/**
 * Liquidate a finished season into the next season's opening budget and credit
 * state. Order of events (a faithful, per-season take on the classic ledger):
 *
 *  1. INTEREST is charged on the debt carried in (loan + any overdrawn treasury).
 *  2. The season's income lands and the wage bill and interest are paid, which can
 *     push the treasury into (or deeper into) the red — the clamp-to-zero is gone,
 *     so real debt now shows.
 *  3. A treasury back in the black REPAYS the outstanding board loan first.
 *  4. If the remaining total debt is still above the board's credit limit, this
 *     season counts against you; a clean season resets the counter.
 *
 * Pure and deterministic: same inputs → same figures.
 */
export function liquidateSeason(input: LiquidationInput): Liquidation {
  const carriedDebt = input.loan + overdraft(input.budget);
  const interest = Math.round(carriedDebt * SEASON_INTEREST_RATE);
  let budget = input.budget + input.income - input.wages - interest;
  let loan = input.loan;
  // A treasury back in the black pays down the board loan before anything else.
  if (budget > 0 && loan > 0) {
    const repay = Math.min(budget, loan);
    budget -= repay;
    loan -= repay;
  }
  const debt = loan + overdraft(budget);
  const overLimit = debt > input.creditLimit;
  const seasonsOverLimit = overLimit ? input.seasonsOverLimit + 1 : 0;
  return { budget, credit: { loan, seasonsOverLimit }, interest };
}

/**
 * True when the board sacks the manager for "pésima gestión económica": the club's
 * debt has sat above the credit limit for `MAX_SEASONS_OVER_LIMIT` seasons running.
 * Mirrors the sporting sacking (see board.ts) — it ends the manager's tenure.
 */
export function economicDismissal(career: CareerState): boolean {
  return (career.credit?.seasonsOverLimit ?? 0) >= MAX_SEASONS_OVER_LIMIT;
}
