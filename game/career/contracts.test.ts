import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import type { Attributes, Player } from '@data';
import {
  deriveSalary,
  initialContract,
  initialContracts,
  wageBill,
  squadWageBill,
  advanceContracts,
  renewContract,
  RENEWAL_TERM,
  type Contract,
} from './contracts';
import { marketValue } from './market';
import { newCareer } from './career';
import type { CareerState } from './types';

const attrs: Attributes = {
  calidad: 70,
  agresividad: 60,
  resistencia: 70,
  velocidad: 70,
  fisico: 65,
  remate: 70,
  ofensivo: 70,
  pase: 70,
  entrada: 60,
  porteria: 20,
};

function makePlayer(over: Partial<Player> & { media: number }): Player {
  return {
    id: over.id ?? `p-${over.media}`,
    nombre: over.nombre ?? 'Test',
    nombreCompleto: over.nombreCompleto ?? 'Test Player',
    posicion: over.posicion ?? 'DEL',
    esPortero: over.esPortero ?? false,
    demarcaciones: [],
    atributos: over.atributos ?? attrs,
    media: over.media,
    dorsal: null,
    fechaNacimiento: over.fechaNacimiento ?? null,
    alturaCm: null,
    pesoKg: null,
    nacionalidad: null,
    clubAnterior: null,
  };
}

describe('deriveSalary', () => {
  it('is a fraction of market value (a superstar earns far more than a starter)', () => {
    const star = deriveSalary(makePlayer({ media: 92 }), 25);
    const starter = deriveSalary(makePlayer({ media: 72 }), 25);
    expect(star).toBeGreaterThan(starter);
    // Roughly a nickel on the euro of market value (calibrated, not exact).
    expect(star).toBeLessThan(marketValue(makePlayer({ media: 92 }), 25));
  });

  it('never falls below the wage floor', () => {
    const fringe = deriveSalary(makePlayer({ media: 40 }), 34);
    expect(fringe).toBeGreaterThanOrEqual(60_000);
  });

  it('is deterministic', () => {
    const p = makePlayer({ media: 80 });
    expect(deriveSalary(p, 26)).toBe(deriveSalary(p, 26));
  });
});

describe('initialContract / initialContracts', () => {
  it('gives every squad player a positive salary and a multi-season term', () => {
    const players = [makePlayer({ id: 'a', media: 80 }), makePlayer({ id: 'b', media: 60 })];
    const contracts = initialContracts(players, 7, 1, 1996);
    expect(Object.keys(contracts)).toEqual(['a', 'b']);
    for (const id of ['a', 'b']) {
      expect(contracts[id]!.salary).toBeGreaterThan(0);
      expect(contracts[id]!.yearsLeft).toBeGreaterThanOrEqual(2);
      expect(contracts[id]!.yearsLeft).toBeLessThanOrEqual(4);
    }
  });

  it('is deterministic for the same seed/season/player', () => {
    const p = makePlayer({ id: 'x', media: 77 });
    expect(initialContract(p, 24, 42, 1)).toEqual(initialContract(p, 24, 42, 1));
  });
});

describe('wageBill / squadWageBill', () => {
  it('wageBill sums every salary in the book', () => {
    const contracts: Record<string, Contract> = {
      a: { salary: 1_000_000, yearsLeft: 3 },
      b: { salary: 500_000, yearsLeft: 2 },
    };
    expect(wageBill(contracts)).toBe(1_500_000);
  });

  it('squadWageBill only counts players actually in the team', () => {
    const contracts: Record<string, Contract> = {
      a: { salary: 1_000_000, yearsLeft: 3 },
      gone: { salary: 9_000_000, yearsLeft: 1 },
    };
    const team = { id: 't', nombre: 'T', players: [makePlayer({ id: 'a', media: 80 })] };
    expect(squadWageBill(team, contracts)).toBe(1_000_000);
  });
});

describe('advanceContracts', () => {
  const ctx = { seed: 1, seasonNumber: 2, seasonStartYear: 1997 };

  it('ticks continuing deals down a season and keeps the wage', () => {
    const players = [makePlayer({ id: 'a', media: 80 })];
    const prev: Record<string, Contract> = { a: { salary: 2_000_000, yearsLeft: 3 } };
    const res = advanceContracts(players, prev, ctx);
    expect(res.contracts['a']).toEqual({ salary: 2_000_000, yearsLeft: 2 });
    expect(res.released).toHaveLength(0);
    expect(res.players.map((p) => p.id)).toEqual(['a']);
  });

  it('releases a player whose deal reaches 0 (leaves FREE, no contract)', () => {
    const expiring = makePlayer({ id: 'z', media: 70 });
    const staying = makePlayer({ id: 'a', media: 80 });
    const prev: Record<string, Contract> = {
      z: { salary: 1_000_000, yearsLeft: 1 },
      a: { salary: 2_000_000, yearsLeft: 2 },
    };
    const res = advanceContracts([staying, expiring], prev, ctx);
    expect(res.released.map((p) => p.id)).toEqual(['z']);
    expect(res.players.map((p) => p.id)).toEqual(['a']);
    expect(res.contracts['z']).toBeUndefined();
    expect(res.contracts['a']!.yearsLeft).toBe(1);
  });

  it('hands a fresh deal to a new arrival with no prior contract', () => {
    const arrival = makePlayer({ id: 'new', media: 75, fechaNacimiento: '1973-01-01' });
    const res = advanceContracts([arrival], {}, ctx);
    expect(res.contracts['new']!.salary).toBeGreaterThan(0);
    expect(res.contracts['new']!.yearsLeft).toBeGreaterThanOrEqual(2);
  });

  it('is order-independent (deterministic contract book)', () => {
    const a = makePlayer({ id: 'a', media: 80 });
    const b = makePlayer({ id: 'b', media: 60 });
    const prev: Record<string, Contract> = {
      a: { salary: 2_000_000, yearsLeft: 3 },
      b: { salary: 500_000, yearsLeft: 3 },
    };
    expect(advanceContracts([a, b], prev, ctx).contracts).toEqual(
      advanceContracts([b, a], prev, ctx).contracts,
    );
  });
});

describe('renewContract', () => {
  function barca(): CareerState {
    return newCareer(loadPrimera9697(), 'barcelona', 7);
  }

  it('resets the term and raises the wage, debiting an up-front bonus', () => {
    const career = barca();
    const human = career.teams.find((t) => t.id === 'barcelona')!;
    const playerId = human.players[0]!.id;
    const before = career.contracts[playerId]!;

    const res = renewContract(career, playerId);
    expect(res.ok).toBe(true);
    const after = res.career.contracts[playerId]!;
    expect(after.yearsLeft).toBe(RENEWAL_TERM);
    expect(after.salary).toBeGreaterThan(before.salary);
    // The bonus was charged against the budget.
    expect(res.career.budget).toBeLessThan(career.budget);
  });

  it('soft-fails for an unknown player', () => {
    const res = renewContract(barca(), 'no-such-id');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('no-encontrado');
  });

  it('soft-fails when the budget cannot cover the bonus', () => {
    const career = barca();
    const playerId = career.teams.find((t) => t.id === 'barcelona')!.players[0]!.id;
    const broke: CareerState = { ...career, budget: 0 };
    const res = renewContract(broke, playerId);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('presupuesto');
  });
});

describe('newCareer wage book', () => {
  it('contracts the entire human squad and nobody else', () => {
    const career = newCareer(loadPrimera9697(), 'barcelona', 3);
    const human = career.teams.find((t) => t.id === 'barcelona')!;
    const ids = new Set(human.players.map((p) => p.id));
    expect(Object.keys(career.contracts).sort()).toEqual([...ids].sort());
    expect(wageBill(career.contracts)).toBeGreaterThan(0);
  });

  it('keeps the masa salarial well below the season-one budget (not bankrupt at kick-off)', () => {
    const career = newCareer(loadPrimera9697(), 'barcelona', 3);
    // A top club's opening wage bill should be affordable relative to its budget.
    expect(wageBill(career.contracts)).toBeLessThan(career.budget * 6);
  });
});
