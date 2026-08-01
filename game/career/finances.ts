/**
 * Per-season income for the human club. Pure and deterministic: everything
 * comes from the finished season's outcomes (league finish, Copa and European
 * runs), so the same career always earns the same money.
 *
 * Amounts are whole euros, sized to matter against squad-value-based budgets
 * (see market.ts): a top-flight campaign brings in tens of millions, a Segunda
 * one far less. This is what turns "budget carries over" into a real economy.
 */
import { currentStandings } from '../season/season';
import type { CareerState } from './types';
import type { KnockoutRound } from '../tournament/tournament';
import { gateMultiplier } from './stadium';
import { sponsorIncome } from './sponsors';

export interface SeasonIncome {
  /** TV rights (flat per division). */
  tv: number;
  /** Gate receipts across the home matches (per division, scaled by the aforo). */
  gate: number;
  /** League prize money, scaled by final position. */
  leaguePrize: number;
  /** Copa del Rey performance bonus. */
  copa: number;
  /** European competition bonus (qualifying + progress). */
  europa: number;
  /** Main sponsor payment (guaranteed annual + any Europe bonus). See sponsors.ts. */
  sponsor: number;
  total: number;
}

const TV = { primera: 20_000_000, segunda: 5_000_000 } as const;
const GATE = { primera: 12_000_000, segunda: 3_000_000 } as const;
/** League prize per rank climbed above last place. */
const PRIZE_PER_RANK = { primera: 1_200_000, segunda: 300_000 } as const;

/** How many knockout ties the human actually won in a bracket. */
function roundsWon(knockout: readonly KnockoutRound[], teamId: string): number {
  let won = 0;
  for (const round of knockout) {
    const tie = round.ties.find((t) => t.homeId === teamId || t.awayId === teamId);
    if (tie && tie.winnerId === teamId) won += 1;
  }
  return won;
}

/** The human's final league position this season (1-indexed). */
function leaguePosition(career: CareerState): number {
  const table = currentStandings(career.season);
  const idx = table.findIndex((r) => r.teamId === career.humanTeamId);
  return idx < 0 ? table.length : idx + 1;
}

/** Copa del Rey money: a per-round bonus plus a champion top-up. */
function copaIncome(career: CareerState): number {
  const copa = career.copa;
  if (!copa) return 0;
  const won = roundsWon(copa.knockout, career.humanTeamId);
  const champion = copa.championId === career.humanTeamId ? 4_000_000 : 0;
  return won * 800_000 + champion;
}

/** European money: a base for qualifying plus a per-round bonus in that comp. */
function europaIncome(career: CareerState): number {
  const europa = career.europa;
  if (!europa || !europa.humanComp) return 0;
  if (europa.humanComp === 'champions') {
    const won = roundsWon(europa.champions.knockout, career.humanTeamId);
    const champion = europa.champions.championId === career.humanTeamId ? 12_000_000 : 0;
    return 8_000_000 + won * 2_500_000 + champion;
  }
  const won = roundsWon(europa.uefa.knockout, career.humanTeamId);
  const champion = europa.uefa.championId === career.humanTeamId ? 6_000_000 : 0;
  return 3_000_000 + won * 1_200_000 + champion;
}

/** All of the human club's income for the just-finished season, broken down. */
export function seasonIncome(career: CareerState): SeasonIncome {
  const division = career.division;
  const table = currentStandings(career.season);
  const position = leaguePosition(career);
  const rankFromBottom = table.length - position + 1; // 1 = last, N = first

  const tv = TV[division];
  // The taquilla scales with the stadium's aforo: a bigger ground you invested in
  // brings in more gate money every season (see stadium.ts).
  const gate = Math.round(GATE[division] * gateMultiplier(career.stadium));
  const leaguePrize = rankFromBottom * PRIZE_PER_RANK[division];
  const copa = copaIncome(career);
  const europa = europaIncome(career);
  // The main sponsor pays a guaranteed annual cheque (plus a Europe bonus for
  // some tiers) — the manager's chosen offer, see sponsors.ts.
  const sponsor = sponsorIncome(career);

  return {
    tv,
    gate,
    leaguePrize,
    copa,
    europa,
    sponsor,
    total: tv + gate + leaguePrize + copa + europa + sponsor,
  };
}
