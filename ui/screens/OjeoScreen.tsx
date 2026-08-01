import { useMemo, useState } from 'react';
import { scoutTargets, careerTeamName, type ScoutTarget } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';
import { PotentialRange } from '@ui/components/PotentialRange';

/** How many scouting targets to show at once (the pool is every rival player). */
const MAX_ROWS = 40;

export function OjeoScreen() {
  const career = useGameStore((s) => s.career);
  const scoutPlayer = useGameStore((s) => s.scoutPlayer);
  const marketMessage = useGameStore((s) => s.marketMessage);
  const goTo = useGameStore((s) => s.goTo);
  const [query, setQuery] = useState('');

  const targets = useMemo<ScoutTarget[]>(() => (career ? scoutTargets(career) : []), [career]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? targets.filter((t) => t.player.nombre.toLowerCase().includes(q)) : targets;
    return pool.slice(0, MAX_ROWS);
  }, [targets, query]);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const name = (id: string): string => careerTeamName(career, id);

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Ojeo de rivales · {career.temporada}</h1>
        <span className="matchday">Envía ojeadores a jugadores de otros equipos</span>
      </header>

      {marketMessage ? <p className="market-msg">{marketMessage}</p> : null}

      <RetroPanel title="Informes de ojeador">
        <input
          className="market-search"
          type="search"
          placeholder="Buscar jugador…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="squad-scroll">
          <table className="squad-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th>Club</th>
                <th>Media ojeada</th>
                <th>Potencial ojeado</th>
                <th>Ojeos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ player, clubId, report }) => (
                <tr key={player.id}>
                  <td>{player.posicion}</td>
                  <td className="squad-name">{player.nombre}</td>
                  <td className="team-cell">
                    <Crest teamId={clubId} size={18} />
                    {name(clubId)}
                  </td>
                  <td className="squad-media">
                    {report.revealed ? (
                      <strong>{report.media}</strong>
                    ) : (
                      <span className="hint">
                        {report.ability.low}–{report.ability.high}
                      </span>
                    )}
                  </td>
                  <td>
                    <PotentialRange low={report.potential.low} high={report.potential.high} />
                  </td>
                  <td className="squad-media">{report.observations}</td>
                  <td>
                    <RetroButton
                      disabled={report.scoutedThisSeason}
                      onClick={() => scoutPlayer(player.id)}
                    >
                      {report.scoutedThisSeason ? 'Ojeado ✓' : 'Ojear'}
                    </RetroButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {targets.length > filtered.length ? (
          <p className="hint">
            Mostrando {filtered.length} de {targets.length}. Busca por nombre para afinar.
          </p>
        ) : null}

        <p className="hint">
          El ojeo es falible: los rangos pueden no contener el valor real y se estrechan (que no aciertan más)
          cuanto más observas al jugador. Cada temporada puedes enviar un ojeador a cada rival una vez; el informe
          se afina temporada tras temporada. Con suficientes ojeos se revela su media exacta.
        </p>
      </RetroPanel>

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}
