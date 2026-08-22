/**
 * Patrocinios: the club's shirt/main SPONSOR. A faithful nod to the classic PC
 * Fútbol, where each season you chose one of several sponsor offers — some a fat
 * guaranteed cheque, some a gamble that only pays off if you reach Europe.
 *
 * Pure and deterministic. Each season the club is shown a fixed set of sponsor
 * OFFERS (stable ids, per-season amounts) sized from the division and the squad's
 * value ("fuerza del club"), with a small seeded per-season jitter so the market
 * feels alive. Picking one is a PLAYER DECISION (persisted in the save): the
 * chosen tier carries forward season to season and its annual payment is added to
 * `seasonIncome` (see finances.ts). No RNG at income time, fully save/load stable.
 */
import { createRng, hashSeed } from '@engine';
import type { CareerState } from './types';
import type { Division } from './promotion';
import { squadValue } from './market';
import { seasonStartYear } from './development';
import { europaQualification } from './europa';
import { currentStandings } from '../season/season';

/** The four sponsor tiers, by stable id (amounts vary by season/strength). */
export type SponsorId = 'basico' | 'estandar' | 'ambicioso' | 'premium';

/**
 * The club's chosen sponsor. Just the tier id: the actual payment is re-derived
 * each season from the offers, so the DECISION is all we persist. Stored on the
 * career and in save v2 (defaults to the basic sponsor for old saves).
 */
export interface SponsorState {
  sponsorId: SponsorId;
}

/** A fresh career (and every pre-patrocinios save) starts on the basic sponsor. */
export const DEFAULT_SPONSOR: SponsorState = { sponsorId: 'basico' };

/** One sponsor tier: a guaranteed multiplier plus an optional Europe-only bonus. */
interface SponsorTier {
  id: SponsorId;
  /** Short brand-flavour name for the UI. */
  name: string;
  /** One-line pitch shown under the name. */
  description: string;
  /** Multiplier on the season's base value for the GUARANTEED annual payment. */
  baseMultiplier: number;
  /** Extra multiplier paid ONLY if the club qualifies for Europe (0 = no strings). */
  europeMultiplier: number;
}

/**
 * The tier ladder. The trade-off is deliberate: a bigger guaranteed cheque comes
 * with a smaller Europe bonus and vice versa, so the best pick depends on how
 * ambitious the club is. `basico` is the safe, string-free default.
 */
const SPONSOR_TIERS: readonly SponsorTier[] = [
  {
    id: 'basico',
    name: 'Patrocinador local',
    description: 'Un comercio de la ciudad. Poco dinero, pero sin condiciones.',
    baseMultiplier: 0.55,
    europeMultiplier: 0,
  },
  {
    id: 'estandar',
    name: 'Marca nacional',
    description: 'Una marca conocida. Un cheque anual sólido y estable.',
    baseMultiplier: 1.0,
    europeMultiplier: 0.15,
  },
  {
    id: 'ambicioso',
    name: 'Apuesta arriesgada',
    description: 'Fija baja, pero paga a lo grande si clasificas para Europa.',
    baseMultiplier: 0.7,
    europeMultiplier: 0.95,
  },
  {
    id: 'premium',
    name: 'Multinacional',
    description: 'La mayor cifra garantizada, con un extra si juegas en Europa.',
    baseMultiplier: 1.35,
    europeMultiplier: 0.25,
  },
];

/** Flat per-division floor for the season's sponsor base (euros). */
const DIVISION_BASE: Record<Division, number> = {
  primera: 6_000_000,
  segunda: 1_800_000,
};

/** How much of the squad's value feeds the sponsor base (a bigger club = fatter deals). */
const STRENGTH_FRACTION = 0.015;
/** Cap on the strength component so a galáctico squad doesn't break the economy. */
const STRENGTH_CAP = 10_000_000;

/**
 * The season's SPONSOR BASE: a division floor plus a slice of the squad's value,
 * nudged by a small seeded per-season jitter. Every tier's payment scales off
 * this, so the same career always sees the same offers this season.
 */
function seasonBase(career: CareerState): number {
  const startYear = seasonStartYear(career.temporada);
  const human = career.teams.find((t) => t.id === career.humanTeamId);
  const strength = human ? Math.min(STRENGTH_CAP, Math.round(squadValue(human, startYear) * STRENGTH_FRACTION)) : 0;
  // A ±10% jitter keyed to the season keeps the offers deterministic yet lively.
  const jitter = 0.9 + createRng(hashSeed(career.seed, 'sponsor', career.seasonNumber)).next01() * 0.2;
  return Math.round((DIVISION_BASE[career.division] + strength) * jitter);
}

/** True when the human's FINAL league finish this season earns a European place. */
export function qualifiesForEurope(career: CareerState): boolean {
  const table = currentStandings(career.season);
  const idx = table.findIndex((r) => r.teamId === career.humanTeamId);
  const position = idx < 0 ? table.length : idx + 1;
  return europaQualification(career.division, position) !== null;
}

/** A sponsor offer as shown to the manager this season. */
export interface SponsorOffer {
  id: SponsorId;
  name: string;
  description: string;
  /** Guaranteed annual payment (euros). */
  annual: number;
  /** Extra paid on top if the club qualifies for Europe this season (0 = none). */
  europeBonus: number;
  /** Whether this offer carries a European-qualification objective. */
  hasCondition: boolean;
}

/**
 * This season's sponsor offers, deterministic from seed + season + squad value.
 * Order matches the tier ladder (basic first) so the UI is stable.
 */
export function sponsorOffers(career: CareerState): SponsorOffer[] {
  const base = seasonBase(career);
  return SPONSOR_TIERS.map((tier) => {
    const europeBonus = Math.round(base * tier.europeMultiplier);
    return {
      id: tier.id,
      name: tier.name,
      description: tier.description,
      annual: Math.round(base * tier.baseMultiplier),
      europeBonus,
      hasCondition: europeBonus > 0,
    };
  });
}

/** The offer the club is currently signed to (defaults to the basic tier). */
export function activeSponsorOffer(career: CareerState): SponsorOffer {
  const offers = sponsorOffers(career);
  const id = career.sponsor?.sponsorId ?? DEFAULT_SPONSOR.sponsorId;
  return offers.find((o) => o.id === id) ?? offers.find((o) => o.id === 'basico') ?? offers[0]!;
}

/**
 * The sponsor's contribution to the just-finished season's income: the
 * guaranteed annual payment plus, if the tier has a Europe clause and the club
 * qualified, the conditional bonus. Pure — added into `seasonIncome`.
 */
export function sponsorIncome(career: CareerState): number {
  const offer = activeSponsorOffer(career);
  const bonus = offer.europeBonus > 0 && qualifiesForEurope(career) ? offer.europeBonus : 0;
  return offer.annual + bonus;
}

/** True if `id` is one of the known sponsor tiers. */
export function isSponsorId(id: string): id is SponsorId {
  return SPONSOR_TIERS.some((t) => t.id === id);
}

/**
 * Sign the chosen sponsor tier. A pure DECISION: it records the choice on the
 * career (persisted in the save) and touches nothing else — the money arrives at
 * season end via `seasonIncome`. Unknown ids are ignored (career unchanged).
 */
export function chooseSponsor(career: CareerState, sponsorId: SponsorId): CareerState {
  if (!isSponsorId(sponsorId)) return career;
  return { ...career, sponsor: { sponsorId } };
}
