import { describe, it, expect } from 'vitest';
import type { MatchResult } from '@engine';
import type { Attributes, League, Player } from '@data';
import { newSeason, advanceMatchday, isSeasonOver, teamName, teamFullName } from './season';
import { newCareer } from '../career/career';
import { serializeCareer, restoreCareer } from '../save/save';

const attrs: Attributes = {
  calidad: 60,
  agresividad: 60,
  resistencia: 60,
  velocidad: 60,
  fisico: 60,
  remate: 60,
  ofensivo: 60,
  pase: 60,
  entrada: 60,
  porteria: 20,
};

function player(id: string): Player {
  return {
    id,
    nombre: id,
    nombreCompleto: id,
    posicion: 'MED',
    esPortero: false,
    demarcaciones: [],
    atributos: { ...attrs },
    media: 65,
    dorsal: null,
    fechaNacimiento: '1975-01-01',
    alturaCm: 180,
    pesoKg: 75,
    nacionalidad: null,
    clubAnterior: null,
  };
}

const squad = (prefix: string): Player[] => Array.from({ length: 16 }, (_, i) => player(`${prefix}-p${i}`));

/** Two teams: one WITH an official full name, one WITHOUT (to exercise the fallback). */
function league(): League {
  return {
    id: 'es-primera-9697',
    nombre: 'Liga test',
    pais: 'Test',
    temporada: '96/97',
    competicion: { kind: 'league', rounds: 2, relegationSpots: 1, pointsForWin: 3 },
    equipos: [
      { id: 'betis', nombre: 'Betis', nombreCompleto: 'Real Betis Balompié', jugadores: squad('betis') },
      { id: 'rival', nombre: 'Rival', jugadores: squad('rival') },
    ],
  };
}

describe('teamFullName', () => {
  it('returns the official full name when present, leaving the short name untouched', () => {
    const season = newSeason(league(), 'betis', 7);
    expect(teamFullName(season, 'betis')).toBe('Real Betis Balompié');
    expect(teamName(season, 'betis')).toBe('Betis');
  });

  it('falls back to the short name when unset, and to the id when the team is unknown', () => {
    const season = newSeason(league(), 'betis', 7);
    expect(teamFullName(season, 'rival')).toBe('Rival');
    expect(teamFullName(season, 'desconocido')).toBe('desconocido');
  });

  it('is carried through the per-matchday transforms to the end of the season', () => {
    let season = newSeason(league(), 'betis', 7);
    while (!isSeasonOver(season)) season = advanceMatchday(season).state;
    expect(teamFullName(season, 'betis')).toBe('Real Betis Balompié');
    expect(teamFullName(season, 'rival')).toBe('Rival');
  });

  it('is display-only: its presence does not change the deterministic simulation', () => {
    const withName = league();
    const withoutName: League = {
      ...withName,
      equipos: withName.equipos.map((t) => ({ id: t.id, nombre: t.nombre, jugadores: t.jugadores })),
    };
    const playAll = (lg: League): MatchResult[] => {
      let season = newSeason(lg, 'betis', 7);
      const all: MatchResult[] = [];
      while (!isSeasonOver(season)) {
        const step = advanceMatchday(season);
        all.push(...step.played);
        season = step.state;
      }
      return all;
    };
    expect(playAll(withName)).toEqual(playAll(withoutName));
  });
});

describe('teamFullName in a career', () => {
  it('newCareer carries the full name into the season teams', () => {
    const career = newCareer(league(), 'betis', 3);
    expect(teamFullName(career.season, 'betis')).toBe('Real Betis Balompié');
    expect(teamFullName(career.season, 'rival')).toBe('Rival');
  });

  it('survives a serialize/restore round-trip (the save schema keeps nombreCompleto)', () => {
    const career = newCareer(league(), 'betis', 3);
    const restored = restoreCareer(serializeCareer(career), league());
    expect(teamFullName(restored.season, 'betis')).toBe('Real Betis Balompié');
    expect(teamFullName(restored.season, 'rival')).toBe('Rival');
  });
});
