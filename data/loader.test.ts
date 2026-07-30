import { describe, it, expect } from 'vitest';
import { loadPrimera9697, loadPrimera9798, loadPrimera9899, parseLeague } from './loader';

describe('loadPrimera9697', () => {
  const league = loadPrimera9697();

  it('loads a valid 22-team Primera 96/97', () => {
    expect(league.temporada).toBe('96/97');
    expect(league.competicion.kind).toBe('league');
    expect(league.equipos).toHaveLength(22);
  });

  it('every team fields a usable squad (>= 16 players)', () => {
    for (const team of league.equipos) {
      expect(team.jugadores.length).toBeGreaterThanOrEqual(16);
    }
  });

  it('player ids are unique and attributes are in range', () => {
    const ids = new Set<string>();
    for (const team of league.equipos) {
      for (const player of team.jugadores) {
        expect(player.id.length).toBeGreaterThan(0);
        ids.add(player.id);
        expect(player.media).toBeGreaterThanOrEqual(1);
        expect(player.media).toBeLessThanOrEqual(99);
      }
    }
    const total = league.equipos.reduce((n, t) => n + t.jugadores.length, 0);
    expect(ids.size).toBe(total);
  });

  it('contains recognizable 96/97 stars', () => {
    const names = league.equipos.flatMap((t) => t.jugadores.map((p) => p.nombre));
    expect(names).toContain('Ronaldo');
  });
});

describe('loadPrimera9798', () => {
  const league9697 = loadPrimera9697();
  const league = loadPrimera9798();

  it('loads a valid 22-team Primera 97/98', () => {
    expect(league.temporada).toBe('97/98');
    expect(league.competicion.kind).toBe('league');
    expect(league.equipos).toHaveLength(22);
  });

  it('keeps the same 22 club ids as 96/97 (fixed set, no promotion/relegation yet)', () => {
    const ids97 = league.equipos.map((t) => t.id).sort();
    const ids96 = league9697.equipos.map((t) => t.id).sort();
    expect(ids97).toEqual(ids96);
  });

  it('every team fields a usable squad and all attributes are in range', () => {
    for (const team of league.equipos) {
      expect(team.jugadores.length).toBeGreaterThanOrEqual(16);
      for (const p of team.jugadores) {
        for (const value of Object.values(p.atributos)) {
          if (value === null) continue;
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(99);
        }
      }
    }
  });

  it('reflects real 97/98 transfers (Ronaldo left Barça for Inter)', () => {
    const barca = league.equipos.find((t) => t.id === 'barcelona');
    expect(barca).toBeDefined();
    const barcaNames = barca?.jugadores.map((p) => p.nombre) ?? [];
    expect(barcaNames).toContain('Rivaldo');
    expect(barcaNames).not.toContain('Ronaldo');
  });
});

describe('loadPrimera9899', () => {
  const league9798 = loadPrimera9798();
  const league = loadPrimera9899();

  it('loads a valid 22-team Primera 98/99', () => {
    expect(league.temporada).toBe('98/99');
    expect(league.competicion.kind).toBe('league');
    expect(league.equipos).toHaveLength(22);
  });

  it('keeps the same 22 club ids as the earlier seasons (fixed set)', () => {
    const ids99 = league.equipos.map((t) => t.id).sort();
    const ids98 = league9798.equipos.map((t) => t.id).sort();
    expect(ids99).toEqual(ids98);
  });

  it('every team fields a usable squad and all attributes are in range', () => {
    for (const team of league.equipos) {
      expect(team.jugadores.length).toBeGreaterThanOrEqual(16);
      for (const p of team.jugadores) {
        for (const value of Object.values(p.atributos)) {
          if (value === null) continue;
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(99);
        }
      }
    }
  });

  it('reflects a real 98/99 side (Raúl at Real Madrid)', () => {
    const madrid = league.equipos.find((t) => t.id === 'real-madrid');
    expect(madrid?.jugadores.map((p) => p.nombre)).toContain('Raúl');
  });
});

describe('parseLeague', () => {
  it('throws on malformed data', () => {
    expect(() => parseLeague({ nombre: 'roto' })).toThrow();
  });
});
