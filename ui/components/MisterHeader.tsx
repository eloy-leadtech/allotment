import {
  currentStandings,
  formatEuros,
  isSeasonOver,
  nextHumanFixture,
  teamName,
} from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { Crest } from './Crest';

/* Persistent header of the Mister console: your club on the left, the next
   match on the right, both crests peeking out of the thin bar, and the
   season plate mounted over the centre. Port of the mockup's .head-barra. */

export function MisterHeader() {
  const career = useGameStore((s) => s.career);
  const season = useGameStore((s) => s.season);
  if (!career || !season) return null;

  const clubId = career.humanTeamId;
  const club = teamName(season, clubId);
  const rows = currentStandings(season);
  const idx = rows.findIndex((r) => r.teamId === clubId);
  const row = idx >= 0 ? rows[idx] : undefined;
  const over = isSeasonOver(season);
  const fixture = over ? null : nextHumanFixture(season);
  const rivalId = fixture ? (fixture.homeId === clubId ? fixture.awayId : fixture.homeId) : null;
  const enCasa = fixture ? fixture.homeId === clubId : false;
  const played = Math.max(0, season.currentMatchday - 1);

  return (
    <header className="mst-head">
      <div className="mst-head__barra">
        <div className="mst-head__lado">
          <span className="mst-head__esc">
            <Crest teamId={clubId} size={86} />
          </span>
          <span className="mst-head__txt">
            <span className="mst-head__name">{club}</span>
            <span className="mst-head__sub">
              {row && (
                <>
                  <b>{idx + 1}.º</b> en liga<i>·</i>
                  <b>{row.points} pts</b>
                  <i>·</i>
                </>
              )}
              Saldo <b>{formatEuros(career.budget)}</b>
            </span>
          </span>
        </div>

        <div className="mst-head__lado mst-head__lado--rival">
          <span className="mst-head__txt">
            <span className="mst-head__lbl">{over ? 'Temporada' : 'Próximo partido'}</span>
            <span className="mst-head__name">
              {over ? 'Temporada terminada' : rivalId ? teamName(season, rivalId) : '—'}
            </span>
            {!over && fixture && (
              <span className="mst-head__sub">
                Jornada {fixture.round}
                <i>·</i>
                <em>{enCasa ? 'Casa' : 'Fuera'}</em>
              </span>
            )}
          </span>
          {rivalId && (
            <span className="mst-head__esc">
              <Crest teamId={rivalId} size={86} />
            </span>
          )}
        </div>
      </div>

      <div className="mst-head__comp">
        <span className="mst-head__date">
          Temporada <em>{career.temporada}</em>
        </span>
        <span className="mst-head__week">
          Jugadas {played} de {season.totalMatchdays}
        </span>
      </div>
    </header>
  );
}
