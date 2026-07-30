/**
 * Extra competitions your club plays alongside the league within a season.
 * Pure and deterministic: each is derived from the career seed + season number,
 * so it can be regenerated on load instead of persisted in the save.
 */
import { hashSeed, type CompetitionTeam } from '@engine';
import { runCopa, type CopaResult } from '../tournament/copa';

/**
 * Run this season's Copa del Rey. `domesticTeams` is the whole domestic field
 * (Primera + Segunda) with the human's evolved squad included, so their run
 * reflects their current team.
 */
export function runCareerCopa(
  seed: number,
  seasonNumber: number,
  domesticTeams: readonly CompetitionTeam[],
): CopaResult {
  return runCopa(domesticTeams, hashSeed(seed, 'copa', seasonNumber));
}
