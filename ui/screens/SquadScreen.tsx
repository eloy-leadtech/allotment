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
import { useFichaPhoto } from '@ui/hooks/useFichaPhoto';

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

/**
 * The player's real BDFutbol portrait when we have a high-confidence match for
 * this season, otherwise the club crest (the existing silhouette fallback). The
 * `<img>` is a fixed 2/3-vertical `object-fit: cover` fill of the ficha frame.
 */
function PlayerPhoto({
  temporada,
  player,
  teamId,
}: {
  temporada: string;
  player: Player;
  teamId: string;
}) {
  const photo = useFichaPhoto(temporada, player.id);
  const [failed, setFailed] = useState(false);
  // Catalogue players carry their BDFutbol id, so the portrait resolves directly;
  // classic Spanish seasons fall back to the temporada→id photo map.
  const base =
    (import.meta as { env?: Record<string, string> }).env?.VITE_PHOTO_BASE ?? '/fotos-bdf/';
  const src = player.bdfId ? `${base}${player.bdfId}/${player.bdfId}.jpg` : photo?.src;
  if (!src || failed) {
    return <Crest teamId={teamId} size={64} />;
  }
  return (
    <img
      src={src}
      alt={player.nombre}
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
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
              <PlayerPhoto temporada={career.temporada} player={selected} teamId={career.humanTeamId} />
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
