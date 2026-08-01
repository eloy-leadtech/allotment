import { currentStandings, isSeasonOver, teamName, latestHeadlines } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { StandingsTable } from '@ui/components/StandingsTable';
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

  return (
    <main className="screen">
      <header className="season-head">
        <h1>
          {division === 'segunda' ? 'Segunda' : 'Primera'} {season.temporada}
        </h1>
        <span className="matchday">
          {over ? 'Temporada terminada' : `Jornada ${season.currentMatchday} / ${season.totalMatchdays}`}
        </span>
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

      <nav className="despacho-nav" aria-label="Secciones">
        <button type="button" className="despacho-tile despacho-tile--pitch" onClick={() => goTo('squad')}>
          <span className="despacho-tile__icon" aria-hidden="true">👥</span>
          <span className="despacho-tile__label">Plantilla</span>
        </button>
        <button type="button" className="despacho-tile despacho-tile--pitch" onClick={() => goTo('youth')}>
          <span className="despacho-tile__icon" aria-hidden="true">🌱</span>
          <span className="despacho-tile__label">Cantera</span>
        </button>
        <button type="button" className="despacho-tile despacho-tile--pitch" onClick={() => goTo('tactics')}>
          <span className="despacho-tile__icon" aria-hidden="true">📋</span>
          <span className="despacho-tile__label">Táctica</span>
        </button>
        <button type="button" className="despacho-tile despacho-tile--pitch" onClick={() => goTo('training')}>
          <span className="despacho-tile__icon" aria-hidden="true">🏃</span>
          <span className="despacho-tile__label">Entrenamiento</span>
        </button>
        <button type="button" className="despacho-tile despacho-tile--pitch" onClick={() => goTo('stadium')}>
          <span className="despacho-tile__icon" aria-hidden="true">🏟️</span>
          <span className="despacho-tile__label">Estadio</span>
        </button>
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
        <button type="button" className="despacho-tile" onClick={() => goTo('slots')}>
          <span className="despacho-tile__icon" aria-hidden="true">💾</span>
          <span className="despacho-tile__label">Guardar</span>
        </button>
        <button type="button" className="despacho-tile" onClick={() => goTo('title')}>
          <span className="despacho-tile__icon" aria-hidden="true">🏠</span>
          <span className="despacho-tile__label">Menú</span>
        </button>
      </nav>
    </main>
  );
}
