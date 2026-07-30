import { describe, it, expect } from 'vitest';
import type { Attributes, League, Player } from '@data';
import { newCareer } from './career';
import { careerOutcome, applyDivisionChange, applyTransition } from './transition';
import { advanceMatchday, isSeasonOver, currentStandings } from '../season/season';

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

function player(id: string, nombre: string, birth = '1975-01-01'): Player {
  return {
    id,
    nombre,
    nombreCompleto: nombre,
    posicion: 'MED',
    esPortero: false,
    demarcaciones: [],
    atributos: { ...attrs },
    media: 65,
    dorsal: null,
    fechaNacimiento: birth,
    alturaCm: 180,
    pesoKg: 75,
    nacionalidad: null,
    clubAnterior: null,
  };
}

function squad(prefix: string, n = 16): Player[] {
  return Array.from({ length: n }, (_, i) => player(`${prefix}-p${i}`, `${prefix}P${i}`));
}

function league(id: string, temporada: string, ids: string[]): League {
  return {
    id,
    nombre: 'Liga test',
    pais: 'Test',
    temporada,
    competicion: { kind: 'league', rounds: 2, relegationSpots: 3, pointsForWin: 3 },
    equipos: ids.map((tid) => ({ id: tid, nombre: tid.toUpperCase(), jugadores: squad(tid) })),
  };
}

/** Play a career's season to the end so it has a real final table. */
function playOut(career: ReturnType<typeof newCareer>): ReturnType<typeof newCareer> {
  let season = career.season;
  while (!isSeasonOver(season)) season = advanceMatchday(season).state;
  return { ...career, season };
}

describe('careerOutcome', () => {
  it('reads the human outcome from their finished division table', () => {
    const primera = league('p', '96/97', ['you', 'a', 'b', 'c', 'd', 'e']);
    const career = playOut(newCareer(primera, 'you', 7));
    const table = currentStandings(career.season);
    const humanPos = table.findIndex((r) => r.teamId === 'you');
    const outcome = careerOutcome(career);
    // Bottom-3 of a 6-team league => relegated; else stays (in primera).
    if (humanPos >= table.length - 3) expect(outcome).toBe('relegated');
    else expect(outcome).toBe('stays');
  });
});

describe('applyDivisionChange', () => {
  const nextSegunda = league('seg-9798', '97/98', ['seg1', 'seg2', 'seg3', 'seg4', 'you']);

  it('relegates the human: whole squad moves into Segunda, division flips', () => {
    const primera = league('pri-9697', '96/97', ['you', 'a', 'b', 'c']);
    const career = playOut(newCareer(primera, 'you', 7));
    const squadBefore = career.teams.find((t) => t.id === 'you')!.players.map((p) => p.id).sort();

    const next = applyDivisionChange(career, 'segunda', nextSegunda);
    expect(next.division).toBe('segunda');
    expect(next.temporada).toBe('97/98');
    expect(next.leagueId).toBe('seg-9798');
    expect(next.seasonNumber).toBe(2);
    // Your squad came with you (same ids, aged but same identity/count minus retirees).
    const squadAfter = next.teams.find((t) => t.id === 'you')!.players.map((p) => p.id).sort();
    expect(squadAfter).toEqual(squadBefore);
    // The real Segunda clubs are present too.
    expect(next.teams.map((t) => t.id).sort()).toContain('seg1');
    expect(next.teams).toHaveLength(5);
    expect(next.history).toHaveLength(1);
  });

  it('adds the human if the target league did not include them', () => {
    const segundaNoYou = league('seg-9798', '97/98', ['seg1', 'seg2', 'seg3']);
    const primera = league('pri-9697', '96/97', ['you', 'a', 'b', 'c']);
    const career = playOut(newCareer(primera, 'you', 7));
    const next = applyDivisionChange(career, 'segunda', segundaNoYou);
    expect(next.teams.some((t) => t.id === 'you')).toBe(true);
    expect(next.teams).toHaveLength(4);
  });

  it('carries the budget across a division change', () => {
    const primera = league('pri-9697', '96/97', ['you', 'a', 'b', 'c']);
    const career = { ...playOut(newCareer(primera, 'you', 7)), budget: 5_000_000 };
    const next = applyDivisionChange(career, 'segunda', nextSegunda);
    expect(next.budget).toBe(5_000_000);
  });

  it('produces a derived season that can be played', () => {
    const primera = league('pri-9697', '96/97', ['you', 'a', 'b', 'c']);
    const career = playOut(newCareer(primera, 'you', 7));
    const next = applyDivisionChange(career, 'segunda', nextSegunda);
    expect(next.season.currentMatchday).toBe(1);
    const step = advanceMatchday(next.season);
    expect(step.state.currentMatchday).toBe(2);
  });
});

describe('applyTransition robustness', () => {
  it('carries the squad when the human club is absent from the next league', () => {
    const primera = league('pri-9596', '95/96', ['you', 'a', 'b', 'c']);
    const career = playOut(newCareer(primera, 'you', 7));
    const before = career.teams.find((t) => t.id === 'you')!.players.map((p) => p.id).sort();
    // Next league does NOT contain the human club (kept up against history).
    const nextWithoutYou = league('pri-9697', '96/97', ['a', 'b', 'c', 'd']);
    const next = applyTransition(career, nextWithoutYou, new Set());
    expect(next.teams.some((t) => t.id === 'you')).toBe(true);
    expect(next.teams.find((t) => t.id === 'you')!.players.map((p) => p.id).sort()).toEqual(before);
    expect(next.division).toBe('primera');
    expect(next.temporada).toBe('96/97');
  });
});
