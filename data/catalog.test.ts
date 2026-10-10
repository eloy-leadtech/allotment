import { describe, expect, it } from 'vitest';
import {
  catalogCountries,
  catalogEntry,
  catalogFor,
  catalogLeagues,
  cachedLeague,
  primeLeagueCache,
} from './catalog';
import type { League } from './schemas';

describe('catálogo histórico (manifest)', () => {
  it('trae las 692 ligas-temporada generadas', () => {
    expect(catalogLeagues().length).toBe(692);
  });

  it('cubre los 14 países del alcance', () => {
    const codes = catalogCountries().map((c) => c.code);
    expect(codes).toContain('ESP');
    expect(codes).toContain('ITA');
    expect(codes).toContain('ENG');
    expect(codes.length).toBe(14);
  });

  it('cada entrada tiene los campos que necesita el selector', () => {
    for (const e of catalogLeagues()) {
      expect(e.id).toMatch(/^[a-z]{3}-[12]-\d{4}-\d{2}$/);
      expect(e.temporada).toMatch(/^\d{2}\/\d{2}$/);
      expect(e.equipos).toBeGreaterThanOrEqual(2);
      expect(e.file).toBe(`${e.id}.json`);
    }
  });

  it('es el manifiesto de la nota por temporada v2: una persona = una plantilla por temporada', () => {
    // La v1 sumaba 354.776 jugadores-temporada porque contaba dos veces a quien pasó por dos clubes en un curso;
    // la v2 deja a cada persona en el club donde más minutos jugó (340.030, incluidos 155 jugadores que se quedan también
    // en un equipo de plantilla fina para que el motor pueda alinearlo). Si se regenera el catálogo, actualizar la cifra.
    const total = catalogLeagues().reduce((s, e) => s + e.jugadores, 0);
    expect(total).toBe(340030);
    // ... y ningún equipo del manifiesto es una plantilla de prestados vacía
    expect(catalogLeagues().every((e) => e.jugadores >= e.equipos)).toBe(true);
  });

  it('filtra por país y división', () => {
    const esp1 = catalogFor('ESP', '1');
    expect(esp1.length).toBeGreaterThan(50);
    expect(esp1.every((e) => e.country === 'ESP' && e.division === '1')).toBe(true);
    const barca9697 = catalogEntry('esp-1-1996-97');
    expect(barca9697?.equipos).toBe(22);
  });

  it('el cache síncrono lee lo que se ha sembrado', () => {
    const fake = {
      id: 'esp-1-1996-97',
      nombre: 'X',
      pais: 'España',
      temporada: '96/97',
      competicion: { kind: 'league', rounds: 2, relegationSpots: 4, pointsForWin: 3 },
      equipos: [
        { id: 'a', nombre: 'A', jugadores: [] },
        { id: 'b', nombre: 'B', jugadores: [] },
      ],
    } as unknown as League;
    expect(cachedLeague('esp-1-1996-97')).toBeUndefined();
    primeLeagueCache('esp-1-1996-97', fake);
    expect(cachedLeague('esp-1-1996-97')).toBe(fake);
  });
});
