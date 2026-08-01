import type { FlavorEventType, Line } from './types';

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
  /**
   * Chance generation "por lances", faithful to PC Fútbol §2.2 (goles formula).
   * Per team per half: `raw = chanceBase + rng.int(chanceNoise) + round(diff /
   * strengthDivisor)` is HARD-CAPPED at `chanceCapBase - rng.int(chanceCapSpread)`
   * — PCF5's confirmed `tope = 3 - rand()%3` (1..3) — and then extended by a
   * geometric tail (`while rng.int(goalTailDenom)===0 chances++`), PCF5's
   * `while rand()%4==0` that lets the occasional goleada through. Each resulting
   * chance is then filtered by the rival keeper.
   */
  /** Base chances per team per half before noise/differential. */
  chanceBase: 1,
  /**
   * Random noise added to the base: `rng.int(chanceNoise)` → 0..chanceNoise-1.
   * PCF7 uses `rand()%3`; PCF5 used `rand()%8` but the hard cap below clips it, so
   * the later (refined) value is the faithful one.
   */
  chanceNoise: 3,
  /**
   * Line-strength differential divisor: `round((attack - rivalDefense) /
   * strengthDivisor)`. Faithful to PCF7's `(media_ataque - media_defensa)/6`.
   */
  strengthDivisor: 8,
  /** Per-half hard cap base — see `chanceCapSpread` (PCF5 `3 - rand()%3`). */
  chanceCapBase: 3,
  /** Per-half hard cap spread: cap = `chanceCapBase - rng.int(chanceCapSpread)` → 1..3. */
  chanceCapSpread: 3,
  /**
   * Geometric tail — PCF5's `while rand()%4==0` (a flat 1/4 chance to keep
   * shooting), which lets the occasional goleada slip past the per-half cap.
   * `tailProbBase` is that confirmed 1/4. We make the tail DIFFERENTIAL-AWARE
   * (`+ diff * tailProbSlope`, clamped to [tailProbMin, tailProbMax]) so line
   * strength — and therefore the chosen formation — keeps shaping the score ABOVE
   * the hard cap; with a flat tail the confirmed cap flattens attacking play into
   * the RNG noise. PCF7 likewise enriched the tactical layer with float weights
   * (comparativa §1.1), so a strength-aware production is in the saga's spirit.
   * [HIPÓTESIS] on the exact slope; base 1/4 is [ALTA].
   */
  tailProbBase: 0.25,
  tailProbSlope: 0.005,
  tailProbMin: 0.12,
  tailProbMax: 0.45,
  /**
   * Keeper-filter efficacy: a chance is a goal when `rng.int(100) >= keeper *
   * keeperEfficacy`. The keeper filter is PCF5's real regulator of the scoreline
   * (§2.3) and its efficacy is the sanctioned calibration knob (§7.2) that lands
   * the league-average keeper at the ~2.6 goals/game target; a raw filter against
   * elite-keeper (78+) test squads would over-suppress the capped chance stream.
   */
  keeperEfficacy: 0.88,
  /** Attack bonus for the home side (localía). */
  homeAttackBonus: 8,
  /**
   * Derby motivation: in a derbi both teams raise their intensity. It scales the
   * OUTFIELD ratings (attack AND defense) of BOTH sides by `1 + derbyMotivation`,
   * leaving the goalkeeper untouched. Because the change is symmetric and the
   * keeper — the real regulator of the scoreline — is not touched, the goals/game
   * average is preserved (the same reasoning the fatigue channel relies on); it
   * only amplifies, ever so slightly, the quality gap between the two rivals.
   */
  derbyMotivation: 0.06,
  /** Booking attempts per team per half. */
  yellowAttemptsPerHalf: 6,
  /** A booking attempt sticks with probability 1/yellowChanceDenom. */
  yellowChanceDenom: 4,
  /** Direct red probability per team per half: 1/directRedDenom. */
  directRedDenom: 60,
  /**
   * Injury probability per fielded player per match: 1/injuryChanceDenom. Rolled
   * on its OWN isolated RNG so it never perturbs the goal/card stream.
   */
  injuryChanceDenom: 200,
  /** Injury lay-off is 1..injuryMaxMatches matchdays (inclusive). */
  injuryMaxMatches: 8,
  /** Scorer roulette weights by line (forwards score more). */
  scorerWeights: { POR: 0, DEF: 1, MED: 3, DEL: 5 } satisfies Record<Line, number>,
  /** Booking weights by line (defenders/midfielders foul more). */
  cardWeights: { POR: 1, DEF: 3, MED: 3, DEL: 1 } satisfies Record<Line, number>,
  /**
   * Flavor events (paradas, ocasiones falladas, córners, tiros al palo, faltas)
   * add teletipo colour only. They are rolled on a DEDICATED, isolated RNG so
   * they never perturb the goal/card/injury stream that decides the result.
   * Per team per half we roll `flavorBase + rng.int(flavorSpread)` flavor beats.
   */
  flavorBase: 1,
  flavorSpread: 4,
  /**
   * Type roulette for a flavor beat. `foul` picks a fouler via `cardWeights`;
   * every other flavor type picks an attacker via `scorerWeights`.
   */
  flavorWeights: { saved: 5, offTarget: 4, corner: 5, post: 1, foul: 3 } satisfies Record<
    FlavorEventType,
    number
  >,
} as const;
