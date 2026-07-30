import { useMemo, useState } from 'react';
import { FORMATION_LIST, DEFAULT_FORMATION, type Formation } from '@engine';
import type { Player, Position } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';

const POSITION_ORDER: Record<Position, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };
const byLineThenMedia = (a: Player, b: Player): number =>
  POSITION_ORDER[a.posicion] - POSITION_ORDER[b.posicion] || b.media - a.media;

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

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Táctica</h1>
        <span className="matchday">Titulares: {xi.length}/11</span>
      </header>

      <RetroPanel title="Formación">
        <div className="formation-row">
          {FORMATION_LIST.map((f) => (
            <button
              key={f}
              type="button"
              className={`retro-btn ${f === formation ? 'retro-btn--primary' : 'retro-btn--default'}`}
              onClick={() => setFormation(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="hint">Más delanteros = más ataque y menos defensa. 4-4-2 es equilibrado.</p>
      </RetroPanel>

      <RetroPanel title="Once titular">
        <p className="hint">Elige 11 para fijar el once; si eliges menos, se pone el mejor XI automáticamente.</p>
        <ul className="market-list">
          {squad.map((p) => {
            const on = xi.includes(p.id);
            return (
              <li key={p.id} className="market-row">
                <label className="team-cell">
                  <input type="checkbox" checked={on} onChange={() => toggle(p.id)} disabled={!on && xi.length >= 11} />
                  <span className="market-name">{p.nombre}</span>
                </label>
                <span className="hint">
                  {p.posicion} · media {p.media}
                </span>
              </li>
            );
          })}
        </ul>
      </RetroPanel>

      <div className="season-actions">
        <RetroButton variant="primary" onClick={save}>
          Guardar táctica
        </RetroButton>
        <RetroButton onClick={() => goTo('season')}>Atrás</RetroButton>
      </div>
    </main>
  );
}
