/**
 * Copa del Rey: a straight single-elimination knockout among domestic clubs.
 * Pure and deterministic — reuses the tournament knockout tie/round primitives.
 * If the field isn't a power of two, the extra slots are byes (a team paired with
 * a bye advances without playing), so any number of clubs works.
 */
import { createRng, hashSeed, type CompetitionTeam } from '@engine';
import { playKnockoutTie, roundName, type KnockoutRound, type KnockoutTie } from './tournament';

export interface CopaResult {
  knockout: KnockoutRound[];
  championId: string;
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
export function runCopa(teams: readonly CompetitionTeam[], seed: number): CopaResult {
  if (teams.length < 2) {
    return { knockout: [], championId: teams[0]?.id ?? '' };
  }
  const byId = new Map(teams.map((t) => [t.id, t]));
  const drawn = shuffle(teams.map((t) => t.id), hashSeed(seed, 'copa-draw'));

  // Pad the bracket to a power of two; padding slots are byes.
  let alive: (string | null)[] = [...drawn];
  while (alive.length < nextPow2(drawn.length)) alive.push(null);

  const knockout: KnockoutRound[] = [];
  let round = 0;
  while (alive.filter((x) => x !== null).length > 1) {
    const ties: KnockoutTie[] = [];
    const next: (string | null)[] = [];
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i] ?? null;
      const b = alive[i + 1] ?? null;
      if (a !== null && b !== null) {
        const tie = playKnockoutTie(a, b, byId, hashSeed(seed, 'copa', round, i));
        ties.push(tie);
        next.push(tie.winnerId);
      } else {
        next.push(a ?? b); // a bye: the present team (if any) advances
      }
    }
    if (ties.length > 0) knockout.push({ nombre: roundName(alive.length), ties });
    alive = next;
    round += 1;
  }

  return { knockout, championId: alive.find((x) => x !== null) ?? '' };
}
