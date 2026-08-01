import {
  currentStandings,
  isSeasonOver,
  teamName,
  latestHeadlines,
  selectPressQuestion,
  formatEuros,
} from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { StandingsTable } from '@ui/components/StandingsTable';
import { Crest } from '@ui/components/Crest';
import { ConfianzaMeters } from '@ui/components/ConfianzaMeters';
import { DEFAULT_CONFIANZA } from '@game';
import { objectiveLabel, satisfactionLabel, satisfactionIcon } from './objectiveText';

export function SeasonScreen() {
  const season = useGameStore((s) => s.season);
  const career = useGameStore((s) => s.career);
  const division = useGameStore((s) => s.career?.division ?? 'primera');
  const hasEuropa = useGameStore((s) => s.career?.europa != null);
  const lastResults = useGameStore((s) => s.lastResults);
  const playNextMatchday = useGameStore((s) => s.playNextMatchday);
  const openMatch = useGameStore((s) => s.openMatch);
  const goTo = useGameStore((s) => s.goTo);

  if (!season) {
    return (
      <main className="screen">
        <p>No hay temporada en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const name = (id: string): string => teamName(season, id);
  const table = currentStandings(season);
  const over = isSeasonOver(season);
  const champion = over ? table[0] : undefined;
  const board = career?.board;
  const headlines = career ? latestHeadlines(career, 6) : [];
  const pressPending = career ? selectPressQuestion(career) : null;

  return (
    <main className="screen">
      <header className="despacho-head">
        <div className="despacho-head__crest crest-frame">
          <Crest teamId={season.humanTeamId} size={56} />
        </div>
        <div className="despacho-head__identity">
          <h1>{name(season.humanTeamId)}</h1>
          <span className="matchday">
            {division === 'segunda' ? 'Segunda División' : 'Primera División'} · {season.temporada}
          </span>
        </div>
        <div className="despacho-head__stats">
          <div className="head-chip">
            <span className="head-chip__label">Jornada</span>
            <span className="head-chip__value">
              {over ? 'Fin' : `${season.currentMatchday}/${season.totalMatchdays}`}
            </span>
          </div>
          <div className="head-chip">
            <span className="head-chip__label">Presupuesto</span>
            <span className="head-chip__value">{formatEuros(career?.budget ?? 0)}</span>
          </div>
        </div>
      </header>

      {champion ? <p className="champion">🏆 Campeón: {name(champion.teamId)}</p> : null}
      {over ? (
        <RetroButton variant="primary" onClick={() => goTo('seasonEnd')}>
          Fin de temporada →
        </RetroButton>
      ) : (
        <div className="season-actions">
          <RetroButton variant="primary" onClick={() => goTo('prematch')}>
            Jugar jornada
          </RetroButton>
          <RetroButton onClick={playNextMatchday}>Simular jornada</RetroButton>
        </div>
      )}

      {pressPending ? (
        <RetroPanel title="Rueda de prensa">
          <p className="press-notice">🎙️ La prensa espera tus declaraciones.</p>
          <RetroButton variant="primary" onClick={() => goTo('press')}>
            Comparecer →
          </RetroButton>
        </RetroPanel>
      ) : null}

      {board ? (
        <RetroPanel title="Objetivo de la directiva">
          <p className="board-objective">
            🎯 {objectiveLabel(board.objective.type)}{' '}
            <span className="hint">(no peor que el puesto {board.objective.targetPosition})</span>
          </p>
          {board.lastEvaluation ? (
            <p className={`board-mood board-mood--${board.lastEvaluation.satisfaction}`}>
              {satisfactionIcon(board.lastEvaluation.satisfaction)}{' '}
              {satisfactionLabel(board.lastEvaluation.satisfaction)}{' '}
              <span className="hint">(temporada anterior)</span>
            </p>
          ) : null}
        </RetroPanel>
      ) : null}

      {career ? (
        <RetroPanel title="Junta directiva">
          <ConfianzaMeters confianza={career.confianza ?? DEFAULT_CONFIANZA} />
        </RetroPanel>
      ) : null}

      <StandingsTable rows={table} teamName={name} highlightTeamId={season.humanTeamId} />

      {headlines.length > 0 ? (
        <RetroPanel title="Prensa">
          <ul className="press-feed">
            {headlines.map((h, i) => (
              <li key={`${h.matchday}-${i}`} className="press-line">
                <span className="press-matchday">J{h.matchday}</span> {h.text}
              </li>
            ))}
          </ul>
        </RetroPanel>
      ) : null}

      {lastResults.length > 0 ? (
        <RetroPanel title="Resultados de la última jornada">
          <ul className="results">
            {lastResults.map((r, i) => (
              <li key={i}>
                <button type="button" className="result-link" onClick={() => openMatch(r)}>
                  {name(r.homeId)} {r.homeGoals}-{r.awayGoals} {name(r.awayId)}
                </button>
              </li>
            ))}
          </ul>
        </RetroPanel>
      ) : null}

      <div className="despacho-groups">
        <section className="despacho-group">
          <h2 className="despacho-group__label">Equipo</h2>
          <nav className="despacho-nav" aria-label="Equipo">
            <button type="button" className="despacho-tile despacho-tile--pitch" onClick={() => goTo('squad')}>
              <span className="despacho-tile__icon" aria-hidden="true">👥</span>
              <span className="despacho-tile__label">Plantilla</span>
            </button>
            <button type="button" className="despacho-tile despacho-tile--pitch" onClick={() => goTo('tactics')}>
              <span className="despacho-tile__icon" aria-hidden="true">📋</span>
              <span className="despacho-tile__label">Táctica</span>
            </button>
            <button type="button" className="despacho-tile despacho-tile--pitch" onClick={() => goTo('training')}>
              <span className="despacho-tile__icon" aria-hidden="true">🏃</span>
              <span className="despacho-tile__label">Entrenamiento</span>
            </button>
            <button type="button" className="despacho-tile despacho-tile--pitch" onClick={() => goTo('youth')}>
              <span className="despacho-tile__icon" aria-hidden="true">🌱</span>
              <span className="despacho-tile__label">Cantera</span>
            </button>
            <button type="button" className="despacho-tile despacho-tile--pitch" onClick={() => goTo('ojeo')}>
              <span className="despacho-tile__icon" aria-hidden="true">🔍</span>
              <span className="despacho-tile__label">Ojeo</span>
            </button>
          </nav>
        </section>

        <section className="despacho-group">
          <h2 className="despacho-group__label">Competición</h2>
          <nav className="despacho-nav" aria-label="Competición">
            <button type="button" className="despacho-tile" onClick={() => goTo('copa')}>
              <span className="despacho-tile__icon" aria-hidden="true">🏆</span>
              <span className="despacho-tile__label">Copa</span>
            </button>
            {hasEuropa ? (
              <button type="button" className="despacho-tile" onClick={() => goTo('europa')}>
                <span className="despacho-tile__icon" aria-hidden="true">🌍</span>
                <span className="despacho-tile__label">Europa</span>
              </button>
            ) : null}
            <button type="button" className="despacho-tile" onClick={() => goTo('stats')}>
              <span className="despacho-tile__icon" aria-hidden="true">📊</span>
              <span className="despacho-tile__label">Estadísticas</span>
            </button>
            <button type="button" className="despacho-tile" onClick={() => goTo('palmares')}>
              <span className="despacho-tile__icon" aria-hidden="true">🏅</span>
              <span className="despacho-tile__label">Palmarés</span>
            </button>
          </nav>
        </section>

        <section className="despacho-group">
          <h2 className="despacho-group__label">Club y economía</h2>
          <nav className="despacho-nav" aria-label="Club y economía">
            <button type="button" className="despacho-tile despacho-tile--pitch" onClick={() => goTo('stadium')}>
              <span className="despacho-tile__icon" aria-hidden="true">🏟️</span>
              <span className="despacho-tile__label">Estadio</span>
            </button>
            <button type="button" className="despacho-tile" onClick={() => goTo('sponsors')}>
              <span className="despacho-tile__icon" aria-hidden="true">🤝</span>
              <span className="despacho-tile__label">Patrocinio</span>
            </button>
            <button type="button" className="despacho-tile" onClick={() => goTo('press')}>
              <span className="despacho-tile__icon" aria-hidden="true">🎙️</span>
              <span className="despacho-tile__label">Prensa</span>
            </button>
          </nav>
        </section>

        <section className="despacho-group">
          <h2 className="despacho-group__label">Partida</h2>
          <nav className="despacho-nav" aria-label="Partida">
            <button type="button" className="despacho-tile" onClick={() => goTo('slots')}>
              <span className="despacho-tile__icon" aria-hidden="true">💾</span>
              <span className="despacho-tile__label">Guardar</span>
            </button>
            <button type="button" className="despacho-tile" onClick={() => goTo('title')}>
              <span className="despacho-tile__icon" aria-hidden="true">🏠</span>
              <span className="despacho-tile__label">Menú</span>
            </button>
          </nav>
        </section>
      </div>
    </main>
  );
}
