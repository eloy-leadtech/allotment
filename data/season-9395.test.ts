import { describe, it, expect } from 'vitest';
import { loadPrimera9394, loadPrimera9495, loadSegunda9495 } from './loader';
import {
  SEASONS,
  getSegundaByTemporada,
  getSeasonByTemporada,
  nextSeasonByTemporada,
} from './seasons';

describe('temporadas 93/94 y 94/95 (arranque de la carrera)', () => {
  const cases = [
    { load: loadPrimera9394, id: 'es-primera-9394', temporada: '93/94', teams: 20 },
    { load: loadPrimera9495, id: 'es-primera-9495', temporada: '94/95', teams: 20 },
    { load: loadSegunda9495, id: 'es-segunda-9495', temporada: '94/95', teams: 20 },
  ] as const;

  for (const c of cases) {
    it(`loads a valid ${c.id} with ${c.teams} clubs and in-range attributes`, () => {
      const league = c.load();
      expect(league.id).toBe(c.id);
      expect(league.temporada).toBe(c.temporada);
      expect(league.competicion.kind).toBe('league');
      expect(league.equipos).toHaveLength(c.teams);
      for (const team of league.equipos) {
        expect(team.jugadores.length).toBeGreaterThan(0);
        for (const p of team.jugadores) {
          expect(p.nombreCompleto.length).toBeGreaterThan(0);
          for (const value of Object.values(p.atributos)) {
            if (value === null) continue;
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(99);
          }
        }
      }
    });
  }

  it('makes 93/94 the oldest playable season', () => {
    expect(SEASONS[0]?.id).toBe('es-primera-9394');
    expect(getSeasonByTemporada('93/94')?.id).toBe('es-primera-9394');
  });

  it('chains 93/94 -> 94/95 -> 95/96', () => {
    expect(nextSeasonByTemporada('93/94')?.id).toBe('es-primera-9495');
    expect(nextSeasonByTemporada('94/95')?.id).toBe('es-primera-9596');
  });

  it('pairs 94/95 with its Segunda, but 93/94 is Primera-only', () => {
    expect(getSegundaByTemporada('94/95')?.id).toBe('es-segunda-9495');
    expect(getSegundaByTemporada('93/94')).toBeUndefined();
  });
});
