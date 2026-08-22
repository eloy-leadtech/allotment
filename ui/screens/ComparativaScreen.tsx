import { useState } from 'react';
import {
  comparePlayers,
  seasonStartYear,
  formatEuros,
  type CompareRow,
  type CompareSide,
  type InfoRow,
} from '@game';
import type { Player, Position } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { GestHeader } from '@ui/components/GestHeader';
import { Crest } from '@ui/components/Crest';

const POSITION_LABEL: Record<Position, string> = {
  POR: 'Portero',
  DEF: 'Defensa',
  MED: 'Centrocampista',
  DEL: 'Delantero',
};

/** A selectable player plus which club it belongs to (for the dropdown groups). */
interface PlayerEntry {
  player: Player;
  teamId: string;
  teamName: string;
}

/** 0–100 bar width for `value` on a `max` scale (null / empty scale → 0). */
function barPct(value: number | null, max: number): number {
  if (value === null || max <= 0) return 0;
  return Math.min(100, (value / max) * 100);
}

/** One scored row: mirrored bars meeting in the middle, winner side highlighted. */
function ScoredRow({
  row,
  max,
  format,
}: {
  row: CompareRow;
  max: number;
  format: (v: number) => string;
}) {
  const text = (v: number | null) => (v === null ? '—' : format(v));
  return (
    <div className="compare-row">
      <div className={`compare-side compare-side--a${row.winner === 'a' ? ' compare-side--win' : ''}`}>
        <span className="compare-num">{text(row.a)}</span>
        <span className="compare-bar">
          <span className="compare-bar__fill" style={{ width: `${barPct(row.a, max)}%` }} />
        </span>
      </div>
      <span className="compare-label">{row.label}</span>
      <div className={`compare-side compare-side--b${row.winner === 'b' ? ' compare-side--win' : ''}`}>
        <span className="compare-bar">
          <span className="compare-bar__fill" style={{ width: `${barPct(row.b, max)}%` }} />
        </span>
        <span className="compare-num">{text(row.b)}</span>
      </div>
    </div>
  );
}

/** One descriptive row (edad, posición, altura, peso): plain values, no winner. */
function InfoRowView({ row }: { row: InfoRow }) {
  return (
    <div className="compare-inforow">
      <span className="compare-info-val">{row.a}</span>
      <span className="compare-label">{row.label}</span>
      <span className="compare-info-val">{row.b}</span>
    </div>
  );
}

/** The head of one column: club crest, name, position and media badge. */
function CompareHead({ entry, win }: { entry: PlayerEntry; win: boolean }) {
  const { player, teamId } = entry;
  return (
    <div className={`compare-head-card${win ? ' compare-head-card--win' : ''}`}>
      <div className="compare-head-card__crest crest-frame">
        <Crest teamId={teamId} size={44} />
      </div>
      <span className="compare-head-card__name">{player.nombre}</span>
      <span className="compare-head-card__sub">
        {POSITION_LABEL[player.posicion]} · {entry.teamName}
      </span>
      <span className="compare-head-card__media">{player.media}</span>
    </div>
  );
}

/** A player picker grouped by club, valuable clubs' players first within each. */
function PlayerPicker({
  label,
  teams,
  value,
  onChange,
}: {
  label: string;
  teams: Array<{ id: string; nombre: string; players: Player[] }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="compare-picker">
      <span className="compare-picker__label">{label}</span>
      <select className="compare-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {teams.map((team) => (
          <optgroup key={team.id} label={team.nombre}>
            {[...team.players]
              .sort((a, b) => b.media - a.media)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {p.media}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export function ComparativaScreen() {
  const career = useGameStore((s) => s.career);
  const goTo = useGameStore((s) => s.goTo);
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  // Order the clubs with the human's squad first, then the rest by name; each
  // team keeps its full evolving roster from the career (the current league).
  const teams = [...career.teams].sort((a, b) => {
    if (a.id === career.humanTeamId) return -1;
    if (b.id === career.humanTeamId) return 1;
    return a.nombre.localeCompare(b.nombre);
  });

  const byId = new Map<string, PlayerEntry>();
  for (const team of teams) {
    for (const player of team.players) {
      byId.set(player.id, { player, teamId: team.id, teamName: team.nombre });
    }
  }

  // Defaults: the human's two best players face off until the manager picks.
  const humanTeam = teams.find((t) => t.id === career.humanTeamId);
  const humanSorted = [...(humanTeam?.players ?? [])].sort((a, b) => b.media - a.media);
  const allIds = [...byId.keys()];
  const defA = humanSorted[0]?.id ?? allIds[0];
  const defB = humanSorted[1]?.id ?? allIds.find((id) => id !== defA) ?? defA;

  const aSel = aId && byId.has(aId) ? aId : defA;
  const bSel = bId && byId.has(bId) ? bId : defB;
  const entryA = aSel ? byId.get(aSel) : undefined;
  const entryB = bSel ? byId.get(bSel) : undefined;

  if (!entryA || !entryB) {
    return (
      <main className="screen">
        <GestHeader icon="⚔️" title="Comparativa" subtitle={`Cara a cara · ${career.temporada}`} />
        <p className="hint">No hay jugadores suficientes para comparar.</p>
        <div className="season-actions">
          <RetroButton onClick={() => goTo('squad')}>Volver a la plantilla</RetroButton>
        </div>
      </main>
    );
  }

  const cmp = comparePlayers(entryA.player, entryB.player, seasonStartYear(career.temporada));
  const valorRow = cmp.metrics.find((m) => m.key === 'valor');
  const valorMax = valorRow ? Math.max(valorRow.a ?? 0, valorRow.b ?? 0, 1) : 1;

  const verdict = (side: CompareSide, name: string): string => {
    if (side === 'tie') return 'Empate técnico entre los dos jugadores.';
    return `Mejor global: ${name} (gana ${cmp.tally.a}-${cmp.tally.b} en atributos).`;
  };
  const winnerName = cmp.overall === 'b' ? entryB.player.nombre : entryA.player.nombre;

  return (
    <main className="screen">
      <GestHeader
        icon="⚔️"
        title="Comparativa"
        subtitle={`Cara a cara · ${career.temporada}`}
        chips={[{ label: 'Atributos', value: `${cmp.tally.a} — ${cmp.tally.b}` }]}
      />

      <RetroPanel title="Elige dos jugadores">
        <div className="compare-pickers">
          <PlayerPicker label="Jugador A" teams={teams} value={aSel!} onChange={setAId} />
          <PlayerPicker label="Jugador B" teams={teams} value={bSel!} onChange={setBId} />
        </div>
      </RetroPanel>

      <section className="compare-heads">
        <CompareHead entry={entryA} win={cmp.overall === 'a'} />
        <span className="compare-vs" aria-hidden="true">
          VS
        </span>
        <CompareHead entry={entryB} win={cmp.overall === 'b'} />
      </section>

      <p className={`compare-verdict${cmp.overall === 'tie' ? ' compare-verdict--tie' : ''}`}>
        {verdict(cmp.overall, winnerName)}
      </p>

      <RetroPanel title="Atributos">
        <div className="compare-grid">
          {cmp.attributes.map((row) => (
            <ScoredRow key={row.key} row={row} max={99} format={(v) => `${v}`} />
          ))}
        </div>
      </RetroPanel>

      <RetroPanel title="Valoración">
        <div className="compare-grid">
          {cmp.metrics.map((row) => (
            <ScoredRow
              key={row.key}
              row={row}
              max={row.key === 'valor' ? valorMax : 99}
              format={row.key === 'valor' ? formatEuros : (v) => `${v}`}
            />
          ))}
        </div>
      </RetroPanel>

      <RetroPanel title="Ficha">
        <div className="compare-grid">
          {cmp.info.map((row) => (
            <InfoRowView key={row.key} row={row} />
          ))}
        </div>
      </RetroPanel>

      <div className="season-actions">
        <RetroButton onClick={() => goTo('squad')}>Volver a la plantilla</RetroButton>
      </div>
    </main>
  );
}
