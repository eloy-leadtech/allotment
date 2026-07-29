import type { Fixture } from './types';

/**
 * Double round-robin calendar via the circle method.
 *
 * For N teams (N even) it produces 2·(N-1) rounds of N/2 matches each; every
 * ordered pairing (A home vs B, and B home vs A) appears exactly once. Odd N is
 * supported by adding a bye (the team resting that round plays no match).
 *
 * Deterministic: the schedule is a pure function of the input order. Callers that
 * want per-season variety should shuffle `teamIds` with a seeded RNG beforehand.
 */
export function generateDoubleRoundRobin(teamIds: readonly string[]): Fixture[] {
  if (teamIds.length < 2) {
    throw new Error('A calendar needs at least 2 teams');
  }

  const BYE = '__bye__';
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) {
    teams.push(BYE);
  }

  const n = teams.length;
  const half = n / 2;
  const singleRounds = n - 1;
  const fixtures: Fixture[] = [];

  // First leg (single round-robin).
  const rotation = [...teams];
  for (let r = 0; r < singleRounds; r += 1) {
    for (let i = 0; i < half; i += 1) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a === undefined || b === undefined || a === BYE || b === BYE) {
        continue;
      }
      // Alternate home/away each round so the schedule stays balanced.
      const [homeId, awayId] = r % 2 === 0 ? [a, b] : [b, a];
      fixtures.push({ round: r + 1, homeId, awayId });
    }
    // Rotate: fix the first team, move the last into position 1.
    const moved = rotation.pop();
    if (moved !== undefined) {
      rotation.splice(1, 0, moved);
    }
  }

  // Second leg: mirror the first leg with venues swapped.
  const firstLegCount = fixtures.length;
  for (let k = 0; k < firstLegCount; k += 1) {
    const f = fixtures[k];
    if (f === undefined) continue;
    fixtures.push({ round: f.round + singleRounds, homeId: f.awayId, awayId: f.homeId });
  }

  return fixtures;
}
