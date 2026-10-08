import { currentStandings, isSeasonOver, teamName } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { StandingsTable } from '@ui/components/StandingsTable';

/**
 * CLASIFICACIÓN — piel "Mister" (glass). Cabecera con división + temporada, la
 * tabla de liga en vivo con escudos (componente `StandingsTable`), la última
 * jornada como lista de resultados clicables, y las acciones (jugar / simular /
 * volver al despacho). Sustituye al calco sobre `scr_026` por el sistema de
 * paneles de acero semántico, igual que Europa/Mercado/etc.
 */
export function SeasonScreen() {
  const season = useGameStore((s) => s.season);
  const division = useGameStore((s) => s.career?.division ?? 'primera');
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
        <h1>{division === 'segunda' ? 'Segunda' : 'Primera'} · {season.temporada}</h1>
        <span className="matchday">
          {over ? 'Temporada terminada' : `Jornada ${season.currentMatchday} / ${season.totalMatchdays}`}
        </span>
      </header>

      {champion ? <p className="champion">🏆 Campeón: {name(champion.teamId)}</p> : null}

      <RetroPanel title="Clasificación">
        <StandingsTable rows={table} teamName={name} highlightTeamId={season.humanTeamId} />
      </RetroPanel>

      {lastResults.length > 0 ? (
        <RetroPanel title="Última jornada">
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
        {over ? (
          <RetroButton variant="primary" onClick={() => goTo('seasonEnd')}>
            Fin de temporada →
          </RetroButton>
        ) : (
          <>
            <RetroButton variant="primary" onClick={() => goTo('prematch')}>
              Jugar
            </RetroButton>
            <RetroButton onClick={playNextMatchday}>Simular</RetroButton>
          </>
        )}
        <RetroButton onClick={() => goTo('season')}>Despacho</RetroButton>
      </div>
    </main>
  );
}
