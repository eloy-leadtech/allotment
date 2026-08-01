import { describe, it, expect } from 'vitest';
import { loadPrimera9697, loadPrimera9798 } from '@data';
import type { Attributes, League, Player } from '@data';
import { newCareer } from './career';
import { previewTransition, applyTransition } from './transition';
import { advanceMatchday, currentStandings } from '../season/season';

const HUMAN = 'barcelona';

function noPersonInTwoClubs(teams: { id: string; players: Player[] }[]): boolean {
  const seen = new Map<string, string>();
  for (const team of teams) {
    for (const p of team.players) {
      const key = `${p.nombreCompleto}|${p.fechaNacimiento ?? '?'}`;
      const prev = seen.get(key);
      if (prev && prev !== team.id) return false;
      seen.set(key, team.id);
    }
  }
  return true;
}

describe('previewTransition (real data 96/97 -> 97/98)', () => {
  const career = newCareer(loadPrimera9697(), HUMAN, 2024);
  const next = loadPrimera9798();
  const preview = previewTransition(career, next);

  it('reports the next season label and a champion', () => {
    expect(preview.temporadaActual).toBe('96/97');
    expect(preview.temporadaSiguiente).toBe('97/98');
    expect(preview.championId.length).toBeGreaterThan(0);
  });

  it('lists Ronaldo among departures (he left Barça for Inter)', () => {
    const names = preview.departures.map((p) => p.nombre);
    expect(names).toContain('Ronaldo');
  });

  it('lists Rivaldo among arrivals (he joined Barça)', () => {
    const names = preview.arrivals.map((p) => p.nombre);
    expect(names).toContain('Rivaldo');
  });
});

describe('applyTransition (real data)', () => {
  const next = loadPrimera9798();

  function careerAfterSomeMatches(): ReturnType<typeof newCareer> {
    const career = newCareer(loadPrimera9697(), HUMAN, 2024);
    let season = career.season;
    for (let i = 0; i < 5; i += 1) season = advanceMatchday(season).state;
    return { ...career, season };
  }

  it('advances to the next season with 22 clubs and a fresh derived season', () => {
    const career = careerAfterSomeMatches();
    const next2 = applyTransition(career, next, new Set());
    expect(next2.seasonNumber).toBe(2);
    expect(next2.temporada).toBe('97/98');
    expect(next2.leagueId).toBe('es-primera-9798');
    expect(next2.teams).toHaveLength(22);
    expect(next2.season.totalMatchdays).toBe(42);
    expect(next2.season.currentMatchday).toBe(1);
  });

  it('records the finished season in history with the standings leader as champion', () => {
    const career = careerAfterSomeMatches();
    const expectedChampion = currentStandings(career.season)[0]?.teamId;
    const next2 = applyTransition(career, next, new Set());
    expect(next2.history).toHaveLength(1);
    expect(next2.history[0]?.seasonNumber).toBe(1);
    expect(next2.history[0]?.championId).toBe(expectedChampion);
  });

  it('without retention, your club is exactly the real 97/98 roster (Ronaldo gone, Rivaldo in)', () => {
    const career = careerAfterSomeMatches();
    const next2 = applyTransition(career, next, new Set());
    const barca = next2.teams.find((t) => t.id === HUMAN);
    const names = barca?.players.map((p) => p.nombre) ?? [];
    expect(names).toContain('Rivaldo');
    expect(names).not.toContain('Ronaldo');
  });

  it('retaining Ronaldo keeps him in your squad without duplicating him elsewhere', () => {
    // NOTE: the real 97/98 dataset has pre-existing cross-club duplicates because
    // the 5 relegated clubs fall back to their (stale) 96/97 rosters — that is a
    // known MVP data artifact, not a transition bug. So we only assert that the
    // RETAINED person is not duplicated by our logic.
    const career = careerAfterSomeMatches();
    const ronaldo = career.teams
      .find((t) => t.id === HUMAN)
      ?.players.find((p) => p.nombre === 'Ronaldo');
    expect(ronaldo).toBeDefined();
    const next2 = applyTransition(career, next, new Set([ronaldo!.id]));
    const keptKey = `${ronaldo!.nombreCompleto}|${ronaldo!.fechaNacimiento ?? '?'}`;
    const clubsWithRonaldo = next2.teams.filter((t) =>
      t.players.some((p) => `${p.nombreCompleto}|${p.fechaNacimiento ?? '?'}` === keptKey),
    );
    expect(clubsWithRonaldo.map((t) => t.id)).toEqual([HUMAN]);
  });

  it('is deterministic', () => {
    const a = applyTransition(careerAfterSomeMatches(), next, new Set());
    const b = applyTransition(careerAfterSomeMatches(), next, new Set());
    expect(a.teams).toEqual(b.teams);
    expect(a.season.fixtures).toEqual(b.season.fixtures);
  });
});

// --- Synthetic dedup case: retaining a player removes them from their new club.

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

function player(id: string, nombre: string, birth: string): Player {
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

function league(id: string, temporada: string, equipos: League['equipos']): League {
  return {
    id,
    nombre: 'Liga test',
    pais: 'Test',
    temporada,
    competicion: { kind: 'league', rounds: 2, relegationSpots: 0, pointsForWin: 3 },
    equipos,
  };
}

describe('applyTransition dedup (synthetic)', () => {
  it('a retained departure is removed from the club history sent them to', () => {
    // Season 1: your club has Nomad + Stay; rival has RivalGuy.
    const season1 = league('t-9899', '98/99', [
      {
        id: 'you',
        nombre: 'You',
        jugadores: [player('you-nomad-1978', 'Nomad', '1978-01-01'), player('you-stay-1980', 'Stay', '1980-01-01')],
      },
      { id: 'rival', nombre: 'Rival', jugadores: [player('rival-guy-1979', 'RivalGuy', '1979-01-01')] },
    ]);

    // Season 2 real world: Nomad left 'you' and now plays for 'rival' (same person, new id).
    const season2 = league('t-9900', '99/00', [
      { id: 'you', nombre: 'You', jugadores: [player('you-stay-1980', 'Stay', '1980-01-01')] },
      {
        id: 'rival',
        nombre: 'Rival',
        jugadores: [
          player('rival-guy-1979', 'RivalGuy', '1979-01-01'),
          player('rival-nomad-1978', 'Nomad', '1978-01-01'), // Nomad at rival now
        ],
      },
    ]);

    const career = newCareer(season1, 'you', 7);
    const preview = previewTransition(career, season2);
    expect(preview.departures.map((p) => p.nombre)).toContain('Nomad');

    // Retain Nomad by his current-squad id.
    const next = applyTransition(career, season2, new Set(['you-nomad-1978']));

    const you = next.teams.find((t) => t.id === 'you');
    const rival = next.teams.find((t) => t.id === 'rival');
    expect(you?.players.map((p) => p.nombre).sort()).toEqual(['Nomad', 'Stay']);
    // Nomad must NOT also be at rival.
    expect(rival?.players.map((p) => p.nombre)).toEqual(['RivalGuy']);
    expect(noPersonInTwoClubs(next.teams)).toBe(true);
  });

  it('applies the training focus to a retained player and carries the focus forward', () => {
    // A YOUNG departure (age 19 in 99/00) so the focus clearly moves attributes.
    const season1 = league('t-9899', '98/99', [
      { id: 'you', nombre: 'You', jugadores: [player('you-kid-1980', 'Kid', '1980-01-01')] },
      { id: 'rival', nombre: 'Rival', jugadores: [player('rival-guy-1979', 'RivalGuy', '1979-01-01')] },
    ]);
    const season2 = league('t-9900', '99/00', [
      { id: 'you', nombre: 'You', jugadores: [player('you-new-1982', 'New', '1982-01-01')] },
      {
        id: 'rival',
        nombre: 'Rival',
        jugadores: [
          player('rival-guy-1979', 'RivalGuy', '1979-01-01'),
          player('rival-kid-1980', 'Kid', '1980-01-01'), // Kid moved to rival
        ],
      },
    ]);
    const base = newCareer(season1, 'you', 7);
    const retain = new Set(['you-kid-1980']);

    const atk = applyTransition({ ...base, training: { focus: 'ataque' } }, season2, retain);
    const def = applyTransition({ ...base, training: { focus: 'defensa' } }, season2, retain);

    const kidAtk = atk.teams.find((t) => t.id === 'you')?.players.find((p) => p.nombre === 'Kid');
    const kidDef = def.teams.find((t) => t.id === 'you')?.players.find((p) => p.nombre === 'Kid');
    expect(kidAtk).toBeDefined();
    expect(kidDef).toBeDefined();
    // Attacking training grows shooting more; defensive training grows tackling more.
    expect(kidAtk!.atributos.remate).toBeGreaterThan(kidDef!.atributos.remate);
    expect(kidDef!.atributos.entrada).toBeGreaterThan(kidAtk!.atributos.entrada);
    // The chosen focus is carried into the next season.
    expect(atk.training?.focus).toBe('ataque');
    expect(def.training?.focus).toBe('defensa');
  });

  it('releasing (not retaining) leaves the real world untouched', () => {
    const season1 = league('t-9899', '98/99', [
      { id: 'you', nombre: 'You', jugadores: [player('you-nomad-1978', 'Nomad', '1978-01-01')] },
      { id: 'rival', nombre: 'Rival', jugadores: [player('rival-guy-1979', 'RivalGuy', '1979-01-01')] },
    ]);
    const season2 = league('t-9900', '99/00', [
      { id: 'you', nombre: 'You', jugadores: [player('you-kid-1982', 'Kid', '1982-01-01')] },
      {
        id: 'rival',
        nombre: 'Rival',
        jugadores: [
          player('rival-guy-1979', 'RivalGuy', '1979-01-01'),
          player('rival-nomad-1978', 'Nomad', '1978-01-01'),
        ],
      },
    ]);
    const career = newCareer(season1, 'you', 7);
    const next = applyTransition(career, season2, new Set()); // release everyone
    const you = next.teams.find((t) => t.id === 'you');
    const rival = next.teams.find((t) => t.id === 'rival');
    expect(you?.players.map((p) => p.nombre)).toEqual(['Kid']);
    expect(rival?.players.map((p) => p.nombre).sort()).toEqual(['Nomad', 'RivalGuy']);
  });
});
