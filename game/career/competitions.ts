/**
 * Extra competitions your club plays alongside the league within a season.
 * Pure and deterministic: each is derived from the career seed + season number,
 * so it can be regenerated on load instead of persisted in the save.
 */
import { hashSeed, type CompetitionTeam } from '@engine';
import { runCopa, type CopaResult } from '../tournament/copa';

/**
 * Run this season's national knockout cup over the domestic field. The knockout
 * engine is country-agnostic (SPEC §3, E10), so this one function serves every
 * country's cup — Copa del Rey, Coppa Italia, FA Cup… — differing only in the
 * display name the caller attaches. `domesticTeams` is the whole domestic field
 * (the human's division, plus the other division when available) with the human's
 * evolved squad included, so their run reflects their current team.
 */
export function runCareerNationalCup(
  seed: number,
  seasonNumber: number,
  domesticTeams: readonly CompetitionTeam[],
  humanTeamId?: string,
): CopaResult {
  return runCopa(domesticTeams, hashSeed(seed, 'copa', seasonNumber), humanTeamId);
}

/**
 * Run this season's Copa del Rey — the Spanish national cup. Thin alias kept for
 * the Spanish registry path; delegates to the agnostic {@link runCareerNationalCup}
 * with the same seed derivation, so Spanish careers are byte-identical to before.
 */
export function runCareerCopa(
  seed: number,
  seasonNumber: number,
  domesticTeams: readonly CompetitionTeam[],
  humanTeamId?: string,
): CopaResult {
  return runCareerNationalCup(seed, seasonNumber, domesticTeams, humanTeamId);
}
