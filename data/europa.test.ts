import { describe, it, expect } from 'vitest';
import { loadEuropa9899, loadEuropa9900 } from './loader';
import { EUROPA_SEASONS, getEuropaByTemporada } from './seasons';

describe('European clubs databases', () => {
  const cases = [
    { load: loadEuropa9899, temporada: '98/99', id: 'europa-9899' },
    { load: loadEuropa9900, temporada: '99/00', id: 'europa-9900' },
  ] as const;

  for (const c of cases) {
    it(`loads a valid European clubs ${c.temporada} container`, () => {
      const league = c.load();
      expect(league.id).toBe(c.id);
      expect(league.temporada).toBe(c.temporada);
      expect(league.competicion.kind).toBe('league');
      // A meaningful continental field (dozens of clubs, all playable).
      expect(league.equipos.length).toBeGreaterThanOrEqual(30);
      for (const team of league.equipos) {
        expect(team.jugadores.length).toBeGreaterThanOrEqual(11);
        for (const p of team.jugadores) {
          for (const value of Object.values(p.atributos)) {
            if (value === null) continue;
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(99);
          }
        }
      }
      // Player ids are unique across the whole container.
      const ids = league.equipos.flatMap((t) => t.jugadores.map((p) => p.id));
      expect(new Set(ids).size).toBe(ids.length);
    });
  }

  it('includes marquee clubs from across Europe', () => {
    const clubs = new Set(loadEuropa9899().equipos.map((t) => t.id));
    expect(clubs.has('juventus')).toBe(true);
    expect(clubs.has('bayern-munich')).toBe(true);
    expect(clubs.has('manchester-united')).toBe(true);
  });

  it('pairs each European season with its label', () => {
    expect(EUROPA_SEASONS).toHaveLength(2);
    expect(getEuropaByTemporada('98/99')?.id).toBe('europa-9899');
    expect(getEuropaByTemporada('90/91')).toBeUndefined();
  });
});
