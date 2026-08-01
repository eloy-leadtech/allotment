import type { MatchPlayer } from './types';
import { performanceMultiplier } from './morale';

export interface TeamStrength {
  attack: number;
  defense: number;
  keeper: number;
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
 * and keeper (the goalkeeper's porteria). Each player's contribution is scaled
 * by their form/morale performance multiplier (exactly 1 when neutral, so a
 * squad with no streak data behaves exactly as before).
 */
export function computeStrength(xi: readonly MatchPlayer[]): TeamStrength {
  const outfield = xi.filter((p) => !p.esPortero);
  const goalkeeper = xi.find((p) => p.esPortero);
  return {
    attack: mean(
      outfield.map((p) => ((p.ofensivo + p.remate) / 2) * performanceMultiplier(p.form, p.morale)),
    ),
    defense: mean(outfield.map((p) => p.entrada * performanceMultiplier(p.form, p.morale))),
    keeper: goalkeeper
      ? keeperEffective(goalkeeper.porteria, performanceMultiplier(goalkeeper.form, goalkeeper.morale))
      : mean(xi.map((p) => p.porteria)),
  };
}
