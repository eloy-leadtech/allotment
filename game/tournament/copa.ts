/**
 * Copa del Rey: a straight single-elimination knockout among domestic clubs.
 * Pure and deterministic — reuses the tournament knockout tie/round primitives.
 * If the field isn't a power of two, the extra slots are byes (a team paired with
 * a bye advances without playing), so any number of clubs works.
 */
import { createRng, hashSeed, type CompetitionTeam } from '@engine';
import {
  resolveKnockoutTie,
  roundName,
  type HumanKnockoutStep,
  type KnockoutRound,
  type KnockoutTie,
} from './tournament';

export interface CopaResult {
  knockout: KnockoutRound[];
  championId: string;
  /**
   * The human's round-by-round knockout run WITH full matches, present only when
   * a `humanTeamId` was supplied. Omitted otherwise, so the spectator result is
   * byte-identical to before. Byes (rounds the human sat out) are not listed.
   */
  humanPath?: HumanKnockoutStep[];
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

/** Smallest power of two >= n. */
function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Run a full Copa knockout and return every round plus the champion. */
export function runCopa(
  teams: readonly CompetitionTeam[],
  seed: number,
  humanTeamId?: string,
): CopaResult {
  if (teams.length < 2) {
    const solo = { knockout: [] as KnockoutRound[], championId: teams[0]?.id ?? '' };
    return humanTeamId !== undefined ? { ...solo, humanPath: [] } : solo;
  }
  const byId = new Map(teams.map((t) => [t.id, t]));
  const drawn = shuffle(teams.map((t) => t.id), hashSeed(seed, 'copa-draw'));

  // Pad the bracket to a power of two; padding slots are byes.
  let alive: (string | null)[] = [...drawn];
  while (alive.length < nextPow2(drawn.length)) alive.push(null);

  const knockout: KnockoutRound[] = [];
  const humanPath: HumanKnockoutStep[] = [];
  let round = 0;
  while (alive.filter((x) => x !== null).length > 1) {
    const nombre = roundName(alive.length);
    const ties: KnockoutTie[] = [];
    const next: (string | null)[] = [];
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i] ?? null;
      const b = alive[i + 1] ?? null;
      if (a !== null && b !== null) {
        const { tie, match } = resolveKnockoutTie(a, b, byId, hashSeed(seed, 'copa', round, i));
        ties.push(tie);
        next.push(tie.winnerId);
        if (humanTeamId && (tie.homeId === humanTeamId || tie.awayId === humanTeamId)) {
          humanPath.push({ ronda: nombre, match, winnerId: tie.winnerId, onPenalties: tie.onPenalties });
        }
      } else {
        next.push(a ?? b); // a bye: the present team (if any) advances
      }
    }
    if (ties.length > 0) knockout.push({ nombre, ties });
    alive = next;
    round += 1;
  }

  const championId = alive.find((x) => x !== null) ?? '';
  return { knockout, championId, ...(humanTeamId !== undefined ? { humanPath } : {}) };
}
