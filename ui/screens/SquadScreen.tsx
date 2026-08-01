import {
  synthesizePotential,
  scoutEstimate,
  playerAge,
  seasonStartYear,
  availabilityStatus,
  squadWageBill,
  formatEuros,
  type AvailabilityStatus,
} from '@game';
import { scoreTier, squadMorale, fatigueTier, NEUTRAL_FORM, NEUTRAL_MORALE, FRESH_FATIGUE } from '@engine';
import type { Player, Position } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';
import { Stadium } from '@ui/components/Stadium';
import { PotentialRange } from '@ui/components/PotentialRange';

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

export function SquadScreen() {
  const career = useGameStore((s) => s.career);
  const goTo = useGameStore((s) => s.goTo);
  const openPlayer = useGameStore((s) => s.openPlayer);
  const renewPlayer = useGameStore((s) => s.renewPlayer);
  const marketMessage = useGameStore((s) => s.marketMessage);

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

  return (
    <main className="screen">
      <section className="squad-card">
        <div className="squad-card__crest crest-frame">
          <Crest teamId={career.humanTeamId} size={72} />
        </div>
        <div className="squad-card__meta">
          <h1>{team?.nombre ?? career.humanTeamId}</h1>
          <span className="matchday">Plantilla · {career.temporada}</span>
          <span className={`vestuario ${tierClass(scoreTier(vestuario))}`}>
            Moral del vestuario: <strong>{vestuario}</strong>/100
          </span>
          <span className="matchday">
            Masa salarial: <strong>{formatEuros(masaSalarial)}</strong>/año · Presupuesto: {formatEuros(career.budget)}
          </span>
        </div>
      </section>

      {marketMessage ? <p className="market-msg">{marketMessage}</p> : null}

      <Stadium teamId={career.humanTeamId} />

      <RetroPanel title="Plantilla">
        <div className="squad-scroll">
          <table className="squad-table">
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
                return (
                  <tr key={p.id} className={status ? 'squad-row--out' : undefined}>
                    <td>{p.posicion}</td>
                    <td className="squad-name">
                      <button type="button" className="player-link" onClick={() => openPlayer(p.id)}>
                        {p.nombre}
                      </button>
                    </td>
                    <td>{age ?? '—'}</td>
                    <td className="squad-media">{p.media}</td>
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
                    <td className="squad-media">{contract ? formatEuros(contract.salary) : '—'}</td>
                    <td>
                      {contract ? (
                        <span className={lastYear ? 'squad-status squad-status--suspended' : undefined}>
                          {contract.yearsLeft} {contract.yearsLeft === 1 ? 'año' : 'años'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{range ? <PotentialRange low={range.low} high={range.high} /> : <span className="hint">—</span>}</td>
                    <td>
                      {contract ? (
                        <RetroButton onClick={() => renewPlayer(p.id)}>Renovar</RetroButton>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="hint">
          Pulsa el nombre de un jugador para ver su ficha completa. El ojeo es falible: el rango puede no
          contener el valor real y se estrecha (que no acierta más) con el tiempo.
        </p>
      </RetroPanel>

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}
