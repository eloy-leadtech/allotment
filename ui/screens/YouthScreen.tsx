import { playerAge, seasonStartYear, prospectScoutRange } from '@game';
import type { Position } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { GestHeader } from '@ui/components/GestHeader';
import { PotentialRange } from '@ui/components/PotentialRange';

const POSITION_ORDER: Record<Position, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

export function YouthScreen() {
  const career = useGameStore((s) => s.career);
  const promoteYouth = useGameStore((s) => s.promoteYouth);
  const discardYouth = useGameStore((s) => s.discardYouth);
  const goTo = useGameStore((s) => s.goTo);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const team = career.teams.find((t) => t.id === career.humanTeamId);
  const startYear = seasonStartYear(career.temporada);
  const prospects = [...career.youthProspects].sort((a, b) => {
    const line = POSITION_ORDER[a.player.posicion] - POSITION_ORDER[b.player.posicion];
    return line !== 0 ? line : b.player.media - a.player.media;
  });

  return (
    <main className="screen">
      <GestHeader
        icon="🌱"
        title="Cantera"
        subtitle={`${team?.nombre ?? career.humanTeamId} · ${career.temporada}`}
        chips={[{ label: 'Juveniles', value: `${prospects.length}` }]}
      />

      <RetroPanel title="Juveniles">
        {prospects.length === 0 ? (
          <p className="hint">No hay juveniles en la cantera. La próxima pretemporada llegará una nueva hornada.</p>
        ) : (
          <div className="squad-scroll">
            <table className="squad-table table-steel">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Jugador</th>
                  <th>Edad</th>
                  <th>Media</th>
                  <th>Potencial ojeado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((prospect) => {
                  const p = prospect.player;
                  const age = playerAge(p, startYear);
                  const range = prospectScoutRange(prospect, career.seed, career.seasonNumber);
                  return (
                    <tr key={p.id}>
                      <td><span className={`pos-badge pos-badge--${p.posicion}`}>{p.posicion}</span></td>
                      <td className="squad-name">{p.nombre}</td>
                      <td>{age ?? '—'}</td>
                      <td className="squad-media">{p.media}</td>
                      <td>
                        <PotentialRange low={range.low} high={range.high} />
                      </td>
                      <td>
                        <div className="season-actions">
                          <RetroButton variant="primary" onClick={() => promoteYouth(p.id)}>
                            Promover
                          </RetroButton>
                          <RetroButton onClick={() => discardYouth(p.id)}>Descartar</RetroButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="hint">
          Promover pasa al juvenil al primer equipo, donde evolucionará con la edad hacia su techo. El ojeo es
          falible: el rango puede no contener el potencial real. Los juveniles que no promociones acaban dejando el
          club.
        </p>
      </RetroPanel>

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}
