import { describe, it, expect } from 'vitest';
import {
  loadSegunda9697,
  loadSegunda9798,
  loadSegunda9899,
  loadSegunda9900,
} from './loader';
import { SEGUNDA_SEASONS, getSegundaByTemporada } from './seasons';

describe('Segunda División databases', () => {
  const cases = [
    { load: loadSegunda9697, temporada: '96/97', teams: 12 },
    { load: loadSegunda9798, temporada: '97/98', teams: 12 },
    { load: loadSegunda9899, temporada: '98/99', teams: 22 },
    { load: loadSegunda9900, temporada: '99/00', teams: 22 },
  ] as const;

  for (const c of cases) {
    it(`loads a valid Segunda ${c.temporada} with ${c.teams} clubs`, () => {
      const league = c.load();
      expect(league.temporada).toBe(c.temporada);
      expect(league.competicion.kind).toBe('league');
      expect(league.equipos).toHaveLength(c.teams);
      for (const team of league.equipos) {
        expect(team.jugadores.length).toBeGreaterThan(0);
        for (const p of team.jugadores) {
          for (const value of Object.values(p.atributos)) {
            if (value === null) continue;
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(99);
          }
        }
      }
    });
  }

  it('reflects real relegations (Sevilla in Segunda 97/98, Málaga in 98/99)', () => {
    expect(loadSegunda9798().equipos.some((t) => t.id === 'sevilla')).toBe(true);
    expect(loadSegunda9899().equipos.some((t) => t.id === 'malaga')).toBe(true);
  });

  it('pairs each Segunda season with its label', () => {
    expect(SEGUNDA_SEASONS).toHaveLength(5);
    expect(getSegundaByTemporada('98/99')?.id).toBe('es-segunda-9899');
    expect(getSegundaByTemporada('90/91')).toBeUndefined();
  });
});
