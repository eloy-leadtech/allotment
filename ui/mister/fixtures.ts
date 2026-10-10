import {
  nextHumanFixture,
  teamName,
  type CareerState,
  type SeasonState,
  type HumanKnockoutStep,
} from '@game';

/**
 * One card in the "próximos partidos" bar: the next league fixture and, when the
 * club is in them, its cup/European runs. The knockout competitions are resolved
 * for the whole season up front, so their card reports the human's run (round
 * reached + outcome), mirroring the lab mockup (e.g. "Copa · octavos · Eliminado").
 */
export interface FxEntry {
  /** Competition key (also the ticker group and the logo slug under logos/). */
  key: 'liga' | 'copa' | 'uefa' | 'champions';
  /** Logo file slug under public/ui/mister/logos/. */
  logo: string;
  /** Rival team id (for its crest and the ticker), or null when there is none. */
  rivalId: string | null;
  rivalName: string;
  /** Left part of the meta line (".fx-round"). */
  roundLabel: string;
  /** Bold status segment, e.g. "Campeón", "Eliminado", "Temporada terminada". */
  status?: string;
  /** Emphasised tail, e.g. "Casa"/"Fuera" or an aggregate score. */
  detail?: string;
}

/** Summarise the human's finished knockout run from its path (last tie played). */
function summariseRun(
  path: readonly HumanKnockoutStep[],
  humanTeamId: string,
): { ronda: string; rivalId: string; status: string; detail: string } | null {
  const last = path.at(-1);
  if (!last) return null;
  const { match } = last;
  const rivalId = match.homeId === humanTeamId ? match.awayId : match.homeId;
  const champion = last.winnerId === humanTeamId;
  const home = match.homeId === humanTeamId;
  const gf = home ? match.homeGoals : match.awayGoals;
  const ga = home ? match.awayGoals : match.homeGoals;
  return {
    ronda: last.ronda,
    rivalId,
    status: champion ? 'Campeón' : 'Eliminado',
    detail: `${gf}-${ga}${last.onPenalties ? ' (pen.)' : ''}`,
  };
}

/** Build the fixtures bar for the current season (league always first). */
export function buildFixtures(season: SeasonState, career: CareerState | null): FxEntry[] {
  const human = season.humanTeamId;
  const entries: FxEntry[] = [];

  // League: the real next fixture (or "temporada terminada").
  const fx = nextHumanFixture(season);
  if (fx) {
    const rivalId = fx.homeId === human ? fx.awayId : fx.homeId;
    entries.push({
      key: 'liga',
      logo: 'lfp_1993',
      rivalId,
      rivalName: teamName(season, rivalId),
      roundLabel: `Jornada ${fx.round}`,
      detail: fx.homeId === human ? 'Casa' : 'Fuera',
    });
  } else {
    entries.push({
      key: 'liga',
      logo: 'laliga',
      rivalId: null,
      rivalName: '',
      roundLabel: 'Liga',
      status: 'Temporada terminada',
    });
  }

  // Copa: the human's cup run this season, if they played any tie.
  if (career?.copa?.humanPath?.length) {
    const run = summariseRun(career.copa.humanPath, human);
    if (run) {
      entries.push({
        key: 'copa',
        logo: 'copa',
        rivalId: run.rivalId,
        rivalName: teamName(season, run.rivalId) || run.rivalId,
        roundLabel: `Copa · ${run.ronda}`,
        status: run.status,
        detail: run.detail,
      });
    }
  }

  // Europe: the continental run, in whichever competition they qualified for.
  const comp = career?.europa?.humanComp ?? null;
  if (comp && career?.europa) {
    const path = comp === 'champions' ? career.europa.champions.humanPath : career.europa.uefa.humanPath;
    if (path?.length) {
      const run = summariseRun(path, human);
      if (run) {
        entries.push({
          key: comp,
          logo: comp,
          rivalId: run.rivalId,
          rivalName: teamName(season, run.rivalId) || run.rivalId,
          roundLabel: `${comp === 'champions' ? 'Champions' : 'UEFA'} · ${run.ronda}`,
          status: run.status,
          detail: run.detail,
        });
      }
    }
  }

  return entries;
}
