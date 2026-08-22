import { useState } from 'react';
import {
  synthesizePotential,
  scoutEstimate,
  playerAge,
  seasonStartYear,
  availabilityStatus,
  squadWageBill,
  formatEuros,
  deriveHumanDesires,
  desireInfo,
  type AvailabilityStatus,
  type DesireKind,
} from '@game';
import { scoreTier, squadMorale, fatigueTier, NEUTRAL_FORM, NEUTRAL_MORALE, FRESH_FATIGUE } from '@engine';
import type { Player, Position } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Crest } from '@ui/components/Crest';
import { Stadium } from '@ui/components/Stadium';
import { PotentialRange } from '@ui/components/PotentialRange';
import { Pcf7Console } from '@ui/components/Pcf7Frame';
import { useFichaPhoto } from '@ui/hooks/useFichaPhoto';

/** Players at or under this age get a (fallible) scouted potential range. */
const YOUTH_MAX_AGE = 23;

const POSITION_ORDER: Record<Position, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

/** Retro teletipo-style label for a player's availability. */
function statusLabel({ status, matchesOut }: AvailabilityStatus): { text: string; className: string } | null {
  if (status === 'injured') {
    return { text: `Lesionado (${matchesOut})`, className: 'squad-status squad-status--injured' };
  }
  if (status === 'suspended') {
    return { text: `Sancionado (${matchesOut})`, className: 'squad-status squad-status--suspended' };
  }
  return null;
}

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

/** Arrow glyph for a -3..+3 streak tier. */
function arrowFor(tier: number): string {
  if (tier === 0) return '▬';
  const glyph = tier > 0 ? '▲' : '▼';
  return glyph.repeat(Math.abs(tier));
}

/** CSS modifier for a tier: positive = good, negative = bad, 0 = neutral. */
function tierClass(tier: number): string {
  if (tier > 0) return 'streak--up';
  if (tier < 0) return 'streak--down';
  return 'streak--flat';
}

/** Form as a coloured arrow reflecting the streak. */
function FormArrow({ form }: { form: number }) {
  const tier = scoreTier(form);
  return (
    <span className={`form-arrow ${tierClass(tier)}`} title={`Forma ${form}/100`}>
      {arrowFor(tier)}
    </span>
  );
}

/** Morale as a compact coloured bar. */
function MoraleBar({ morale }: { morale: number }) {
  const tier = scoreTier(morale);
  return (
    <span className={`morale-bar ${tierClass(tier)}`} title={`Moral ${morale}/100`}>
      <span className="morale-bar__fill" style={{ width: `${morale}%` }} />
    </span>
  );
}

/** A player's individual wish (deseo) as a small retro badge with a tooltip. */
function DesireBadge({ kind }: { kind: DesireKind }) {
  const info = desireInfo(kind);
  return (
    <span className={`desire-badge desire-badge--${info.tone}`} title={info.label}>
      <span className="desire-badge__icon" aria-hidden="true">{info.icon}</span>
      {info.label}
    </span>
  );
}

/** Spanish label for a 0..3 physical-condition tier. */
const FATIGUE_LABEL = ['Fresco', 'Algo cansado', 'Cansado', 'Reventado'] as const;

/**
 * Physical condition (fatiga) as a bar that fills and warms as a player tires:
 * fresh = green, spent = red. The fill grows with fatigue so a full red bar reads
 * as "needs a rest" at a glance.
 */
function FatigueBar({ fatigue }: { fatigue: number }) {
  const tier = fatigueTier(fatigue);
  return (
    <span className={`fatigue-bar fatigue--${tier}`} title={`Estado físico: ${FATIGUE_LABEL[tier]} (fatiga ${fatigue}/100)`}>
      <span className="fatigue-bar__fill" style={{ width: `${fatigue}%` }} />
    </span>
  );
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
  const openPlayer = useGameStore((s) => s.openPlayer);
  const renewPlayer = useGameStore((s) => s.renewPlayer);
  const marketMessage = useGameStore((s) => s.marketMessage);
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
  const masaSalarial = team ? squadWageBill(team, career.contracts) : 0;
  const observedSeasons = career.seasonNumber - 1;
  const availability = career.season.availability;
  const matchday = career.season.currentMatchday;

  // Form/morale live on the in-progress season's players (they reset neutral each
  // season and evolve matchday to matchday). Index them by player id for lookup.
  const seasonPlayers = career.season.teams.find((t) => t.id === career.humanTeamId)?.players ?? [];
  const streakById = new Map(seasonPlayers.map((p) => [p.id, p]));
  const vestuario = squadMorale(seasonPlayers);
  const vestuarioTier = scoreTier(vestuario);

  const teamLabel = team?.nombre ?? career.humanTeamId;
  const selected = players.find((p) => p.id === selectedId) ?? null;

  const footer = (
    <>
      <button type="button" className="pcf7flatbtn pcf7flatbtn--primary" onClick={() => goTo('comparativa')}>
        Comparar jugadores
      </button>
      <button type="button" className="pcf7flatbtn" onClick={() => goTo('season')}>
        Volver al despacho
      </button>
    </>
  );

  // Each key player's wish (deseo): derived from his situation (contrato/minutos/
  // edad/ambición). The live season carries the same map; fall back to deriving it.
  const desires = career.season.humanDesires ?? deriveHumanDesires(career);

  return (
    <Pcf7Console title={teamLabel} status={`Plantilla · ${career.temporada}`} footer={footer}>
      <div className="pcf7chiprow">
        <span className={`pcf7chip${vestuarioTier > 0 ? ' pcf7chip--good' : vestuarioTier < 0 ? ' pcf7chip--bad' : ''}`}>
          <span className="pcf7chip__label">Moral vestuario</span>
          <span className="pcf7chip__value">{vestuario}</span>
        </span>
        <span className="pcf7chip pcf7chip--bad">
          <span className="pcf7chip__label">Masa salarial</span>
          <span className="pcf7chip__value">{formatEuros(masaSalarial)}/año</span>
        </span>
        <span className="pcf7chip">
          <span className="pcf7chip__label">Presupuesto</span>
          <span className="pcf7chip__value">{formatEuros(career.budget)}</span>
        </span>
      </div>

      {marketMessage ? <p className="market-msg">{marketMessage}</p> : null}

      <Stadium teamId={career.humanTeamId} />

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
          <table className="pcf7tbl squad-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jugador</th>
                <th>Edad</th>
                <th>Media</th>
                <th>Estado</th>
                <th>Físico</th>
                <th>Forma</th>
                <th>Moral</th>
                <th>Deseo</th>
                <th>Sueldo</th>
                <th>Contrato</th>
                <th>Potencial ojeado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const age = playerAge(p, startYear);
                const isYouth = age !== null && age <= YOUTH_MAX_AGE;
                const range = isYouth
                  ? scoutEstimate(p, synthesizePotential(p, career.seed), observedSeasons, career.seed)
                  : null;
                const status = statusLabel(availabilityStatus(availability[p.id], matchday));
                const streak = streakById.get(p.id);
                const form = streak?.form ?? NEUTRAL_FORM;
                const morale = streak?.morale ?? NEUTRAL_MORALE;
                const fatigue = streak?.fatigue ?? FRESH_FATIGUE;
                const contract = career.contracts[p.id];
                const lastYear = contract?.yearsLeft === 1;
                const rowClass = [status ? 'squad-row--out' : '', p.id === selectedId ? 'pcf7tbl__me' : '']
                  .filter(Boolean)
                  .join(' ');
                return (
                  <tr
                    key={p.id}
                    className={rowClass || undefined}
                    onClick={() => setSelectedId(p.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><span className={`pos-badge pos-badge--${p.posicion}`}>{p.posicion}</span></td>
                    <td className="squad-name">
                      <button
                        type="button"
                        className="player-link"
                        onClick={(e) => {
                          // The row click opens the inline ficha; the name opens the full card.
                          e.stopPropagation();
                          openPlayer(p.id);
                        }}
                      >
                        {p.nombre}
                      </button>
                    </td>
                    <td className="pcf7tbl__num">{age ?? '—'}</td>
                    <td className="pcf7tbl__num squad-media">{p.media}</td>
                    <td>
                      {status ? (
                        <span className={status.className}>{status.text}</span>
                      ) : (
                        <span className="hint">Disponible</span>
                      )}
                    </td>
                    <td><FatigueBar fatigue={fatigue} /></td>
                    <td><FormArrow form={form} /></td>
                    <td><MoraleBar morale={morale} /></td>
                    <td><DesireBadge kind={desires[p.id] ?? 'contento'} /></td>
                    <td className="pcf7tbl__num squad-media">{contract ? formatEuros(contract.salary) : '—'}</td>
                    <td>
                      {contract ? (
                        <span className={lastYear ? 'squad-status squad-status--suspended' : undefined}>
                          {contract.yearsLeft} {contract.yearsLeft === 1 ? 'año' : 'años'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{range ? <PotentialRange low={range.low} high={range.high} /> : <span className="pcf7list__dim">—</span>}</td>
                    <td>
                      {contract ? (
                        <button
                          type="button"
                          className="pcf7flatbtn"
                          onClick={(e) => {
                            e.stopPropagation();
                            renewPlayer(p.id);
                          }}
                        >
                          Renovar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)', margin: 0 }}>
        Toca un jugador para ver su ficha aquí mismo, o pulsa su nombre para la ficha completa. El ojeo es
        falible: el rango puede no contener el valor real y se estrecha (que no acierta más) con el tiempo.
      </p>
    </Pcf7Console>
  );
}
