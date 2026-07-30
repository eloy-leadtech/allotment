import type { Line } from './types';

/**
 * Match calibration constants — the single place to tune the simulation.
 *
 * Model (por lances, faithful to PC Fútbol): per half, each team generates a
 * number of chances from its attack vs the rival defense; each chance becomes a
 * goal only if it beats the rival keeper (`rng.int(100) >= keeperRating`). That
 * goalkeeper filter is the real regulator of the scoreline. Target ~2.6 goals/game.
 */
export const MATCH_CONFIG = {
  /** Two halves of 45'. Extra time (copas) will extend this later. */
  phases: [
    { start: 1, length: 45 },
    { start: 46, length: 45 },
  ],
  /** Base chances per team per half before adjustments. */
  chanceBase: 2,
  /** Random spread added to the base: rng.int(chanceSpread). */
  chanceSpread: 3,
  /** Chances gained per point of (attackStrength - rivalDefenseStrength). */
  strengthSlope: 0.03,
  /** Attack bonus for the home side (localía). */
  homeAttackBonus: 8,
  /** Booking attempts per team per half. */
  yellowAttemptsPerHalf: 6,
  /** A booking attempt sticks with probability 1/yellowChanceDenom. */
  yellowChanceDenom: 4,
  /** Direct red probability per team per half: 1/directRedDenom. */
  directRedDenom: 60,
  /** Scorer roulette weights by line (forwards score more). */
  scorerWeights: { POR: 0, DEF: 1, MED: 3, DEL: 5 } satisfies Record<Line, number>,
  /** Booking weights by line (defenders/midfielders foul more). */
  cardWeights: { POR: 1, DEF: 3, MED: 3, DEL: 1 } satisfies Record<Line, number>,
} as const;
