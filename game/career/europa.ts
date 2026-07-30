/**
 * European competition your club plays alongside the league within a season.
 * Pure and deterministic: everything derives from the career seed + season
 * number, so it can be regenerated on load instead of persisted in the save.
 *
 * Two competitions run each season over the top European clubs (from the
 * committed `europa-<yr>` databases): the Champions (a group stage + knockout,
 * reusing the tournament engine) and the UEFA (a straight knockout, reusing the
 * Copa engine). The human is INJECTED into whichever one they qualified for by
 * their previous league finish; when they didn't qualify, both still run (as a
 * spectator's bracket) but `humanComp` is null.
 */
import { hashSeed, type CompetitionTeam } from '@engine';
import { runTournament, type TournamentResult } from '../tournament/tournament';
import { runCopa, type CopaResult } from '../tournament/copa';
import type { Division } from './promotion';

/** Which continental competition, if any, the human plays this season. */
export type EuropeanComp = 'champions' | 'uefa';

export interface EuropaResult {
  temporada: string;
  /** Champions: 16 clubs, 4 groups of 4, top-2 into a knockout. */
  champions: TournamentResult;
  /** UEFA: 16 clubs, straight knockout. */
  uefa: CopaResult;
  /** The competition the human is in this season, or null if not qualified. */
  humanComp: EuropeanComp | null;
}

/** Clubs per continental competition (Champions 4×4 groups; UEFA knockout-16). */
const CHAMPIONS_SIZE = 16;
const UEFA_SIZE = 16;

/**
 * Europe qualification from the previous season's league finish. Primera: the
 * top 2 go to the Champions, the next 4 (3rd–6th) to the UEFA. Segunda (or no
 * previous season) does not qualify.
 */
export function europaQualification(
  division: Division | undefined,
  position: number | undefined,
): EuropeanComp | null {
  if (division !== 'primera' || position === undefined) return null;
  if (position <= 2) return 'champions';
  if (position <= 6) return 'uefa';
  return null;
}

/** Squad strength = mean rating of a club's best 11 players (for seeding fields). */
function squadStrength(team: CompetitionTeam): number {
  const medias = team.players.map((p) => p.media).sort((a, b) => b - a);
  const best = medias.slice(0, 11);
  if (best.length === 0) return 0;
  return best.reduce((s, m) => s + m, 0) / best.length;
}

/**
 * Run this season's European competitions. `europaClubs` are the continental
 * clubs (no Spanish sides); `human` is the human's current squad plus the comp
 * they qualified for (null = spectator). Fields are seeded by squad strength.
 */
export function runCareerEuropa(
  seed: number,
  seasonNumber: number,
  temporada: string,
  europaClubs: readonly CompetitionTeam[],
  human: { team: CompetitionTeam; comp: EuropeanComp | null },
): EuropaResult {
  // The human is a domestic club, never already in the continental pool; guard
  // anyway so a stray duplicate can't put a club in twice.
  const pool = europaClubs.filter((t) => t.id !== human.team.id);
  const ranked = [...pool].sort((a, b) => squadStrength(b) - squadStrength(a));

  const championsSlots = human.comp === 'champions' ? CHAMPIONS_SIZE - 1 : CHAMPIONS_SIZE;
  const uefaSlots = human.comp === 'uefa' ? UEFA_SIZE - 1 : UEFA_SIZE;

  let championsClubs = ranked.slice(0, championsSlots);
  let uefaClubs = ranked.slice(championsSlots, championsSlots + uefaSlots);
  if (human.comp === 'champions') championsClubs = [...championsClubs, human.team];
  if (human.comp === 'uefa') uefaClubs = [...uefaClubs, human.team];

  const champions = runTournament(championsClubs, hashSeed(seed, 'champions', seasonNumber), 4);
  const uefa = runCopa(uefaClubs, hashSeed(seed, 'uefa', seasonNumber));

  return { temporada, champions, uefa, humanComp: human.comp };
}
