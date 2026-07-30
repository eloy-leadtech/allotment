import { describe, it, expect } from 'vitest';
import { simulateMatch } from './simulateMatch';
import { formationMods, FORMATIONS, FORMATION_LIST } from './formation';
import type { MatchPlayer, MatchTeam } from './types';

function player(id: string, line: MatchPlayer['posicion'], media: number): MatchPlayer {
  return {
    id,
    nombre: id,
    posicion: line,
    esPortero: line === 'POR',
    media,
    remate: line === 'DEL' ? media : media - 20,
    ofensivo: line === 'DEL' || line === 'MED' ? media : media - 15,
    pase: media - 5,
    entrada: line === 'DEF' ? media : media - 15,
    porteria: line === 'POR' ? media : 10,
  };
}

function squad(prefix: string, media = 70): MatchPlayer[] {
  return [
    player(`${prefix}-gk`, 'POR', media),
    player(`${prefix}-d1`, 'DEF', media),
    player(`${prefix}-d2`, 'DEF', media),
    player(`${prefix}-d3`, 'DEF', media),
    player(`${prefix}-d4`, 'DEF', media),
    player(`${prefix}-m1`, 'MED', media),
    player(`${prefix}-m2`, 'MED', media),
    player(`${prefix}-m3`, 'MED', media),
    player(`${prefix}-f1`, 'DEL', media),
    player(`${prefix}-f2`, 'DEL', media),
    player(`${prefix}-f3`, 'DEL', media),
    player(`${prefix}-sub`, 'DEL', media - 30), // a weak bench option
  ];
}

const team = (id: string, tactics?: MatchTeam['tactics']): MatchTeam => ({
  id,
  nombre: id,
  players: squad(id),
  tactics,
});

describe('formationMods', () => {
  it('is neutral when no formation is given', () => {
    expect(formationMods()).toEqual({ attack: 1, defense: 1 });
  });
  it('gives each formation the right multipliers', () => {
    expect(formationMods('4-4-2')).toEqual({ attack: 1, defense: 1 });
    expect(FORMATIONS['3-4-3'].attack).toBeGreaterThan(FORMATIONS['4-4-2'].attack);
    expect(FORMATIONS['5-4-1'].defense).toBeGreaterThan(FORMATIONS['4-4-2'].defense);
  });
  it('lists formations from defensive to attacking', () => {
    for (let i = 1; i < FORMATION_LIST.length; i += 1) {
      expect(FORMATIONS[FORMATION_LIST[i]!].attack).toBeGreaterThanOrEqual(
        FORMATIONS[FORMATION_LIST[i - 1]!].attack,
      );
    }
  });
});

describe('simulateMatch tactics', () => {
  it('a neutral 4-4-2 on both sides matches playing with no tactics', () => {
    const plain = simulateMatch({ home: team('h'), away: team('a'), seed: 123 });
    const with442 = simulateMatch({
      home: team('h', { formation: '4-4-2' }),
      away: team('a', { formation: '4-4-2' }),
      seed: 123,
    });
    expect(with442).toEqual(plain);
  });

  it('an attacking formation scores more than a defensive one, in aggregate', () => {
    let attackingGoals = 0;
    let defensiveGoals = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      attackingGoals += simulateMatch({
        home: team('h', { formation: '3-4-3' }),
        away: team('a'),
        seed,
      }).homeGoals;
      defensiveGoals += simulateMatch({
        home: team('h', { formation: '5-4-1' }),
        away: team('a'),
        seed,
      }).homeGoals;
    }
    expect(attackingGoals).toBeGreaterThan(defensiveGoals);
  });

  it('respects an explicit starting XI (only those players appear)', () => {
    const xi = squad('h').slice(0, 11); // excludes the weak sub
    const result = simulateMatch({
      home: team('h', { formation: '4-4-2', xi }),
      away: team('a'),
      seed: 7,
    });
    const xiIds = new Set(xi.map((p) => p.id));
    const homeActors = result.events.filter((e) => e.team === 'home').map((e) => e.playerId);
    for (const id of homeActors) expect(xiIds.has(id)).toBe(true);
  });

  it('is still deterministic with tactics', () => {
    const input = { home: team('h', { formation: '4-3-3' }), away: team('a', { formation: '5-3-2' }), seed: 99 };
    expect(simulateMatch(input)).toEqual(simulateMatch(input));
  });
});
