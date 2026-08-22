/**
 * RENOVACIONES DE CONTRATO — the end-of-season tension of keeping your squad,
 * faithful to the classic PC Fútbol. A player in the FINAL year of his deal
 * (`yearsLeft === 1`) asks to RENOVAR: he puts a DEMAND on the table (a new
 * ficha and a term) and you negotiate. Meet it (or better his threshold with a
 * counter-offer) and he stays on a fresh multi-season deal; refuse, lowball, or
 * simply let his deal run down and he leaves your club FREE next season — the
 * Bosman departure that `advanceContracts` performs at the transition.
 *
 * Pure and deterministic: a demand is a seeded function of the master seed, the
 * career season and the player (`hashSeed(seed,'renewal',seasonNumber,id)`),
 * never `Math.random`/`Date.now`, so the same career always sees the same asks.
 *
 * TIMING. Negotiations are resolved at SEASON END, before the season transition
 * ticks every deal down a year (see contracts.ts / transition.ts). A renewal
 * therefore writes `yearsLeft = agreedYears + 1`: the imminent boundary tick
 * consumes the nominal final year, leaving exactly `agreedYears` seasons on the
 * new deal once the next campaign begins. Players you don't renew keep their
 * `yearsLeft === 1`, tick to 0, and are released FREE. Your DECISIONS live in
 * `CareerState.renewals` (persisted, reset each transition) so a save/load in
 * the middle of the season-end phase is exact.
 */
import { createRng, hashSeed } from '@engine';
import type { Player, Position } from '@data';
import type { CareerState } from './types';
import { currentStandings } from '../season/season';
import { playerAge, seasonStartYear } from './development';
import { deriveSalary, RENEWAL_BONUS_FRACTION } from './contracts';

/** A deal with this many seasons left (its final year) expires at the next transition. */
export const EXPIRING_YEARS_LEFT = 1;
/**
 * The lowest fraction of the DEMAND a counter-offer may reach and still be
 * accepted: offer below this umbral of the asked ficha and the player rejects.
 */
export const RENEWAL_ACCEPT_FRACTION = 0.9;
/** Longest term (seasons) a counter-offer may propose. */
export const RENEWAL_MAX_YEARS = 5;

/** How the manager resolved one expiring player this season. */
export type RenewalOutcomeKind = 'renewed' | 'released';

/** A recorded season-end decision for one expiring player (a PLAYER decision → persisted). */
export interface RenewalRecord {
  outcome: RenewalOutcomeKind;
  /** Agreed annual ficha (present only when `renewed`). */
  salary?: number;
  /** Agreed term in seasons (present only when `renewed`). */
  years?: number;
}

/**
 * This season's renewal negotiations. Reset to `DEFAULT_RENEWALS` at every
 * transition so each pretemporada starts its own round of asks.
 */
export interface RenewalsState {
  /** Career season these negotiations belong to (guards against stale carryover). */
  seasonNumber: number;
  /** Resolved negotiations keyed by player id. */
  resolved: Record<string, RenewalRecord>;
}

/** A fresh, empty renewals book (no negotiations resolved yet). */
export const DEFAULT_RENEWALS: RenewalsState = { seasonNumber: 0, resolved: {} };

/** A player's ask when his deal is expiring: a new ficha, a term, and his floor. */
export interface RenewalDemand {
  /** Annual ficha the player asks for on the new deal. */
  salary: number;
  /** Term (seasons) the player wants. */
  years: number;
  /** Lowest ficha he will accept in a counter-offer (never below his current wage). */
  minSalary: number;
}

/** One pending negotiation, surfaced to the UI. */
export interface RenewalOffer {
  playerId: string;
  playerName: string;
  posicion: Position;
  media: number;
  /** Age at the upcoming season's start, or null when the birth date is unknown. */
  age: number | null;
  currentSalary: number;
  currentYearsLeft: number;
  demand: RenewalDemand;
}

/** One resolved negotiation, surfaced to the UI as a decision summary. */
export interface ResolvedRenewal extends RenewalRecord {
  playerId: string;
  playerName: string;
}

/**
 * How hard players push, by age: a young talent on the up wants a real raise and
 * a long deal; a peak-years star has the most leverage; a veteran is happy to
 * stay for roughly his current ficha on a short deal.
 */
function raiseByAge(age: number | null): number {
  if (age === null) return 1.15;
  if (age <= 23) return 1.25;
  if (age <= 29) return 1.35;
  if (age <= 32) return 1.1;
  return 1.0;
}

/** Term (seasons) a player of a given age asks for on a renewal. */
function yearsByAge(age: number | null): number {
  if (age === null) return 3;
  if (age <= 23) return 4;
  if (age <= 29) return 3;
  if (age <= 32) return 2;
  return 1;
}

/**
 * A season-wide performance modifier on demands: after a title-winning campaign
 * your players feel entitled to more; after a relegation scrap they ask for
 * less. Derived from the human's final league position (deterministic).
 */
export function teamRenewalPerformance(career: CareerState): number {
  const table = currentStandings(career.season);
  const n = table.length;
  if (n <= 1) return 1;
  const idx = table.findIndex((r) => r.teamId === career.humanTeamId);
  const pos = idx < 0 ? n : idx + 1;
  const rankFrac = (n - pos) / (n - 1); // 1 = champions, 0 = last
  return 0.92 + 0.2 * rankFrac; // [0.92, 1.12]
}

/** Everything the pure demand function needs (no CareerState, for easy testing). */
export interface RenewalDemandInput {
  seed: number;
  seasonNumber: number;
  player: Player;
  /** Age at the upcoming season's start (drives the age brackets). */
  age: number | null;
  /** The player's current annual ficha (a renewal is never a pay cut). */
  currentSalary: number;
  /** Season-wide performance modifier (see `teamRenewalPerformance`). */
  performance: number;
}

/**
 * The DEMAND an expiring player puts on the table, deterministic per
 * seed+season+player. Built from his market wage (media/edad/posición, see
 * contracts.ts) lifted by an age-driven raise and the season's performance, with
 * a small seeded jitter so two identical players still differ. Never below his
 * current ficha — players don't ask to earn less to stay.
 */
export function renewalDemand(input: RenewalDemandInput): RenewalDemand {
  const { seed, seasonNumber, player, age, currentSalary, performance } = input;
  const rng = createRng(hashSeed(seed, 'renewal', seasonNumber, player.id));
  const jitter = 0.95 + rng.next01() * 0.15; // [0.95, 1.10)
  const base = Math.max(currentSalary, deriveSalary(player, age));
  const salary = Math.max(currentSalary, Math.round(base * raiseByAge(age) * performance * jitter));
  const years = yearsByAge(age);
  const minSalary = Math.max(currentSalary, Math.round(salary * RENEWAL_ACCEPT_FRACTION));
  return { salary, years, minSalary };
}

/** The resolved book for THIS season (stale carryover from an old season is ignored). */
function resolvedThisSeason(career: CareerState): Record<string, RenewalRecord> {
  const renewals = career.renewals;
  if (!renewals || renewals.seasonNumber !== career.seasonNumber) return {};
  return renewals.resolved;
}

/** Fold one decision into this season's renewals book (starting fresh across a season boundary). */
function withResolved(career: CareerState, playerId: string, record: RenewalRecord): RenewalsState {
  return {
    seasonNumber: career.seasonNumber,
    resolved: { ...resolvedThisSeason(career), [playerId]: record },
  };
}

/**
 * The players in your squad whose deal is in its final year and who still await a
 * decision, each with their deterministic demand. Sorted by id for a stable list.
 */
export function pendingRenewals(career: CareerState): RenewalOffer[] {
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  if (!human) return [];
  const resolved = resolvedThisSeason(career);
  const performance = teamRenewalPerformance(career);
  const startYear = seasonStartYear(career.temporada);
  const offers: RenewalOffer[] = [];
  const players = [...human.players].sort((a, b) => a.id.localeCompare(b.id));
  for (const player of players) {
    const contract = career.contracts[player.id];
    if (!contract || contract.yearsLeft > EXPIRING_YEARS_LEFT) continue;
    if (resolved[player.id]) continue;
    const age = playerAge(player, startYear);
    offers.push({
      playerId: player.id,
      playerName: player.nombre,
      posicion: player.posicion,
      media: player.media,
      age,
      currentSalary: contract.salary,
      currentYearsLeft: contract.yearsLeft,
      demand: renewalDemand({
        seed: career.seed,
        seasonNumber: career.seasonNumber,
        player,
        age,
        currentSalary: contract.salary,
        performance,
      }),
    });
  }
  return offers;
}

/** This season's resolved decisions, for the season-end summary. Sorted by id. */
export function resolvedRenewals(career: CareerState): ResolvedRenewal[] {
  const resolved = resolvedThisSeason(career);
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  const nameById = new Map((human?.players ?? []).map((p) => [p.id, p.nombre]));
  return Object.keys(resolved)
    .sort()
    .map((id) => ({
      playerId: id,
      playerName: nameById.get(id) ?? id,
      outcome: resolved[id]!.outcome,
      salary: resolved[id]!.salary,
      years: resolved[id]!.years,
    }));
}

/** The outcome of a renewal decision (mirrors the market's negotiation shape). */
export type RenewalOutcome =
  | { status: 'renewed'; career: CareerState; salary: number; years: number }
  | { status: 'released'; career: CareerState }
  | { status: 'rejected'; demand: RenewalDemand }
  | { status: 'presupuesto' }
  | { status: 'no-encontrado' };

/** Locate an expiring squad player and their current deal, or null. */
function findExpiring(career: CareerState, playerId: string) {
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  const player = human?.players.find((p) => p.id === playerId);
  const contract = career.contracts[playerId];
  if (!player || !contract || contract.yearsLeft > EXPIRING_YEARS_LEFT) return null;
  return { player, contract };
}

/** The deterministic demand for an expiring player in the context of this career. */
function demandFor(career: CareerState, player: Player, currentSalary: number): RenewalDemand {
  return renewalDemand({
    seed: career.seed,
    seasonNumber: career.seasonNumber,
    player,
    age: playerAge(player, seasonStartYear(career.temporada)),
    currentSalary,
    performance: teamRenewalPerformance(career),
  });
}

/**
 * Close a renewal at agreed terms: reset the deal (with the +1 tick compensation)
 * and pay the up-front prima de renovación out of the budget. Soft-fails on money.
 */
function applyRenewal(
  career: CareerState,
  playerId: string,
  salary: number,
  years: number,
): RenewalOutcome {
  const prima = Math.round(salary * RENEWAL_BONUS_FRACTION);
  if (career.budget < prima) return { status: 'presupuesto' };
  return {
    status: 'renewed',
    salary,
    years,
    career: {
      ...career,
      budget: career.budget - prima,
      // +1: the imminent season transition ticks this deal down once, leaving
      // exactly `years` seasons on the books when the new campaign starts.
      contracts: { ...career.contracts, [playerId]: { salary, yearsLeft: years + 1 } },
      renewals: withResolved(career, playerId, { outcome: 'renewed', salary, years }),
    },
  };
}

/**
 * ACCEPT the player's full demand (his asked ficha and term). Charges the prima;
 * soft-fails if he isn't an expiring squad player or the prima is unaffordable.
 */
export function acceptRenewal(career: CareerState, playerId: string): RenewalOutcome {
  const found = findExpiring(career, playerId);
  if (!found) return { status: 'no-encontrado' };
  const demand = demandFor(career, found.player, found.contract.salary);
  return applyRenewal(career, playerId, demand.salary, demand.years);
}

/**
 * COUNTER-OFFER a renewal at your own ficha and term. The player accepts only if
 * the ficha meets his threshold (`demand.minSalary`); below that he REJECTS and
 * the negotiation stays open (try again, accept his demand, or let him go). The
 * term is clamped to [1, RENEWAL_MAX_YEARS]. Charges the prima on acceptance.
 */
export function offerRenewal(
  career: CareerState,
  playerId: string,
  offeredSalary: number,
  offeredYears: number,
): RenewalOutcome {
  const found = findExpiring(career, playerId);
  if (!found) return { status: 'no-encontrado' };
  const demand = demandFor(career, found.player, found.contract.salary);
  const salary = Math.round(offeredSalary);
  if (!Number.isFinite(salary) || salary < demand.minSalary) return { status: 'rejected', demand };
  const years = Math.max(1, Math.min(RENEWAL_MAX_YEARS, Math.round(offeredYears)));
  return applyRenewal(career, playerId, salary, years);
}

/**
 * Let an expiring player go: record the decision (he'll leave FREE at the
 * transition). No money or squad change now — the Bosman happens when the deal
 * ticks to 0. Soft-fails only if he isn't an expiring squad player.
 */
export function letGoPlayer(career: CareerState, playerId: string): RenewalOutcome {
  const found = findExpiring(career, playerId);
  if (!found) return { status: 'no-encontrado' };
  return {
    status: 'released',
    career: { ...career, renewals: withResolved(career, playerId, { outcome: 'released' }) },
  };
}
