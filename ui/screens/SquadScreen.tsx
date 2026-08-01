import {
  synthesizePotential,
  scoutEstimate,
  playerAge,
  seasonStartYear,
  availabilityStatus,
  type AvailabilityStatus,
} from '@game';
import { scoreTier, squadMorale, NEUTRAL_FORM, NEUTRAL_MORALE } from '@engine';
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
        </div>
      </section>

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
                <th>Forma</th>
                <th>Moral</th>
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
                const status = statusLabel(availabilityStatus(availability[p.id], matchday));
                const streak = streakById.get(p.id);
                const form = streak?.form ?? NEUTRAL_FORM;
                const morale = streak?.morale ?? NEUTRAL_MORALE;
                return (
                  <tr key={p.id} className={status ? 'squad-row--out' : undefined}>
                    <td>{p.posicion}</td>
                    <td className="squad-name">{p.nombre}</td>
                    <td>{age ?? '—'}</td>
                    <td className="squad-media">{p.media}</td>
                    <td>
                      {status ? (
                        <span className={status.className}>{status.text}</span>
                      ) : (
                        <span className="hint">Disponible</span>
                      )}
                    </td>
                    <td><FormArrow form={form} /></td>
                    <td><MoraleBar morale={morale} /></td>
                    <td>{range ? <PotentialRange low={range.low} high={range.high} /> : <span className="hint">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="hint">
          El ojeo es falible: el rango puede no contener el valor real y se estrecha (que no acierta más) con
          el tiempo.
        </p>
      </RetroPanel>

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}
