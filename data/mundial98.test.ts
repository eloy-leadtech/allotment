import { describe, it, expect } from 'vitest';
import { loadSeleccionMundial98 } from './loader';

describe('loadSeleccionMundial98', () => {
  const wc = loadSeleccionMundial98();

  it('loads the Mundial 98 national teams', () => {
    expect(wc.temporada).toBe('Mundial 98');
    expect(wc.equipos.some((t) => t.id === 'brasil')).toBe(true);
    expect(wc.equipos.some((t) => t.id === 'francia')).toBe(true);
  });

  it('every finalist fields a playable squad (baseline-filled where needed)', () => {
    for (const id of ['brasil', 'espana', 'corea-del-sur', 'jamaica', 'arabia-saudi']) {
      const team = wc.equipos.find((t) => t.id === id);
      expect(team, id).toBeDefined();
      expect(team!.jugadores.length).toBeGreaterThanOrEqual(11);
      for (const p of team!.jugadores) {
        for (const v of Object.values(p.atributos)) {
          if (v === null) continue;
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(99);
        }
      }
    }
  });

  it('has globally unique player ids', () => {
    const ids = wc.equipos.flatMap((t) => t.jugadores.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
