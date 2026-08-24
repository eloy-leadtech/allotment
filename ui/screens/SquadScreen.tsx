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
import { PotentialRange } from '@ui/components/PotentialRange';
import { MisterFrame } from '@ui/components/MisterFrame';
import { MisterHeader } from '@ui/components/MisterHeader';
import { PlayerTag } from '@ui/components/PlayerTag';
import { MediaPill, AttrValue, ratingTier } from '@ui/components/rating';
import { Flag } from '@ui/components/Flag';
import { useFichaPhoto } from '@ui/hooks/useFichaPhoto';

/** Players at or under this age get a (fallible) scouted potential range. */
const YOUTH_MAX_AGE = 23;

const POSITION_ORDER: Record<Position, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };
const LINE_LABEL: Record<Position, string> = {
  POR: 'Porteros',
  DEF: 'Defensas',
  MED: 'Centrocampistas',
  DEL: 'Delanteros',
};

/** Table column sets: management data, or the attribute sheet like the mockup. */
type Vista = 'gestion' | 'atributos';

/** The 9 attribute columns of the mockup's wide table (calidad may be null). */
const ATTR_COLS: Array<{ key: keyof Player['atributos']; label: string }> = [
  { key: 'calidad', label: 'Cal' },
  { key: 'velocidad', label: 'Vel' },
  { key: 'fisico', label: 'Fís' },
  { key: 'resistencia', label: 'Res' },
  { key: 'remate', label: 'Rem' },
  { key: 'pase', label: 'Pas' },
  { key: 'entrada', label: 'Ent' },
  { key: 'agresividad', label: 'Agr' },
  { key: 'ofensivo', label: 'Ofe' },
];

/** Attribute bars of the ficha; keepers use their reduced set (like the mockup). */
function fichaAttrs(p: Player): Array<[string, number]> {
  const a = p.atributos;
  if (p.esPortero) {
    const rows: Array<[string, number]> = [
      ['Portería', a.porteria],
      ['Velocidad', a.velocidad],
      ['Resistencia', a.resistencia],
      ['Agresividad', a.agresividad],
    ];
    if (a.calidad != null) rows.splice(1, 0, ['Calidad', a.calidad]);
    return rows;
  }
  const rows: Array<[string, number]> = [
    ['Velocidad', a.velocidad],
    ['Físico', a.fisico],
    ['Resistencia', a.resistencia],
    ['Remate', a.remate],
    ['Ofensivo', a.ofensivo],
    ['Pase', a.pase],
    ['Entrada', a.entrada],
    ['Agresividad', a.agresividad],
  ];
  if (a.calidad != null) rows.unshift(['Calidad', a.calidad]);
  return rows;
}

/** Teletipo-style label for a player's availability. */
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

/** A player's individual wish (deseo) as a small badge with a tooltip. */
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

/** Physical condition (fatiga): the fill grows and warms as a player tires. */
function FatigueBar({ fatigue }: { fatigue: number }) {
  const tier = fatigueTier(fatigue);
  return (
    <span className={`fatigue-bar fatigue--${tier}`} title={`Estado físico: ${FATIGUE_LABEL[tier]} (fatiga ${fatigue}/100)`}>
      <span className="fatigue-bar__fill" style={{ width: `${fatigue}%` }} />
    </span>
  );
}

/** BDFutbol portrait when available for this season, else the club crest. */
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
  const [linea, setLinea] = useState<Position | 'all'>('all');
  const [vista, setVista] = useState<Vista>('gestion');

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

  const seasonPlayers = career.season.teams.find((t) => t.id === career.humanTeamId)?.players ?? [];
  const streakById = new Map(seasonPlayers.map((p) => [p.id, p]));
  const vestuario = squadMorale(seasonPlayers);
  const vestuarioTier = scoreTier(vestuario);
  const desires = career.season.humanDesires ?? deriveHumanDesires(career);

  const mediaEquipo = players.length
    ? Math.round(players.reduce((s, p) => s + p.media, 0) / players.length)
    : 0;
  const ages = players
    .map((p) => playerAge(p, startYear))
    .filter((a): a is number => a !== null);
  const edadMedia = ages.length
    ? (ages.reduce((s, a) => s + a, 0) / ages.length).toFixed(1).replace('.', ',')
    : '—';

  const selected = players.find((p) => p.id === selectedId) ?? null;
  const visible = linea === 'all' ? players : players.filter((p) => p.posicion === linea);

  const modo = selected ? 'narrow' : vista;
  const rowClassBase = `mst-dt__row mst-dt__row--${modo}`;

  const fichaFor = (p: Player) => {
    const age = playerAge(p, startYear);
    const isYouth = age !== null && age <= YOUTH_MAX_AGE;
    const range = isYouth
      ? scoutEstimate(p, synthesizePotential(p, career.seed), observedSeasons, career.seed)
      : null;
    const status = statusLabel(availabilityStatus(availability[p.id], matchday));
    const contract = career.contracts[p.id];
    return (
      <aside className="mst-ficha">
        <button
          type="button"
          className="mst-ficha__close"
          aria-label="Cerrar ficha"
          onClick={() => setSelectedId(null)}
        >
          ×
        </button>
        <div className="mst-ficha__grid">
          <div className="mst-ficha__left">
            <div className="mst-ficha__badges">
              <span className="mst-ficha__d">#{p.dorsal ?? '·'}</span>
              <span className={`pos-badge pos-badge--${p.posicion}`}>{p.posicion}</span>
            </div>
            <span className="mst-ficha__name">{p.nombre}</span>
            {p.nombreCompleto !== p.nombre && (
              <span className="mst-ficha__full">{p.nombreCompleto}</span>
            )}
            <div className="mst-ficha__meta">
              {age !== null && <span>{age} años</span>}
              {p.alturaCm != null && <span>{p.alturaCm} cm</span>}
              {p.nacionalidad && (
                <span className="mst-ficha__nac">
                  <Flag country={p.nacionalidad} className="bd-ficha" />
                  <b>{p.nacionalidad}</b>
                </span>
              )}
              {p.clubAnterior && <span>ex {p.clubAnterior}</span>}
            </div>
            {status && <p className={status.className}>{status.text}</p>}
            <div className="mst-ficha__media">
              <span>Media</span>
              <b>{p.media}</b>
            </div>
          </div>
          <div className="mst-ficha__photo">
            <PlayerPhoto temporada={career.temporada} player={p} teamId={career.humanTeamId} />
          </div>
        </div>
        <div className="mst-ficha__bars">
          {fichaAttrs(p).map(([label, value]) => (
            <div key={label} className="mst-attr">
              <span className="mst-attr__k">{label}</span>
              <span className="mst-attr__track">
                <span
                  className={`mst-attr__fill mst-attr__fill--${ratingTier(value)}`}
                  style={{ width: `${value}%` }}
                />
              </span>
              <span className="mst-attr__v">{value}</span>
            </div>
          ))}
        </div>
        <div className="mst-ficha__contract">
          {contract ? (
            <>
              <div className="stat-like">
                <span className="mst-ficha__ck">Sueldo</span>
                <b>{formatEuros(contract.salary)}/año</b>
              </div>
              <div className="stat-like">
                <span className="mst-ficha__ck">Contrato</span>
                <b className={contract.yearsLeft === 1 ? 'squad-status--suspended' : undefined}>
                  {contract.yearsLeft} {contract.yearsLeft === 1 ? 'año' : 'años'}
                </b>
              </div>
            </>
          ) : null}
          {range && (
            <div className="stat-like">
              <span className="mst-ficha__ck">Potencial ojeado</span>
              <PotentialRange low={range.low} high={range.high} />
            </div>
          )}
        </div>
        <div className="mst-ficha__actions">
          {contract && (
            <button type="button" className="mst-notice__btn" onClick={() => renewPlayer(p.id)}>
              Renovar
            </button>
          )}
          <button type="button" className="mst-notice__btn" onClick={() => openPlayer(p.id)}>
            Ficha completa →
          </button>
        </div>
      </aside>
    );
  };

  let grupo: Position | null = null;

  return (
    <MisterFrame header={<MisterHeader />}>
      <div className={`mst-plantilla${selected ? ' mst-plantilla--ficha' : ''}`}>
        <div className="mst-tower mst-tower--wide">
          <div className="mst-grp">
            <p className="mst-grp__h">Resumen</p>
            <div className="stat-row">
              <span className="sr-k">Media del equipo</span>
              <span className="sr-v">{mediaEquipo}</span>
            </div>
            <div className="stat-row">
              <span className="sr-k">Edad media</span>
              <span className="sr-v">{edadMedia}</span>
            </div>
            <div className={`stat-row${vestuarioTier > 0 ? ' good' : vestuarioTier < 0 ? ' alert' : ''}`}>
              <span className="sr-k">Moral vestuario</span>
              <span className="sr-v">{vestuario}</span>
            </div>
            <div className="stat-row">
              <span className="sr-k">Masa salarial</span>
              <span className="sr-v">{formatEuros(masaSalarial)}</span>
            </div>
            <div className="stat-row total">
              <span className="sr-k">Presupuesto</span>
              <span className="sr-v">{formatEuros(career.budget)}</span>
            </div>
          </div>
          <div className="mst-grp">
            <p className="mst-grp__h">Líneas</p>
            {(['all', 'POR', 'DEF', 'MED', 'DEL'] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={`filt${linea === l ? ' is-on' : ''}`}
                onClick={() => setLinea(l)}
              >
                {l === 'all' ? 'Toda la plantilla' : LINE_LABEL[l]}
              </button>
            ))}
          </div>
          <div className="mst-grp">
            <p className="mst-grp__h">Vista</p>
            <button
              type="button"
              className={`filt${vista === 'gestion' && !selected ? ' is-on' : ''}`}
              onClick={() => {
                setVista('gestion');
                setSelectedId(null);
              }}
            >
              Gestión
            </button>
            <button
              type="button"
              className={`filt${vista === 'atributos' && !selected ? ' is-on' : ''}`}
              onClick={() => {
                setVista('atributos');
                setSelectedId(null);
              }}
            >
              Atributos
            </button>
          </div>
          <div className="mst-grp">
            <p className="mst-grp__h">Acciones</p>
            <button type="button" className="filt" onClick={() => goTo('comparativa')}>
              Comparar jugadores
            </button>
            <button type="button" className="filt" onClick={() => goTo('season')}>
              Volver al despacho
            </button>
          </div>
        </div>

        <section className="mst-paneltable" aria-label="Plantilla">
          {marketMessage ? <p className="market-msg">{marketMessage}</p> : null}
          <div className={`mst-dt__head mst-dt__row--${modo}`}>
            <span className="mst-dt__l">Jugador</span>
            {modo !== 'narrow' && <span>Edad</span>}
            <span>Media</span>
            {modo === 'gestion' && (
              <>
                <span className="mst-dt__l">Estado</span>
                <span>Físico</span>
                <span>Forma</span>
                <span>Moral</span>
                <span className="mst-dt__l">Deseo</span>
                <span>Sueldo</span>
                <span>Años</span>
              </>
            )}
            {modo === 'atributos' &&
              ATTR_COLS.map((c) => <span key={c.key}>{c.label}</span>)}
          </div>
          <div className="mst-dt__body">
            {visible.map((p) => {
              const age = playerAge(p, startYear);
              const status = statusLabel(availabilityStatus(availability[p.id], matchday));
              const streak = streakById.get(p.id);
              const form = streak?.form ?? NEUTRAL_FORM;
              const morale = streak?.morale ?? NEUTRAL_MORALE;
              const fatigue = streak?.fatigue ?? FRESH_FATIGUE;
              const contract = career.contracts[p.id];
              const header =
                p.posicion !== grupo ? (
                  <div className="mst-dt__group">{LINE_LABEL[p.posicion]}</div>
                ) : null;
              grupo = p.posicion;
              return (
                <div key={p.id}>
                  {header}
                  <div
                    role="button"
                    tabIndex={0}
                    className={`${rowClassBase}${status ? ' squad-row--out' : ''}${p.id === selectedId ? ' is-sel' : ''}`}
                    onClick={() => setSelectedId(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedId(p.id);
                    }}
                  >
                    <span className="mst-dt__l">
                      <PlayerTag
                        nombre={p.nombre}
                        posicion={p.posicion}
                        dorsal={p.dorsal}
                        nacionalidad={p.nacionalidad}
                      />
                    </span>
                    {modo !== 'narrow' && <span>{age ?? '—'}</span>}
                    <span>
                      <MediaPill value={p.media} />
                    </span>
                    {modo === 'gestion' && (
                      <>
                        <span className="mst-dt__l">
                          {status ? (
                            <span className={status.className}>{status.text}</span>
                          ) : (
                            <span className="hint">Disponible</span>
                          )}
                        </span>
                        <span>
                          <FatigueBar fatigue={fatigue} />
                        </span>
                        <span>
                          <FormArrow form={form} />
                        </span>
                        <span>
                          <MoraleBar morale={morale} />
                        </span>
                        <span className="mst-dt__l">
                          <DesireBadge kind={desires[p.id] ?? 'contento'} />
                        </span>
                        <span>{contract ? formatEuros(contract.salary) : '—'}</span>
                        <span className={contract?.yearsLeft === 1 ? 'squad-status--suspended' : undefined}>
                          {contract ? contract.yearsLeft : '—'}
                        </span>
                      </>
                    )}
                    {modo === 'atributos' &&
                      ATTR_COLS.map((c) => {
                        const v = p.atributos[c.key];
                        return (
                          <span key={c.key}>
                            {v != null ? <AttrValue value={v} /> : <span className="hint">–</span>}
                          </span>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {selected && fichaFor(selected)}
      </div>
    </MisterFrame>
  );
}
