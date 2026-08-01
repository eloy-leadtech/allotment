import type { MatchPlayer } from './types';
import { performanceMultiplier } from './morale';
import { fatigueMultiplier } from './fatigue';

export interface TeamStrength {
  attack: number;
  defense: number;
  keeper: number;
}

/**
 * An outfield player's combined performance multiplier: form/morale streak times
 * the fatigue penalty. Exactly 1 when neutral+fresh, so a squad with no streak or
 * fatigue data behaves exactly as before. Fatigue only ever pulls it below 1.
 */
function outfieldMultiplier(p: MatchPlayer): number {
  return performanceMultiplier(p.form, p.morale) * fatigueMultiplier(p.fatigue);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * The form/morale multiplier for a keeper's `porteria`. A boost is capped to a
 * few rating points so a red-hot keeper never becomes literally unbeatable
 * (which would sink the goals-per-game balance); a slump applies in full.
 */
function keeperEffective(porteria: number, mult: number): number {
  if (mult <= 1) return porteria * mult;
  return Math.min(porteria + 6, porteria * mult);
}

/**
 * Reduce a starting XI to the three ratings the simulation reasons about:
 * attack (mean of ofensivo+remate over outfielders), defense (mean of entrada)
 * and keeper (the goalkeeper's porteria). Outfielders are scaled by their
 * combined form/morale + fatigue multiplier (exactly 1 when neutral and fresh, so
 * a squad with no streak/fatigue data behaves exactly as before). The keeper —
 * the real regulator of the scoreline — takes only the form/morale multiplier,
 * NOT fatigue: since both teams tire symmetrically, a fatigue penalty on the
 * outfield barely moves the goal count, but penalising the keeper's shot-stopping
 * would inflate scoring and break the ~2.6 goals/game balance.
 */
export function computeStrength(xi: readonly MatchPlayer[]): TeamStrength {
  const outfield = xi.filter((p) => !p.esPortero);
  const goalkeeper = xi.find((p) => p.esPortero);
  return {
    attack: mean(outfield.map((p) => ((p.ofensivo + p.remate) / 2) * outfieldMultiplier(p))),
    defense: mean(outfield.map((p) => p.entrada * outfieldMultiplier(p))),
    keeper: goalkeeper
      ? keeperEffective(goalkeeper.porteria, performanceMultiplier(goalkeeper.form, goalkeeper.morale))
      : mean(xi.map((p) => p.porteria)),
  };
}
