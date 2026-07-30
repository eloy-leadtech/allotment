import { describe, it, expect } from 'vitest';
import { loadPrimera9697, parseLeague } from './loader';

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

describe('parseLeague', () => {
  it('throws on malformed data', () => {
    expect(() => parseLeague({ nombre: 'roto' })).toThrow();
  });
});
