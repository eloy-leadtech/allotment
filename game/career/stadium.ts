/**
 * Estadio: your club's stadium and its AFORO (capacity). A faithful nod to the
 * classic PC Fútbol, where you sank budget into enlarging the ground and reaped
 * bigger gate receipts season after season.
 *
 * Pure and deterministic: the stadium is a small piece of career state (just an
 * expansion LEVEL) with a fixed ladder of capacities and costs. The season's gate
 * income (see finances.ts) scales with the aforo, so a bigger ground pays back
 * over the seasons that follow the investment. No RNG, fully save/load stable.
 */
import type { CareerState } from './types';

/** The human club's stadium, stored on the career and persisted in the save. */
export interface StadiumState {
  /** 0-indexed expansion level; 0 = the club's base ground (no work done yet). */
  capacityLevel: number;
}

/** A fresh career (and every pre-estadio save) starts at the base ground. */
export const DEFAULT_STADIUM: StadiumState = { capacityLevel: 0 };

/** One rung of the expansion ladder: the aforo reached and what it costs to build. */
interface StadiumTier {
  /** Capacity (spectators) once the ground sits at this level. */
  aforo: number;
  /** Euros to build UP TO this level from the previous one (0 for the base). */
  upgradeCost: number;
  /** Short Spanish label for the UI. */
  label: string;
}

/**
 * The expansion ladder. Aforo roughly doubles across the ladder, so the gate
 * multiplier tops out near 2.7x — a meaningful but not economy-breaking edge that
 * costs a cumulative ~142 M€ to fully build, i.e. several seasons of saving.
 */
export const STADIUM_TIERS: readonly StadiumTier[] = [
  { aforo: 25_000, upgradeCost: 0, label: 'Estadio base' },
  { aforo: 32_000, upgradeCost: 10_000_000, label: 'Ampliación de gradas' },
  { aforo: 40_000, upgradeCost: 22_000_000, label: 'Segundo anfiteatro' },
  { aforo: 52_000, upgradeCost: 40_000_000, label: 'Tercer anillo' },
  { aforo: 68_000, upgradeCost: 70_000_000, label: 'Estadio moderno' },
];

/** The highest reachable expansion level. */
export const MAX_STADIUM_LEVEL = STADIUM_TIERS.length - 1;

/** Clamp a (possibly out-of-range) level into the ladder. */
function clampLevel(level: number): number {
  if (level < 0) return 0;
  if (level > MAX_STADIUM_LEVEL) return MAX_STADIUM_LEVEL;
  return level;
}

/** The aforo (spectators) of a stadium at the given expansion level. */
export function stadiumAforo(stadium: StadiumState | undefined): number {
  const level = clampLevel(stadium?.capacityLevel ?? 0);
  return STADIUM_TIERS[level]!.aforo;
}

/** The label of the stadium's current expansion tier. */
export function stadiumTierLabel(stadium: StadiumState | undefined): string {
  const level = clampLevel(stadium?.capacityLevel ?? 0);
  return STADIUM_TIERS[level]!.label;
}

/**
 * How much the gate receipts scale at the current aforo, relative to the base
 * ground (level 0 => 1.0). This is what finances.ts multiplies the flat
 * per-division gate by, so a bigger aforo means bigger taquilla every season.
 */
export function gateMultiplier(stadium: StadiumState | undefined): number {
  return stadiumAforo(stadium) / STADIUM_TIERS[0]!.aforo;
}

/** True when the ground can still be enlarged (not already at the top tier). */
export function canExpand(stadium: StadiumState | undefined): boolean {
  return clampLevel(stadium?.capacityLevel ?? 0) < MAX_STADIUM_LEVEL;
}

/**
 * The cost to build the NEXT expansion level, or null if already at the top.
 * (The cost is charged against the transfer budget by `expandStadium`.)
 */
export function nextExpansionCost(stadium: StadiumState | undefined): number | null {
  const level = clampLevel(stadium?.capacityLevel ?? 0);
  if (level >= MAX_STADIUM_LEVEL) return null;
  return STADIUM_TIERS[level + 1]!.upgradeCost;
}

/** The aforo the ground would reach after the next expansion, or null at the top. */
export function nextExpansionAforo(stadium: StadiumState | undefined): number | null {
  const level = clampLevel(stadium?.capacityLevel ?? 0);
  if (level >= MAX_STADIUM_LEVEL) return null;
  return STADIUM_TIERS[level + 1]!.aforo;
}

/** The outcome of trying to enlarge the stadium. */
export interface ExpandResult {
  career: CareerState;
  ok: boolean;
  reason?: 'maximo' | 'presupuesto';
}

/**
 * Invest budget to enlarge the stadium by one level. Soft-fails (ok:false) when
 * the ground is already at the top tier or the budget cannot cover the cost;
 * otherwise debits the cost and bumps the capacity level. The squad and the
 * in-progress season are untouched — only the budget and the stadium change.
 */
export function expandStadium(career: CareerState): ExpandResult {
  const stadium = career.stadium ?? DEFAULT_STADIUM;
  const cost = nextExpansionCost(stadium);
  if (cost === null) return { career, ok: false, reason: 'maximo' };
  if (career.budget < cost) return { career, ok: false, reason: 'presupuesto' };
  return {
    career: {
      ...career,
      budget: career.budget - cost,
      stadium: { capacityLevel: clampLevel(stadium.capacityLevel + 1) },
    },
    ok: true,
  };
}
