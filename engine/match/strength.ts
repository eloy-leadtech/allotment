import type { MatchPlayer } from './types';

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
 * Reduce a starting XI to the three ratings the simulation reasons about:
 * attack (mean of ofensivo+remate over outfielders), defense (mean of entrada)
 * and keeper (the goalkeeper's porteria).
 */
export function computeStrength(xi: readonly MatchPlayer[]): TeamStrength {
  const outfield = xi.filter((p) => !p.esPortero);
  const goalkeeper = xi.find((p) => p.esPortero);
  return {
    attack: mean(outfield.map((p) => (p.ofensivo + p.remate) / 2)),
    defense: mean(outfield.map((p) => p.entrada)),
    keeper: goalkeeper ? goalkeeper.porteria : mean(xi.map((p) => p.porteria)),
  };
}
