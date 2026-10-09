import type { ReactNode } from 'react';
import {
  isSeasonOver,
  teamName,
  isWinterWindowOpen,
  selectPressQuestion,
  currentStandings,
  formatEuros,
  nextHumanFixture,
} from '@game';
import { useGameStore } from '@ui/store/gameStore';
import type { Screen } from '@app/navigation';
import { Crest } from '@ui/components/Crest';
import { TowerButton } from '@ui/components/TowerButton';
import { MisterSprite } from '@ui/components/MisterSprite';
import { RetroButton } from '@ui/components/RetroButton';

/** One icon from the Mister sprite (ported from the lab mockup). */
function Ic({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 48 40" width="100%" height="100%" aria-hidden="true">
      <use href={`#ic-${id}`} />
    </svg>
  );
}

/**
 * DESPACHO — the office hub in the definitive Mister skin: a steel console over
 * the club's stadium, a header with the crest/standing/budget, and navigation
 * through towers of metal section buttons (NO tab strip), with the matchday
 * "play" call in the centre. Faithful port of the lab mockup (media/ui-ref).
 */
export function Despacho() {
  const season = useGameStore((s) => s.season);
  const career = useGameStore((s) => s.career);
  const hasEuropa = useGameStore((s) => s.career?.europa != null);
  const playNextMatchday = useGameStore((s) => s.playNextMatchday);
  const openWinterMarket = useGameStore((s) => s.openWinterMarket);
  const lastCallUp = useGameStore((s) => s.lastCallUp);
  const goTo = useGameStore((s) => s.goTo);

  if (!season) {
    return (
      <main className="screen">
        <p>No hay temporada en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const clubName = teamName(season, season.humanTeamId);
  const over = isSeasonOver(season);
  const playedMatchday = Math.min(season.currentMatchday, season.totalMatchdays);
  const stadiumBg = `${import.meta.env.BASE_URL}stadiums/${season.humanTeamId}.png`;

  const table = currentStandings(season);
  const myRow = table.find((r) => r.teamId === season.humanTeamId);
  const pos = myRow ? table.indexOf(myRow) + 1 : table.length;
  const pts = myRow?.points ?? 0;
  const budget = career?.budget ?? 0;
  const division = career?.division ?? 'primera';
  const divisionName = division === 'segunda' ? '2ª División' : '1ª División';
  const squad = career?.teams.find((t) => t.id === career.humanTeamId)?.players.length;

  const winterOpen = career ? isWinterWindowOpen(career) : false;
  const pressPending = career ? selectPressQuestion(career) != null : false;

  // Próximo partido (real) para la barra superior; null = aún por definir.
  const fixture = nextHumanFixture(season);
  const rival = fixture
    ? fixture.homeId === season.humanTeamId
      ? { id: fixture.awayId, home: true }
      : { id: fixture.homeId, home: false }
    : null;

  /** A section button: metal plate with its sprite icon and an onClick. */
  const sec = (
    to: Screen,
    icon: string,
    name: string,
    extra?: {
      hint?: ReactNode;
      hintTone?: 'alert' | 'good';
      pip?: 'alert' | 'pending';
      pipLabel?: string;
      disabled?: boolean;
    },
  ) => (
    <TowerButton
      key={name}
      name={name}
      icon={<Ic id={icon} />}
      hint={extra?.hint}
      hintTone={extra?.hintTone}
      pip={extra?.pip}
      pipLabel={extra?.pipLabel}
      disabled={extra?.disabled}
      onClick={() => goTo(to)}
    />
  );

  return (
    <main className="mst-wrap">
      <MisterSprite />
      <div className="mst-console">
        <img
          className="mst-bg"
          src={stadiumBg}
          alt=""
          aria-hidden="true"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="mst-grain" aria-hidden="true" />

        <div className="mst-screen">
          <header className="mst-head">
            <div className="mst-teamcard">
              <Crest teamId={season.humanTeamId} size={76} />
              <div className="mst-tc-txt">
                <span className="mst-tc-name">{clubName}</span>
                <span className="mst-tc-sub">
                  <b>{pos}.º</b> en Liga <i>·</i> <b>{pts} pts</b> <i>·</i> Saldo{' '}
                  <em>{formatEuros(budget)}</em>
                </span>
              </div>
            </div>
            <div className="mst-today">
              <span className="mst-today-date">
                {over ? 'FIN' : `J${playedMatchday}`}
                <em>/{season.totalMatchdays}</em>
              </span>
              <span className="mst-today-week">
                {season.temporada} · {divisionName}
              </span>
            </div>
            <div className="mst-rival">
              <div className="mst-rival__txt">
                <span className="mst-rival__lbl">Próximo partido</span>
                <span className="mst-rival__name">{rival ? teamName(season, rival.id) : 'Por definir'}</span>
                <span className="mst-rival__sub">
                  {over ? (
                    'Temporada terminada'
                  ) : (
                    <>
                      Liga · J{playedMatchday} · <em>{rival ? (rival.home ? 'Casa' : 'Fuera') : '—'}</em>
                    </>
                  )}
                </span>
              </div>
              {rival ? (
                <Crest teamId={rival.id} size={58} />
              ) : (
                <span className="mst-rival__ph" aria-hidden="true">?</span>
              )}
            </div>
          </header>

          <div className="mst-body">
            {/* Torre izquierda: equipo + competición */}
            <nav className="mst-tower" aria-label="Equipo y competición">
              <div className="mst-grp">
                <p className="mst-grp__h">Terreno de juego</p>
                {sec('squad', 'alineacion', 'Alineación', squad ? { hint: <><em>{squad}</em> jugadores</> } : undefined)}
                {sec('tactics', 'tactica', 'Táctica')}
                {sec('training', 'entrenamiento', 'Entrenamiento')}
                {sec('youth', 'cantera', 'Cantera')}
                {sec('prospects', 'cantera', 'Promesas')}
              </div>
              <div className="mst-grp">
                <p className="mst-grp__h">Competición</p>
                {sec('standings', 'clasificacion', 'Clasificación', { hint: <><em>{pos}.º</em> · {pts} pts</> })}
                {sec('copa', 'leyendas', 'Copa')}
                {sec('europa', 'leyendas', 'Europa', { disabled: !hasEuropa })}
                {sec('standings', 'calendario', 'Calendario')}
              </div>
            </nav>

            {/* Centro: jugar la jornada, sobre el césped */}
            <div className="mst-center">
              {over ? (
                <button type="button" className="mst-play" onClick={() => goTo('seasonEnd')}>
                  <span className="mst-play__big">Fin de temporada</span>
                  <span className="mst-play__sub">Revisa el balance del año</span>
                </button>
              ) : (
                <>
                  <button type="button" className="mst-play" onClick={() => goTo('prematch')}>
                    <span className="mst-play__big">Jugar jornada {playedMatchday}</span>
                    <span className="mst-play__sub">Salta al terreno de juego</span>
                  </button>
                  <button type="button" className="mst-sim" onClick={playNextMatchday}>
                    Simular jornada
                  </button>
                </>
              )}

              <div className="mst-notices">
                {winterOpen ? (
                  <p className="mst-notice">
                    ❄️ Mercado de invierno abierto.
                    <button type="button" onClick={openWinterMarket}>
                      Ir →
                    </button>
                  </p>
                ) : null}
                {pressPending ? (
                  <p className="mst-notice">
                    🎙️ La prensa espera tus declaraciones.
                    <button type="button" onClick={() => goTo('press')}>
                      Comparecer →
                    </button>
                  </p>
                ) : null}
                {lastCallUp && lastCallUp.players.length > 0 ? (
                  <p className="mst-notice">
                    ✈️ {lastCallUp.players.length}{' '}
                    {lastCallUp.players.length === 1 ? 'jugador vuelve' : 'jugadores vuelven'} del parón con
                    fatiga extra.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Torre derecha: club + medios */}
            <nav className="mst-tower" aria-label="Club y medios">
              <div className="mst-grp">
                <p className="mst-grp__h">Club</p>
                {sec('market', 'fichajes', 'Fichajes', winterOpen ? { pip: 'alert', pipLabel: 'Mercado de invierno abierto' } : undefined)}
                {sec('directiva', 'directiva', 'Directiva')}
                {sec('sponsors', 'finanzas', 'Finanzas', { hint: <em>{formatEuros(budget)}</em> })}
                {sec('stadium', 'resultados', 'Estadio')}
                {sec('ojeo', 'moral', 'Ojeador')}
              </div>
              <div className="mst-grp">
                <p className="mst-grp__h">Medios</p>
                {sec('press', 'prensa', 'Prensa', pressPending ? { pip: 'alert', pipLabel: 'La prensa te espera' } : undefined)}
                {sec('stats', 'clasificacion', 'Estadísticas')}
                {sec('palmares', 'leyendas', 'Palmarés')}
                {sec('hemeroteca', 'prensa', 'Hemeroteca')}
              </div>
            </nav>
          </div>

          {/* Secciones menos frecuentes */}
          <div className="mst-more">
            <button type="button" onClick={() => goTo('comparativa')}>Comparar</button>
            <button type="button" onClick={() => goTo('staff')}>Personal</button>
            <button type="button" onClick={() => goTo('slots')}>Guardar</button>
            <button type="button" onClick={() => goTo('title')}>Menú</button>
          </div>
        </div>
      </div>
    </main>
  );
}
