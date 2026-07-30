import { currentStandings, isSeasonOver, teamName } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { StandingsTable } from '@ui/components/StandingsTable';

export function SeasonScreen() {
  const season = useGameStore((s) => s.season);
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

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Liga {season.temporada}</h1>
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
        <RetroButton variant="primary" onClick={playNextMatchday}>
          Avanzar jornada
        </RetroButton>
      )}

      <StandingsTable rows={table} teamName={name} highlightTeamId={season.humanTeamId} />

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

      <div className="season-actions">
        <RetroButton onClick={() => goTo('slots')}>Guardar / Cargar</RetroButton>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </div>
    </main>
  );
}
