/**
 * The club's palmarés — the human's own trophies, PC Fútbol style.
 *
 * Pure and deterministic: at each season transition we ask "what did the human
 * win THIS season?" and append those titles to the running palmarés. A season is
 * inspected through the career it just finished, which carries:
 *   - the league champion (passed in, since the caller already computed it),
 *   - this season's Copa del Rey (`career.copa`), and
 *   - this season's European cups (`career.europa`).
 *
 * The Copa/Europa results are regenerated deterministically on load, so nothing
 * here depends on persisted cup data: the titles themselves are what we persist.
 */
import type { CareerState, PalmaresTitle, TitleCompetition } from './types';
import type { Division } from './promotion';

/**
 * The titles the human club won in the just-finished season of `career`.
 *
 * - Liga: the human is the champion of their own division (caller passes the
 *   league champion so we don't recompute the standings).
 * - Copa del Rey: the human is the Copa champion.
 * - Champions / UEFA: the human won the continental cup they actually played in
 *   (`europa.humanComp`); a title in the other cup is some AI club's, not yours.
 */
export function titlesWonThisSeason(
  career: CareerState,
  leagueChampionId: string,
): PalmaresTitle[] {
  const titles: PalmaresTitle[] = [];
  const me = career.humanTeamId;
  const base = { seasonNumber: career.seasonNumber, temporada: career.temporada };

  if (leagueChampionId === me) {
    titles.push({ competition: 'liga', division: career.division, ...base });
  }
  if (career.copa && career.copa.championId === me) {
    titles.push({ competition: 'copa', ...base });
  }
  const europa = career.europa;
  if (europa) {
    if (europa.humanComp === 'champions' && europa.champions.championId === me) {
      titles.push({ competition: 'champions', ...base });
    }
    if (europa.humanComp === 'uefa' && europa.uefa.championId === me) {
      titles.push({ competition: 'uefa', ...base });
    }
  }
  return titles;
}

/** Display name of a palmarés competition (a league title reflects its division). */
export function palmaresCompetitionLabel(
  competition: TitleCompetition,
  division?: Division,
): string {
  switch (competition) {
    case 'liga':
      return division === 'segunda' ? 'Liga de Segunda División' : 'Liga de Primera División';
    case 'copa':
      return 'Copa del Rey';
    case 'champions':
      return 'Champions';
    case 'uefa':
      return 'UEFA';
  }
}

/** A short trophy icon per competition, for the retro UI. */
export function palmaresCompetitionIcon(competition: TitleCompetition): string {
  return competition === 'champions' || competition === 'uefa' ? '🌍' : '🏆';
}
