import { useMemo, useState } from 'react';
import { FORMATION_LIST, DEFAULT_FORMATION, type Formation } from '@engine';
import type { Player, Position } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Pcf7Frame, place, type Rect } from '@ui/components/Pcf7Frame';

const POSITION_ORDER: Record<Position, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };
const byLineThenMedia = (a: Player, b: Player): number =>
  POSITION_ORDER[a.posicion] - POSITION_ORDER[b.posicion] || b.media - a.media;

// Zonas sobre scr_027 (640×480, findings/13 §4.5). Ajustables por el humano.
const TITLE: Rect = { x: 150, y: 40, w: 340, h: 26 };
const PANEL_FORM: Rect = { x: 15, y: 84, w: 250, h: 182 };
const PANEL_LIST: Rect = { x: 275, y: 84, w: 300, h: 182 };
const PITCH: Rect = { x: 200, y: 288, w: 250, h: 172 };
const PANEL_CTRL: Rect = { x: 15, y: 288, w: 175, h: 172 };

/** Vertical bands (top% within pitch) per line, attacking upward. */
const LINE_Y: Record<'POR' | 'DEF' | 'MED' | 'DEL', number> = { POR: 88, DEF: 66, MED: 44, DEL: 20 };

interface Slot {
  line: 'POR' | 'DEF' | 'MED' | 'DEL';
  x: number;
  y: number;
}

/** Build the 11 pitch slots for a formation (e.g. "4-3-3" → GK + 4 + 3 + 3). */
function formationSlots(formation: Formation): Slot[] {
  const [d, m, f] = formation.split('-').map((n) => Number.parseInt(n, 10));
  const slots: Slot[] = [{ line: 'POR', x: 50, y: LINE_Y.POR }];
  const spread = (count: number, line: 'DEF' | 'MED' | 'DEL'): void => {
    for (let i = 0; i < count; i += 1) {
      slots.push({ line, x: ((i + 1) / (count + 1)) * 100, y: LINE_Y[line] });
    }
  };
  spread(d ?? 4, 'DEF');
  spread(m ?? 4, 'MED');
  spread(f ?? 2, 'DEL');
  return slots;
}

export function TacticsScreen() {
  const career = useGameStore((s) => s.career);
  const setTactics = useGameStore((s) => s.setTactics);
  const goTo = useGameStore((s) => s.goTo);

  const [formation, setFormation] = useState<Formation>(career?.tactics?.formation ?? DEFAULT_FORMATION);
  const [xi, setXi] = useState<string[]>(career?.tactics?.xiIds ?? []);

  const squad = useMemo(() => {
    const players = career?.teams.find((t) => t.id === career.humanTeamId)?.players ?? [];
    return [...players].sort(byLineThenMedia);
  }, [career]);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const toggle = (id: string): void =>
    setXi((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 11 ? [...prev, id] : prev,
    );

  const save = (): void => {
    setTactics({ formation, xiIds: xi.length === 11 ? xi : undefined });
    goTo('season');
  };

  // Selected players sorted by line, placed onto the formation's 11 slots.
  const byId = new Map(squad.map((p) => [p.id, p]));
  const chosen = xi.map((id) => byId.get(id)).filter((p): p is Player => p != null).sort(byLineThenMedia);
  const slots = formationSlots(formation);

  return (
    <Pcf7Frame bitmap="scr_027.png">
      <div className="pcf7ovl pcf7title-ovl" style={place(TITLE)}>
        Táctica · {xi.length}/11
      </div>

      {/* Panel izq-arriba: formación. */}
      <div className="pcf7steel" style={place(PANEL_FORM)}>
        <div className="pcf7formrow">
          {FORMATION_LIST.map((f) => (
            <button
              key={f}
              type="button"
              className={`pcf7formchip${f === formation ? ' pcf7formchip--on' : ''}`}
              onClick={() => setFormation(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="pcf7data-ovl" style={{ position: 'static', padding: '0.4em 0.6em', color: 'var(--c-ink-dim)', whiteSpace: 'normal' }}>
          Más delanteros = más ataque, menos defensa. Elige 11 para fijar el once; con menos, el mejor XI automático.
        </p>
      </div>

      {/* Panel der-arriba: lista de plantilla seleccionable. */}
      <div className="pcf7steel" style={place(PANEL_LIST)}>
        <div className="pcf7steel__scroll">
          {squad.map((p) => {
            const on = xi.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`pcf7pick${on ? ' pcf7pick--on' : ''}`}
                disabled={!on && xi.length >= 11}
                onClick={() => toggle(p.id)}
              >
                <span className="pcf7pick__dorsal">{p.dorsal ?? '·'}</span>
                <span className="pcf7pick__name">{p.nombre}</span>
                <span className="pcf7pick__meta">{p.posicion} · {p.media}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Campo con fichas del once. */}
      <div className="pcf7pitch" style={place(PITCH)}>
        {chosen.slice(0, slots.length).map((p, i) => {
          const slot = slots[i]!;
          return (
            <div
              key={p.id}
              className="pcf7token"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              title={`${p.nombre} (${p.posicion})`}
            >
              {p.dorsal ?? p.media}
              <span className="pcf7token__name">{p.nombre}</span>
            </div>
          );
        })}
      </div>

      {/* Panel izq-abajo: acciones. */}
      <div className="pcf7steel" style={place(PANEL_CTRL)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em', padding: '0.5em' }}>
          <button type="button" className="pcf7formchip pcf7formchip--on" onClick={save}>
            Guardar táctica
          </button>
          <button type="button" className="pcf7formchip" onClick={() => goTo('season')}>
            Volver al despacho
          </button>
          <p className="pcf7data-ovl" style={{ position: 'static', color: 'var(--c-ink-dim)', whiteSpace: 'normal' }}>
            Formación {formation}
          </p>
        </div>
      </div>
    </Pcf7Frame>
  );
}
