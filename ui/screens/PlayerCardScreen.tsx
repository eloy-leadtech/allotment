import {
  synthesizePotential,
  scoutEstimate,
  playerAge,
  seasonStartYear,
  availabilityStatus,
  formatEuros,
  type AvailabilityStatus,
} from '@game';
import { scoreTier, fatigueTier, NEUTRAL_FORM, NEUTRAL_MORALE, FRESH_FATIGUE } from '@engine';
import type { Attributes, Player, Position } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';
import { PotentialRange } from '@ui/components/PotentialRange';

/** Players at or under this age get a (fallible) scouted potential range. */
const YOUTH_MAX_AGE = 23;

const POSITION_LABEL: Record<Position, string> = {
  POR: 'Portero',
  DEF: 'Defensa',
  MED: 'Centrocampista',
  DEL: 'Delantero',
};

/** The 10 gameplay attributes in a sensible reading order, with Spanish labels. */
const ATTRIBUTE_ROWS: Array<{ key: keyof Attributes; label: string }> = [
  { key: 'calidad', label: 'Calidad' },
  { key: 'remate', label: 'Remate' },
  { key: 'ofensivo', label: 'Ofensivo' },
  { key: 'pase', label: 'Pase' },
  { key: 'velocidad', label: 'Velocidad' },
  { key: 'fisico', label: 'Físico' },
  { key: 'resistencia', label: 'Resistencia' },
  { key: 'agresividad', label: 'Agresividad' },
  { key: 'entrada', label: 'Entrada' },
  { key: 'porteria', label: 'Portería' },
];

const FATIGUE_LABEL = ['Fresco', 'Algo cansado', 'Cansado', 'Reventado'] as const;

/** CSS modifier for a -/0/+ streak tier. */
function tierClass(tier: number): string {
  if (tier > 0) return 'streak--up';
  if (tier < 0) return 'streak--down';
  return 'streak--flat';
}

/** Quality band for a 0–99 attribute, used to colour its bar. */
function attrTier(value: number): string {
  if (value >= 80) return 'attr--elite';
  if (value >= 65) return 'attr--good';
  if (value >= 50) return 'attr--avg';
  return 'attr--low';
}

/** One labelled 0–99 attribute bar. Null values (reduced records) read as "—". */
function AttrBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <div className="attr-row attr--na">
        <span className="attr-label">{label}</span>
        <span className="attr-track" aria-hidden="true">
          <span className="attr-fill" style={{ width: '0%' }} />
        </span>
        <span className="attr-val hint">—</span>
      </div>
    );
  }
  return (
    <div className={`attr-row ${attrTier(value)}`}>
      <span className="attr-label">{label}</span>
      <span className="attr-track">
        <span className="attr-fill" style={{ width: `${Math.min(100, (value / 99) * 100)}%` }} />
      </span>
      <span className="attr-val">{value}</span>
    </div>
  );
}

/** A compact 0–100 stat bar (form / morale / fatigue) with a caption. */
function StatBar({ label, value, tierName, caption }: { label: string; value: number; tierName: string; caption: string }) {
  return (
    <div className={`vital-row ${tierName}`}>
      <span className="vital-label">{label}</span>
      <span className="vital-track">
        <span className="vital-fill" style={{ width: `${Math.min(100, value)}%` }} />
      </span>
      <span className="vital-caption">{caption}</span>
    </div>
  );
}

function availabilityText({ status, matchesOut }: AvailabilityStatus): { text: string; className: string } {
  if (status === 'injured') {
    return { text: `Lesionado (${matchesOut} j.)`, className: 'squad-status squad-status--injured' };
  }
  if (status === 'suspended') {
    return { text: `Sancionado (${matchesOut} j.)`, className: 'squad-status squad-status--suspended' };
  }
  return { text: 'Disponible', className: 'hint' };
}

export function PlayerCardScreen() {
  const career = useGameStore((s) => s.career);
  const selectedPlayerId = useGameStore((s) => s.selectedPlayerId);
  const goTo = useGameStore((s) => s.goTo);
  const renewPlayer = useGameStore((s) => s.renewPlayer);

  const team = career?.teams.find((t) => t.id === career.humanTeamId);
  const player: Player | undefined = team?.players.find((p) => p.id === selectedPlayerId);

  if (!career || !player) {
    return (
      <main className="screen">
        <p>No hay ficha de jugador.</p>
        <RetroButton onClick={() => goTo(career ? 'squad' : 'title')}>Volver</RetroButton>
      </main>
    );
  }

  const startYear = seasonStartYear(career.temporada);
  const age = playerAge(player, startYear);
  const isYouth = age !== null && age <= YOUTH_MAX_AGE;
  const observedSeasons = career.seasonNumber - 1;
  const range = isYouth
    ? scoutEstimate(player, synthesizePotential(player, career.seed), observedSeasons, career.seed)
    : null;

  const matchday = career.season.currentMatchday;
  const availability = availabilityText(availabilityStatus(career.season.availability[player.id], matchday));

  const seasonPlayer = career.season.teams
    .find((t) => t.id === career.humanTeamId)
    ?.players.find((p) => p.id === player.id);
  const form = seasonPlayer?.form ?? NEUTRAL_FORM;
  const morale = seasonPlayer?.morale ?? NEUTRAL_MORALE;
  const fatigue = seasonPlayer?.fatigue ?? FRESH_FATIGUE;
  const fTier = fatigueTier(fatigue);

  const contract = career.contracts[player.id];
  const lastYear = contract?.yearsLeft === 1;

  return (
    <main className="screen">
      <section className="player-hero">
        <div className="player-hero__crest crest-frame">
          <Crest teamId={career.humanTeamId} size={72} />
        </div>
        <div className="player-hero__meta">
          <h1>{player.nombre}</h1>
          <span className="matchday">
            {POSITION_LABEL[player.posicion]}
            {player.dorsal ? ` · Dorsal ${player.dorsal}` : ''}
            {age !== null ? ` · ${age} años` : ''}
          </span>
          {player.nombreCompleto && player.nombreCompleto !== player.nombre ? (
            <span className="hint">{player.nombreCompleto}</span>
          ) : null}
          <span className={availability.className}>{availability.text}</span>
        </div>
        <div className="player-hero__media" title="Media global">
          <span className="player-hero__media-value">{player.media}</span>
          <span className="player-hero__media-label">Media</span>
        </div>
      </section>

      <RetroPanel title="Atributos">
        <div className="attr-grid">
          {ATTRIBUTE_ROWS.map(({ key, label }) => (
            <AttrBar key={key} label={label} value={player.atributos[key]} />
          ))}
        </div>
      </RetroPanel>

      <RetroPanel title="Estado">
        <div className="vital-grid">
          <StatBar
            label="Forma"
            value={form}
            tierName={tierClass(scoreTier(form))}
            caption={`${form}/100`}
          />
          <StatBar
            label="Moral"
            value={morale}
            tierName={tierClass(scoreTier(morale))}
            caption={`${morale}/100`}
          />
          <StatBar
            label="Físico"
            value={100 - fatigue}
            tierName={`fatigue--${fTier}`}
            caption={FATIGUE_LABEL[fTier]}
          />
        </div>
      </RetroPanel>

      <RetroPanel title="Contrato y potencial">
        <dl className="player-facts">
          <div className="player-fact">
            <dt>Sueldo</dt>
            <dd className="squad-media">{contract ? `${formatEuros(contract.salary)}/año` : '—'}</dd>
          </div>
          <div className="player-fact">
            <dt>Contrato</dt>
            <dd>
              {contract ? (
                <span className={lastYear ? 'squad-status squad-status--suspended' : undefined}>
                  {contract.yearsLeft} {contract.yearsLeft === 1 ? 'año' : 'años'}
                </span>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="player-fact">
            <dt>Potencial ojeado</dt>
            <dd>{range ? <PotentialRange low={range.low} high={range.high} /> : <span className="hint">—</span>}</dd>
          </div>
        </dl>
        {range ? (
          <p className="hint">
            El ojeo es falible: el rango puede no contener el valor real y se estrecha (que no acierta más) con el
            tiempo.
          </p>
        ) : null}
      </RetroPanel>

      <div className="season-actions">
        {contract ? <RetroButton onClick={() => renewPlayer(player.id)}>Renovar</RetroButton> : null}
        <RetroButton onClick={() => goTo('squad')}>Volver a la plantilla</RetroButton>
      </div>
    </main>
  );
}
