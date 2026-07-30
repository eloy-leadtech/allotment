/**
 * Transfer-market economy: player valuation and club budgets. Pure and
 * deterministic — values come only from a player's rating, age and position, so
 * the same squad always prices out the same way.
 *
 * Values are whole euros. The curve is deliberately steep: a superstar is worth
 * many times a solid starter, matching how the classic games felt.
 */
import type { Player, Position } from '@data';
import type { CareerTeam } from './types';
import { playerAge } from './development';

/** Rating above this floor is what you actually pay for; below it is nominal. */
const RATING_FLOOR = 40;
/** Scales the cubic rating curve into euros. */
const VALUE_SCALE = 320;
/** Nobody is worth literally nothing. */
const MIN_VALUE = 50_000;

/** Age multiplier: peak years are dearest, veterans cheap, kids a bit unproven. */
function ageMultiplier(age: number | null): number {
  if (age === null) return 0.8;
  if (age <= 18) return 0.85;
  if (age <= 21) return 1.0;
  if (age <= 27) return 1.15;
  if (age <= 30) return 0.85;
  if (age <= 32) return 0.55;
  if (age <= 34) return 0.35;
  return 0.2;
}

const POSITION_MULTIPLIER: Record<Position, number> = {
  DEL: 1.1,
  MED: 1.0,
  DEF: 0.92,
  POR: 0.85,
};

/** Market value of a player in whole euros, given their age this season. */
export function marketValue(player: Player, age: number | null): number {
  const over = Math.max(0, player.media - RATING_FLOOR);
  const base = over * over * over; // cubic: superstars cost exponentially more
  const value = base * ageMultiplier(age) * POSITION_MULTIPLIER[player.posicion] * VALUE_SCALE;
  return Math.max(MIN_VALUE, Math.round(value));
}

/** Total market value of a squad for the given season start year. */
export function squadValue(team: CareerTeam, seasonStartYear: number): number {
  return team.players.reduce((sum, p) => sum + marketValue(p, playerAge(p, seasonStartYear)), 0);
}

/** Fraction of squad value a club can spend on transfers. */
const BUDGET_FRACTION = 0.12;

/**
 * A club's starting transfer budget: a fraction of its squad value, so richer
 * squads get more to spend. Deterministic from the roster.
 */
export function initialBudget(team: CareerTeam, seasonStartYear: number): number {
  return Math.round(squadValue(team, seasonStartYear) * BUDGET_FRACTION);
}

/** Human-friendly euro amount, e.g. 40_500_000 -> "40,5 M€", 850_000 -> "850 k€". */
export function formatEuros(euros: number): string {
  if (euros >= 1_000_000) {
    const millions = euros / 1_000_000;
    const text = millions >= 100 ? String(Math.round(millions)) : millions.toFixed(1).replace('.', ',');
    return `${text} M€`;
  }
  if (euros >= 1_000) {
    return `${Math.round(euros / 1_000)} k€`;
  }
  return `${euros} €`;
}
