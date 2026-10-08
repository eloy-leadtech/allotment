/**
 * Acceptance suite for E10 (multi-liga jugable): a career in a NON-Spanish
 * catalogue league plays a full season and its own national cup, step by step,
 * reusing the agnostic league + knockout engines. Pure and deterministic.
 */
import { describe, it, expect } from 'vitest';
import { nationalCupFor } from '@data';
import type { Attributes, League, Player, Team } from '@data';
import { newCareer } from './career';
import { runCareerNationalCup } from './competitions';
import { isSeasonOver, advanceMatchday, currentStandings } from '../season/season';

function attrs(media: number): Attributes {
  return {
    calidad: media,
    agresividad: media,
    resistencia: media,
    velocidad: media,
    fisico: media,
    remate: media,
    ofensivo: media,
    pase: media,
    entrada: media,
    porteria: media,
  };
}

function player(id: string, media: number, posicion: Player['posicion']): Player {
  return {
    id,
    nombre: id,
    nombreCompleto: `Player ${id}`,
    posicion,
    esPortero: posicion === 'POR',
    demarcaciones: [],
    atributos: attrs(media),
    media,
    dorsal: null,
    fechaNacimiento: '1996-01-01',
    alturaCm: null,
    pesoKg: null,
    nacionalidad: null,
    clubAnterior: null,
  };
}

function team(id: string, nombre: string, media: number): Team {
  const players: Player[] = [player(`${id}-gk`, media, 'POR')];
  for (let i = 0; i < 15; i += 1) {
    const pos: Player['posicion'] = i < 5 ? 'DEF' : i < 11 ? 'MED' : 'DEL';
    players.push(player(`${id}-p${i}`, media + (i % 5) - 2, pos));
  }
  return { id, nombre, jugadores: players };
}

function league(id: string, pais: string, temporada: string, specs: Array<[string, string, number]>): League {
  return {
    id,
    nombre: `Liga ${pais}`,
    pais,
    temporada,
    competicion: { kind: 'league', rounds: 2, relegationSpots: 3, pointsForWin: 3 },
    equipos: specs.map(([tid, nombre, media]) => team(tid, nombre, media)),
  };
}

// A 10-club Serie A for 2020/21 (enough for a real double round-robin + cup).
const serieA = league('ita-1-2020-21', 'Italia', '20/21', [
  ['juventus', 'Juventus', 80],
  ['milan', 'Milan', 77],
  ['inter', 'Inter', 78],
  ['napoli', 'Napoli', 75],
  ['roma', 'Roma', 73],
  ['lazio', 'Lazio', 72],
  ['atalanta', 'Atalanta', 74],
  ['fiorentina', 'Fiorentina', 68],
  ['torino', 'Torino', 66],
  ['genoa', 'Genoa', 64],
]);

const HUMAN = 'juventus';

describe('multi-liga: national cup for a catalogue country', () => {
  it('maps Italy to the Coppa Italia (its own cup, not the Copa del Rey)', () => {
    expect(nationalCupFor('ITA').nombre).toBe('Coppa Italia');
    expect(nationalCupFor('ITA').nombre).not.toBe(nationalCupFor('ESP').nombre);
  });

  it('runs an Italian career cup over the domestic field and crowns a champion', () => {
    const career = newCareer(serieA, HUMAN, 2024);
    const field = career.season.teams;
    const cup = runCareerNationalCup(career.seed, career.seasonNumber, field, HUMAN);
    const ids = new Set(field.map((t) => t.id));
    expect(ids.has(cup.championId)).toBe(true);
    expect(cup.knockout.at(-1)?.nombre).toBe('final');
  });

  it("plays the human's cup run step by step (each tie a full match for the teletipo)", () => {
    const career = newCareer(serieA, HUMAN, 2024);
    const cup = runCareerNationalCup(career.seed, career.seasonNumber, career.season.teams, HUMAN);
    expect(cup.humanPath && cup.humanPath.length).toBeGreaterThan(0);
    for (const step of cup.humanPath!) {
      expect([step.match.homeId, step.match.awayId]).toContain(HUMAN);
      expect(step.ronda.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic and changes with the season number', () => {
    const career = newCareer(serieA, HUMAN, 2024);
    const a = runCareerNationalCup(career.seed, 1, career.season.teams, HUMAN);
    const b = runCareerNationalCup(career.seed, 1, career.season.teams, HUMAN);
    expect(a).toEqual(b);
    const c = runCareerNationalCup(career.seed, 2, career.season.teams, HUMAN);
    expect(JSON.stringify(a) === JSON.stringify(c)).toBe(false);
  });
});

describe('multi-liga: full-season smoke in a non-Spanish league', () => {
  it('plays every matchday of an Italian league season to completion', () => {
    const career = newCareer(serieA, HUMAN, 2024);
    let state = career.season;
    const total = state.totalMatchdays;
    expect(total).toBe((serieA.equipos.length - 1) * 2); // double round-robin

    let guard = 0;
    while (!isSeasonOver(state) && guard < total + 5) {
      const step = advanceMatchday(state);
      state = step.state;
      guard += 1;
    }
    expect(isSeasonOver(state)).toBe(true);

    const table = currentStandings(state);
    expect(table).toHaveLength(serieA.equipos.length);
    // Every club played the same number of games (full season, no byes).
    const games = table.map((r) => r.played);
    expect(new Set(games).size).toBe(1);
    expect(games[0]).toBe((serieA.equipos.length - 1) * 2);
  });
});
