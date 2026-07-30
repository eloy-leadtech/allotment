import type { Formation } from './types';

/** Attack/defense multipliers a formation applies to a team's base strength. */
export interface FormationMods {
  attack: number;
  defense: number;
}

/**
 * Formation trade-offs: more forwards push `attack` up and `defense` down; more
 * defenders do the reverse. 4-4-2 is the neutral baseline. AI teams use the
 * neutral default, so the league's overall scoring calibration is unchanged;
 * only a team that explicitly picks a formation shifts its balance.
 */
export const FORMATIONS: Record<Formation, FormationMods> = {
  '5-4-1': { attack: 0.82, defense: 1.2 },
  '5-3-2': { attack: 0.9, defense: 1.12 },
  '4-5-1': { attack: 0.9, defense: 1.1 },
  '4-4-2': { attack: 1.0, defense: 1.0 },
  '4-3-3': { attack: 1.14, defense: 0.9 },
  '3-5-2': { attack: 1.08, defense: 0.94 },
  '3-4-3': { attack: 1.2, defense: 0.82 },
};

/** Formations from most defensive to most attacking (for menus). */
export const FORMATION_LIST: readonly Formation[] = [
  '5-4-1',
  '5-3-2',
  '4-5-1',
  '4-4-2',
  '3-5-2',
  '4-3-3',
  '3-4-3',
];

/** The neutral, balanced formation used when none is chosen. */
export const DEFAULT_FORMATION: Formation = '4-4-2';

/** Multipliers for a formation, or neutral (1,1) when none is given. */
export function formationMods(formation?: Formation): FormationMods {
  return formation ? FORMATIONS[formation] : { attack: 1, defense: 1 };
}
