import { useMemo, useState } from 'react';
import {
  leagueProspects,
  careerTeamName,
  askingPrice,
  formatEuros,
  seasonStartYear,
  playerAge,
  PROSPECT_MAX_AGE,
  type ProspectReport,
} from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';
import { GestHeader } from '@ui/components/GestHeader';
import { PotentialRange } from '@ui/components/PotentialRange';

/** How many promesas to show at once (the pool is every young rival talent). */
const MAX_ROWS = 40;

export function ScoutingProspectsScreen() {
  const career = useGameStore((s) => s.career);
  const followProspect = useGameStore((s) => s.followProspect);
  const unfollowProspect = useGameStore((s) => s.unfollowProspect);
  const signProspect = useGameStore((s) => s.signProspect);
  const marketMessage = useGameStore((s) => s.marketMessage);
  const goTo = useGameStore((s) => s.goTo);
  const [query, setQuery] = useState('');

  const prospects = useMemo<ProspectReport[]>(() => (career ? leagueProspects(career) : []), [career]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? prospects.filter((p) => p.player.nombre.toLowerCase().includes(q)) : prospects;
    return pool.slice(0, MAX_ROWS);
  }, [prospects, query]);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const name = (id: string): string => careerTeamName(career, id);
  const startYear = seasonStartYear(career.temporada);
  // The transfer window is only open in the pre-season (no matchday played yet).
  const marketOpen = career.season.results.length === 0;
  const followedCount = Object.keys(career.prospectTracking).length;

  return (
    <main className="screen">
      <GestHeader
        icon="⭐"
        title="Promesas de rivales"
        subtitle="Ojea y sigue a los jóvenes talentos de otros clubes"
        chips={[
          { label: 'Temporada', value: career.temporada },
          { label: 'Presupuesto', value: formatEuros(career.budget) },
          { label: 'Siguiendo', value: String(followedCount) },
        ]}
      />

      {marketMessage ? <p className="market-msg">{marketMessage}</p> : null}

      <RetroPanel title="Cantera de la liga">
        <input
          className="market-search"
          type="search"
          placeholder="Buscar promesa…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="squad-scroll">
          <table className="squad-table table-steel">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th>Club</th>
                <th>Edad</th>
                <th>Potencial ojeado</th>
                <th>Temp.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ player, clubId, age, following, seasonsObserved, potential }) => {
                const price = askingPrice(player, playerAge(player, startYear));
                return (
                  <tr key={player.id}>
                    <td><span className={`pos-badge pos-badge--${player.posicion}`}>{player.posicion}</span></td>
                    <td className="squad-name">{player.nombre}</td>
                    <td className="team-cell">
                      <Crest teamId={clubId} size={18} />
                      {name(clubId)}
                    </td>
                    <td className="squad-media">{age}</td>
                    <td>
                      <PotentialRange low={potential.low} high={potential.high} />
                    </td>
                    <td className="squad-media">{following ? seasonsObserved : '—'}</td>
                    <td className="mkt-signing__actions">
                      <RetroButton
                        onClick={() => (following ? unfollowProspect(player.id) : followProspect(player.id))}
                      >
                        {following ? 'Dejar de seguir' : 'Seguir'}
                      </RetroButton>
                      <RetroButton
                        variant="primary"
                        disabled={!marketOpen}
                        onClick={() => signProspect(player.id)}
                      >
                        Fichar ({formatEuros(price)})
                      </RetroButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {prospects.length > filtered.length ? (
          <p className="hint">
            Mostrando {filtered.length} de {prospects.length}. Busca por nombre para afinar.
          </p>
        ) : null}

        <p className="hint">
          Las promesas son jóvenes (≤{PROSPECT_MAX_AGE} años) con potencial oculto. El rango es falible: puede no
          contener el valor real y se estrecha (que no acierta más) cuantas más temporadas SIGUES al
          jugador. Sigue a tus favoritos varias temporadas para afinar la estimación y fíchalos en el
          mercado (antes de empezar la temporada).
        </p>
      </RetroPanel>

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}
