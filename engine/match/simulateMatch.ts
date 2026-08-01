import { createRng, hashSeed, type Rng } from '../rng';
import { MATCH_CONFIG } from './config';
import { selectStartingXI } from './lineup';
import { computeStrength, type TeamStrength } from './strength';
import { formationMods } from './formation';
import type {
  FlavorEventType,
  Line,
  MatchEvent,
  MatchInput,
  MatchPlayer,
  MatchResult,
  MatchTeam,
} from './types';
import { FLAVOR_EVENT_TYPES } from './types';

/** Roulette-wheel pick over a lineup, weighted per line. */
function pickWeighted(
  xi: readonly MatchPlayer[],
  weights: Record<Line, number>,
  rng: Rng,
): MatchPlayer {
  const first = xi[0];
  if (!first) {
    throw new Error('Cannot pick from an empty lineup');
  }
  let total = 0;
  for (const p of xi) total += weights[p.posicion];
  if (total <= 0) {
    return xi[rng.int(xi.length)] ?? first;
  }
  let ticket = rng.int(total);
  for (const p of xi) {
    ticket -= weights[p.posicion];
    if (ticket < 0) return p;
  }
  return first;
}

/**
 * Simulate one match deterministically from its seed. Produces the final score
 * and the ordered `MatchEvent[]` (the single source that feeds teletipo/viewer).
 */
/** Starting XI for a side: the team's chosen XI, else the auto-selected best. */
function lineupFor(team: MatchTeam): MatchPlayer[] {
  return team.tactics?.xi ?? selectStartingXI(team.players);
}

/** Base strength scaled by the team's formation (neutral when none chosen). */
function effectiveStrength(team: MatchTeam, xi: readonly MatchPlayer[]): TeamStrength {
  const base = computeStrength(xi);
  const mods = formationMods(team.tactics?.formation);
  return {
    attack: base.attack * mods.attack,
    defense: base.defense * mods.defense,
    keeper: base.keeper,
  };
}

export function simulateMatch(input: MatchInput): MatchResult {
  const rng = createRng(input.seed);
  const homeXI = lineupFor(input.home);
  const awayXI = lineupFor(input.away);
  const homeStrength = effectiveStrength(input.home, homeXI);
  const awayStrength = effectiveStrength(input.away, awayXI);

  const events: MatchEvent[] = [];
  const yellowCount = new Map<string, number>();
  const firstYellowMin = new Map<string, number>();
  let homeGoals = 0;
  let awayGoals = 0;

  const sides = [
    { key: 'home' as const, xi: homeXI, strength: homeStrength, rival: awayStrength, homeBonus: MATCH_CONFIG.homeAttackBonus },
    { key: 'away' as const, xi: awayXI, strength: awayStrength, rival: homeStrength, homeBonus: 0 },
  ];

  for (const phase of MATCH_CONFIG.phases) {
    for (const side of sides) {
      const attack = side.strength.attack + side.homeBonus;
      const diff = attack - side.rival.defense;
      const chances = Math.max(
        0,
        MATCH_CONFIG.chanceBase + rng.int(MATCH_CONFIG.chanceSpread) + Math.round(diff * MATCH_CONFIG.strengthSlope),
      );

      for (let c = 0; c < chances; c += 1) {
        const shooter = pickWeighted(side.xi, MATCH_CONFIG.scorerWeights, rng);
        const min = phase.start + rng.int(phase.length);
        // Goalkeeper filter: the shot is a goal only if it beats the rival keeper.
        const isGoal = rng.int(100) >= side.rival.keeper;
        if (isGoal) {
          if (side.key === 'home') homeGoals += 1;
          else awayGoals += 1;
        }
        events.push({
          min,
          type: isGoal ? 'goal' : 'chance',
          team: side.key,
          playerId: shooter.id,
          playerName: shooter.nombre,
        });
      }

      for (let y = 0; y < MATCH_CONFIG.yellowAttemptsPerHalf; y += 1) {
        if (rng.int(MATCH_CONFIG.yellowChanceDenom) === 0) {
          const fouler = pickWeighted(side.xi, MATCH_CONFIG.cardWeights, rng);
          const rawMin = phase.start + rng.int(phase.length);
          const prev = yellowCount.get(fouler.id) ?? 0;
          if (prev === 0) {
            yellowCount.set(fouler.id, 1);
            firstYellowMin.set(fouler.id, rawMin);
            events.push({ min: rawMin, type: 'yellow', team: side.key, playerId: fouler.id, playerName: fouler.nombre });
          } else if (prev === 1) {
            yellowCount.set(fouler.id, 2);
            // A second yellow must come after the first one.
            const min = Math.min(90, Math.max(rawMin, (firstYellowMin.get(fouler.id) ?? 0) + 1));
            events.push({ min, type: 'secondYellow', team: side.key, playerId: fouler.id, playerName: fouler.nombre });
          }
        }
      }

      if (rng.int(MATCH_CONFIG.directRedDenom) === 0) {
        const player = pickWeighted(side.xi, MATCH_CONFIG.cardWeights, rng);
        const min = phase.start + rng.int(phase.length);
        events.push({ min, type: 'red', team: side.key, playerId: player.id, playerName: player.nombre });
      }
    }
  }

  // Injuries: rolled on a dedicated RNG (seed derived per player) so they are
  // deterministic per season+jornada+player yet never disturb the goal/card
  // stream above. Only fielded players (the XI) can get injured.
  for (const side of sides) {
    for (const player of side.xi) {
      const injuryRng = createRng(hashSeed(input.seed, 'injury', player.id));
      if (injuryRng.int(MATCH_CONFIG.injuryChanceDenom) === 0) {
        const matchesOut = injuryRng.int(MATCH_CONFIG.injuryMaxMatches) + 1;
        const min = 1 + injuryRng.int(90);
        events.push({
          min,
          type: 'injury',
          team: side.key,
          playerId: player.id,
          playerName: player.nombre,
          matchesOut,
        });
      }
    }
  }

  // Flavor beats (paradas, ocasiones falladas, córners, palos, faltas): rolled on
  // a DEDICATED RNG derived from the seed so they are deterministic yet CANNOT
  // perturb the goal/card/injury stream above. They only add teletipo colour and
  // never touch homeGoals/awayGoals.
  const flavorRng = createRng(hashSeed(input.seed, 'flavor'));
  for (const phase of MATCH_CONFIG.phases) {
    for (const side of sides) {
      const beats = MATCH_CONFIG.flavorBase + flavorRng.int(MATCH_CONFIG.flavorSpread);
      for (let b = 0; b < beats; b += 1) {
        const type = pickFlavorType(flavorRng);
        const weights = type === 'foul' ? MATCH_CONFIG.cardWeights : MATCH_CONFIG.scorerWeights;
        const player = pickWeighted(side.xi, weights, flavorRng);
        const min = phase.start + flavorRng.int(phase.length);
        events.push({ min, type, team: side.key, playerId: player.id, playerName: player.nombre });
      }
    }
  }

  events.sort((a, b) => a.min - b.min);
  return { homeId: input.home.id, awayId: input.away.id, homeGoals, awayGoals, events };
}

/** Roulette-wheel pick of a flavor event type, weighted by `flavorWeights`. */
function pickFlavorType(rng: Rng): FlavorEventType {
  let total = 0;
  for (const t of FLAVOR_EVENT_TYPES) total += MATCH_CONFIG.flavorWeights[t];
  let ticket = rng.int(total);
  for (const t of FLAVOR_EVENT_TYPES) {
    ticket -= MATCH_CONFIG.flavorWeights[t];
    if (ticket < 0) return t;
  }
  return FLAVOR_EVENT_TYPES[0];
}
