/**
 * Contratos y sueldos: the wage economy of your squad, faithful to the classic
 * PC Fútbol. Pure and deterministic — a player's salary is DERIVED from their
 * market value (see market.ts) and the term of a new/renewed deal comes from a
 * seeded RNG (`hashSeed`), never from `Math.random`/`Date.now`, so the same
 * career always books the same wages and the same expirations on every machine.
 *
 * Every player in the HUMAN club carries a contract (AI clubs don't need one:
 * only your masa salarial is charged against your budget). Contracts live in
 * `CareerState.contracts`, keyed by player id, so they survive save/load and move
 * cleanly as players are signed, sold, retained or released.
 *
 *  - SALARIO: an annual wage, a fraction of the player's market value.
 *  - VENCIMIENTO: `yearsLeft` seasons remaining; it ticks down every transition
 *    and a deal that reaches 0 sends the player away FREE unless you RENOVAR it
 *    (a costly bump that resets the term and raises the wage) beforehand.
 */
import { createRng, hashSeed } from '@engine';
import type { Player } from '@data';
import type { CareerState, CareerTeam } from './types';
import { marketValue } from './market';
import { playerAge } from './development';

/** A player's deal with your club: an annual wage and the seasons left on it. */
export interface Contract {
  /** Annual salary in whole euros (charged against the budget each season). */
  salary: number;
  /** Full seasons remaining on the deal; ticks down each transition. */
  yearsLeft: number;
}

/** Annual wage as a fraction of market value (calibrated to stay solvent). */
const SALARY_FRACTION = 0.05;
/** Nobody plays for nothing: a wage floor for fringe players. */
const MIN_SALARY = 60_000;
/** Shortest / longest term a fresh (initial or signed) deal can run. */
const NEW_TERM_MIN = 2;
const NEW_TERM_MAX = 4;
/** A renewal resets the deal to this many seasons. */
export const RENEWAL_TERM = 4;
/** A renewal bumps the wage by this factor (the classic "subida de ficha"). */
export const RENEWAL_RAISE = 1.2;
/** Up-front bonus to renew, as a fraction of the new annual wage. */
export const RENEWAL_BONUS_FRACTION = 0.5;

/** Annual salary a player commands, derived from their market value this season. */
export function deriveSalary(player: Player, age: number | null): number {
  return Math.max(MIN_SALARY, Math.round(marketValue(player, age) * SALARY_FRACTION));
}

/** A fresh deal's term (seasons), seeded so it is reproducible per player. */
function newTerm(seed: number, seasonNumber: number, playerId: string): number {
  const rng = createRng(hashSeed(seed, 'contract', seasonNumber, playerId));
  return NEW_TERM_MIN + rng.int(NEW_TERM_MAX - NEW_TERM_MIN + 1);
}

/** Build a brand-new contract for a player entering your club this season. */
export function initialContract(
  player: Player,
  age: number | null,
  seed: number,
  seasonNumber: number,
): Contract {
  return { salary: deriveSalary(player, age), yearsLeft: newTerm(seed, seasonNumber, player.id) };
}

/** Contracts for a whole squad at season start (used at newCareer and on load). */
export function initialContracts(
  players: readonly Player[],
  seed: number,
  seasonNumber: number,
  seasonStartYear: number,
): Record<string, Contract> {
  const contracts: Record<string, Contract> = {};
  for (const p of players) {
    contracts[p.id] = initialContract(p, playerAge(p, seasonStartYear), seed, seasonNumber);
  }
  return contracts;
}

/** Your club's total annual wage bill (masa salarial): the sum of all salaries. */
export function wageBill(contracts: Readonly<Record<string, Contract>>): number {
  let total = 0;
  for (const id of Object.keys(contracts)) total += contracts[id]!.salary;
  return total;
}

/** The wage bill restricted to the players actually in `team` (defensive sum). */
export function squadWageBill(team: CareerTeam, contracts: Readonly<Record<string, Contract>>): number {
  let total = 0;
  for (const p of team.players) total += contracts[p.id]?.salary ?? 0;
  return total;
}

export interface ContractContext {
  seed: number;
  /** 1-indexed career season being entered. */
  seasonNumber: number;
  /** Calendar start year of that season (for market-value-based wages). */
  seasonStartYear: number;
}

export interface ContractAdvance {
  /** Human players who keep their place (expired deals dropped out). */
  players: Player[];
  /** The next season's contract book for those players. */
  contracts: Record<string, Contract>;
  /** Players whose deal expired and who leave the club FREE this transition. */
  released: Player[];
}

/**
 * Roll the wage book forward one season for the human squad:
 *  - a continuing player's deal ticks down a year; if it hits 0 they leave FREE
 *    (unless it was RENOVADO during the season, which reset the term);
 *  - a NEW arrival (a historical transfer into your club) is handed a fresh deal.
 * Deterministic: fresh deals are seeded per player, so order does not matter.
 */
export function advanceContracts(
  humanPlayers: readonly Player[],
  prev: Readonly<Record<string, Contract>>,
  ctx: ContractContext,
): ContractAdvance {
  const players: Player[] = [];
  const contracts: Record<string, Contract> = {};
  const released: Player[] = [];
  for (const p of humanPlayers) {
    const current = prev[p.id];
    if (current) {
      const yearsLeft = current.yearsLeft - 1;
      if (yearsLeft <= 0) {
        released.push(p);
        continue;
      }
      players.push(p);
      contracts[p.id] = { salary: current.salary, yearsLeft };
    } else {
      players.push(p);
      contracts[p.id] = initialContract(p, playerAge(p, ctx.seasonStartYear), ctx.seed, ctx.seasonNumber);
    }
  }
  return { players, contracts, released };
}

export interface RenewalResult {
  career: CareerState;
  ok: boolean;
  reason?: 'no-encontrado' | 'presupuesto';
}

/**
 * RENOVAR a player's contract: reset the term to `RENEWAL_TERM` and raise the
 * wage by `RENEWAL_RAISE`, paying an up-front bonus out of your budget. Soft-fails
 * if the player isn't in your squad/has no deal, or you can't afford the bonus.
 */
export function renewContract(career: CareerState, playerId: string): RenewalResult {
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  const player = human?.players.find((p) => p.id === playerId);
  const current = career.contracts[playerId];
  if (!player || !current) return { career, ok: false, reason: 'no-encontrado' };

  const newSalary = Math.round(current.salary * RENEWAL_RAISE);
  const bonus = Math.round(newSalary * RENEWAL_BONUS_FRACTION);
  if (career.budget < bonus) return { career, ok: false, reason: 'presupuesto' };

  return {
    career: {
      ...career,
      budget: career.budget - bonus,
      contracts: { ...career.contracts, [playerId]: { salary: newSalary, yearsLeft: RENEWAL_TERM } },
    },
    ok: true,
  };
}
