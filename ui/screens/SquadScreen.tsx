import { useState } from 'react';
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
import { PotentialRange } from '@ui/components/PotentialRange';
import { Pcf7Console } from '@ui/components/Pcf7Frame';

/** Players at or under this age get a (fallible) scouted potential range. */
const YOUTH_MAX_AGE = 23;

const POSITION_ORDER: Record<Position, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

function byLineThenMedia(a: Player, b: Player): number {
  const line = POSITION_ORDER[a.posicion] - POSITION_ORDER[b.posicion];
  return line !== 0 ? line : b.media - a.media;
}

/** The player's attributes as label/value pairs (skips the nullable calidad). */
function attrRows(p: Player): Array<[string, number]> {
  const a = p.atributos;
  const pairs: Array<[string, number]> = [
    ['Velocidad', a.velocidad],
    ['Físico', a.fisico],
    ['Resistencia', a.resistencia],
    ['Remate', a.remate],
    ['Ofensivo', a.ofensivo],
    ['Pase', a.pase],
    ['Entrada', a.entrada],
    ['Agresividad', a.agresividad],
    ['Portería', a.porteria],
  ];
  if (a.calidad != null) pairs.unshift(['Calidad', a.calidad]);
  return pairs;
}

export function SquadScreen() {
  const career = useGameStore((s) => s.career);
  const goTo = useGameStore((s) => s.goTo);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const teamLabel = team?.nombre ?? career.humanTeamId;
  const selected = players.find((p) => p.id === selectedId) ?? null;

  return (
    <Pcf7Console
      title={teamLabel}
      status={`Plantilla · ${career.temporada}`}
      footer={<button type="button" className="pcf7flatbtn" onClick={() => goTo('season')}>Volver al despacho</button>}
    >
      {selected ? (
        <section className="pcf7card">
          <div className="pcf7card__head">
            Ficha · {selected.nombre} · dorsal {selected.dorsal ?? '—'}
          </div>
          <div className="pcf7ficha" style={{ padding: '0.7em' }}>
            <div className="pcf7ficha__photo">
              <Crest teamId={career.humanTeamId} size={64} />
            </div>
            <table className="pcf7tbl">
              <tbody>
                <tr><td>Posición</td><td className="pcf7tbl__num">{selected.posicion}</td></tr>
                <tr><td>Media</td><td className="pcf7tbl__num">{selected.media}</td></tr>
                <tr><td>Edad</td><td className="pcf7tbl__num">{playerAge(selected, startYear) ?? '—'}</td></tr>
                {attrRows(selected).map(([label, value]) => (
                  <tr key={label}><td>{label}</td><td className="pcf7tbl__num">{value}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="pcf7card" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
        <div className="pcf7card__head">Plantilla</div>
        <div className="pcf7steel__scroll">
          <table className="pcf7tbl">
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
                  <tr
                    key={p.id}
                    className={p.id === selectedId ? 'pcf7tbl__me' : ''}
                    onClick={() => setSelectedId(p.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{p.posicion}</td>
                    <td>{p.nombre}</td>
                    <td className="pcf7tbl__num">{age ?? '—'}</td>
                    <td className="pcf7tbl__num">{p.media}</td>
                    <td>{range ? <PotentialRange low={range.low} high={range.high} /> : <span className="pcf7list__dim">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)', margin: 0 }}>
        Toca un jugador para ver su ficha. El ojeo es falible: el rango puede no contener el valor real y se
        estrecha (que no acierta más) con el tiempo.
      </p>
    </Pcf7Console>
  );
}
