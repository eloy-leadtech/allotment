import { describe, it, expect } from 'vitest';
import { loadPrimera9596, loadSegunda9596 } from './loader';
import { nextSeasonByTemporada, getSegundaByTemporada } from './seasons';

describe('temporada 95/96', () => {
  const primera = loadPrimera9596();
  const segunda = loadSegunda9596();

  it('loads Primera 95/96 (22) and Segunda 95/96 (20)', () => {
    expect(primera.temporada).toBe('95/96');
    expect(primera.equipos).toHaveLength(22);
    expect(segunda.equipos).toHaveLength(20);
  });

  it('has all attributes in range (synthesized but valid)', () => {
    for (const team of [...primera.equipos, ...segunda.equipos]) {
      expect(team.jugadores.length).toBeGreaterThan(0);
      for (const p of team.jugadores) {
        for (const v of Object.values(p.atributos)) {
          if (v === null) continue;
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(99);
        }
      }
    }
  });

  it('includes the 95/96 double winner At. Madrid', () => {
    expect(primera.equipos.some((t) => t.id === 'at-madrid')).toBe(true);
  });

  it('chains forward to 96/97', () => {
    expect(nextSeasonByTemporada('95/96')?.id).toBe('es-primera-9697');
    expect(getSegundaByTemporada('95/96')?.id).toBe('es-segunda-9596');
  });
});
