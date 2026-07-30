import {
  synthesizePotential,
  scoutEstimate,
  playerAge,
  seasonStartYear,
} from '@game';
import type { Player, Position } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Crest } from '@ui/components/Crest';
import { Stadium } from '@ui/components/Stadium';
import { PotentialRange } from '@ui/components/PotentialRange';

/** Players at or under this age get a (fallible) scouted potential range. */
const YOUTH_MAX_AGE = 23;

const POSITION_ORDER: Record<Position, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

function byLineThenMedia(a: Player, b: Player): number {
  const line = POSITION_ORDER[a.posicion] - POSITION_ORDER[b.posicion];
  return line !== 0 ? line : b.media - a.media;
}

export function SquadScreen() {
  const career = useGameStore((s) => s.career);
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
  const players = [...(team?.players ?? [])].sort(byLineThenMedia);
  const startYear = seasonStartYear(career.temporada);
  const observedSeasons = career.seasonNumber - 1;

  return (
    <main className="screen">
      <header className="season-head">
        <h1>
          <span className="team-cell">
            <Crest teamId={career.humanTeamId} size={24} />
            {team?.nombre ?? career.humanTeamId}
          </span>
        </h1>
        <span className="matchday">Plantilla · {career.temporada}</span>
      </header>

      <Stadium teamId={career.humanTeamId} />


      <table className="squad-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Jugador</th>
            <th>Edad</th>
            <th>Media</th>
            <th>Potencial ojeado</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const age = playerAge(p, startYear);
            const isYouth = age !== null && age <= YOUTH_MAX_AGE;
            const range = isYouth
              ? scoutEstimate(p, synthesizePotential(p, career.seed), observedSeasons, career.seed)
              : null;
            return (
              <tr key={p.id}>
                <td>{p.posicion}</td>
                <td className="squad-name">{p.nombre}</td>
                <td>{age ?? '—'}</td>
                <td>{p.media}</td>
                <td>{range ? <PotentialRange low={range.low} high={range.high} /> : <span className="hint">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="hint">
        El ojeo es falible: el rango puede no contener el valor real y se estrecha (que no acierta más) con
        el tiempo.
      </p>

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}
