import { describe, it, expect } from 'vitest';
import { loadSeleccionEuro2000 } from './loader';

describe('loadSeleccionEuro2000', () => {
  const euro = loadSeleccionEuro2000();

  it('loads the Euro 2000 national teams', () => {
    expect(euro.temporada).toBe('Euro 2000');
    expect(euro.equipos.length).toBeGreaterThanOrEqual(48);
    expect(euro.equipos.some((t) => t.id === 'espana')).toBe(true);
  });

  it('every national team fields a playable squad with in-range attributes', () => {
    for (const team of euro.equipos) {
      expect(team.jugadores.length).toBeGreaterThanOrEqual(11);
      for (const p of team.jugadores) {
        for (const v of Object.values(p.atributos)) {
          if (v === null) continue;
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(99);
        }
      }
    }
  });

  it('has globally unique player ids', () => {
    const ids = euro.equipos.flatMap((t) => t.jugadores.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes Spain with a full squad', () => {
    const esp = euro.equipos.find((t) => t.id === 'espana');
    expect(esp?.jugadores.length).toBe(22);
  });
});
