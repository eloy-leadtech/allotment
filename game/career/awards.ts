import { computeSeasonAwards, type SeasonAwards } from '@engine';
import type { CareerState } from './types';

/**
 * The individual trophies (Pichichi + Zamora) for the career's in-progress
 * season, computed live from the results played so far. Used by the season-end
 * screen, where the finished season is not yet a history line. Pure and
 * deterministic: it reads the same results the standings do.
 */
export function currentSeasonAwards(career: CareerState): SeasonAwards {
  return computeSeasonAwards(career.season.results, career.season.teams);
}
