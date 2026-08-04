import { describe, it, expect } from 'vitest';
import { loadPrimera9697, loadPrimera9798 } from '@data';
import type { Attributes, Player } from '@data';
import { newCareer } from './career';
import { applyTransition } from './transition';
import { advanceContracts } from './contracts';
import { playerAge, seasonStartYear } from './development';
import {
  renewalDemand,
  pendingRenewals,
  resolvedRenewals,
  acceptRenewal,
  offerRenewal,
  letGoPlayer,
  teamRenewalPerformance,
  DEFAULT_RENEWALS,
  RENEWAL_MAX_YEARS,
} from './renewals';
import { serializeCareer, restoreCareer } from '../save/save';
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

const HUMAN = 'barcelona';
const barca = (seed = 7): CareerState => newCareer(loadPrimera9697(), HUMAN, seed);
const humanOf = (c: CareerState) => c.teams.find((t) => t.id === HUMAN)!;

/** Force one squad player onto an expiring (final-year) deal at a known ficha. */
function withExpiring(c: CareerState, id: string, salary = 1_000_000): CareerState {
  return { ...c, contracts: { ...c.contracts, [id]: { salary, yearsLeft: 1 } } };
}

/** A peak-age (24-29) squad player, who always demands a genuine raise. */
function peakPlayer(c: CareerState): Player {
  const startYear = seasonStartYear(c.temporada);
  const p = humanOf(c).players.find((pl) => {
    const a = playerAge(pl, startYear);
    return a !== null && a >= 24 && a <= 29;
  });
  if (!p) throw new Error('fixture: no peak-age player in Barça 96/97');
  return p;
}

describe('renewalDemand (deterministic ask)', () => {
  const input = {
    seed: 7,
    seasonNumber: 1,
    player: makePlayer({ id: 'x', media: 85, fechaNacimiento: '1970-01-01' }), // ~26 at 1996
    age: 26,
    currentSalary: 1_000_000,
    performance: 1,
  };

  it('is deterministic for the same seed/season/player', () => {
    expect(renewalDemand(input)).toEqual(renewalDemand(input));
  });

  it('differs by player and by seed', () => {
    const otherPlayer = { ...input, player: makePlayer({ id: 'y', media: 85 }) };
    const otherSeed = { ...input, seed: 999 };
    expect(renewalDemand(otherPlayer)).not.toEqual(renewalDemand(input));
    expect(renewalDemand(otherSeed)).not.toEqual(renewalDemand(input));
  });

  it('never asks below the current ficha, and a peak star asks for a raise', () => {
    const demand = renewalDemand(input);
    expect(demand.salary).toBeGreaterThan(input.currentSalary); // peak age → raise
    expect(demand.minSalary).toBeGreaterThanOrEqual(input.currentSalary);
    expect(demand.minSalary).toBeLessThanOrEqual(demand.salary);
    expect(demand.years).toBeGreaterThanOrEqual(1);
  });

  it('a veteran asks for a short deal, a youngster a long one', () => {
    const young = renewalDemand({ ...input, age: 20 });
    const veteran = renewalDemand({ ...input, age: 34 });
    expect(young.years).toBeGreaterThan(veteran.years);
  });

  it('a better season lifts the ask (performance modifier)', () => {
    const champions = renewalDemand({ ...input, performance: 1.12 });
    const strugglers = renewalDemand({ ...input, performance: 0.92 });
    expect(champions.salary).toBeGreaterThan(strugglers.salary);
  });
});

describe('teamRenewalPerformance', () => {
  it('stays within the calibrated band', () => {
    const perf = teamRenewalPerformance(barca());
    expect(perf).toBeGreaterThanOrEqual(0.92);
    expect(perf).toBeLessThanOrEqual(1.12);
  });
});

describe('pendingRenewals', () => {
  it('lists only final-year deals still awaiting a decision', () => {
    const c0 = barca();
    const p = peakPlayer(c0);
    const c = withExpiring(c0, p.id);
    const ids = pendingRenewals(c).map((o) => o.playerId);
    expect(ids).toContain(p.id);
    // Multi-season deals (everyone else) are not asking.
    const others = humanOf(c).players.filter((pl) => pl.id !== p.id);
    for (const other of others) expect(ids).not.toContain(other.id);
  });

  it('drops a player once his negotiation is resolved', () => {
    const c = withExpiring(barca(), peakPlayer(barca()).id);
    const p = pendingRenewals(c)[0]!;
    const after = acceptRenewal(c, p.playerId);
    if (after.status !== 'renewed') throw new Error('expected renewed');
    expect(pendingRenewals(after.career).map((o) => o.playerId)).not.toContain(p.playerId);
  });
});

describe('acceptRenewal', () => {
  it('renews at the full demand, adjusts the salary up and charges the prima', () => {
    const c0 = barca();
    const p = peakPlayer(c0);
    const c = withExpiring(c0, p.id, 1_000_000);
    const demand = pendingRenewals(c).find((o) => o.playerId === p.id)!.demand;

    const out = acceptRenewal(c, p.id);
    expect(out.status).toBe('renewed');
    if (out.status !== 'renewed') return;
    // The new deal: agreed ficha, and years+1 (the imminent transition tick).
    expect(out.career.contracts[p.id]).toEqual({ salary: demand.salary, yearsLeft: demand.years + 1 });
    expect(demand.salary).toBeGreaterThan(1_000_000);
    // The prima de renovación was debited from the budget.
    expect(out.career.budget).toBeLessThan(c.budget);
    // The decision is recorded for the season-end summary + persistence.
    expect(out.career.renewals!.resolved[p.id]).toEqual({
      outcome: 'renewed',
      salary: demand.salary,
      years: demand.years,
    });
  });

  it('soft-fails when the prima is unaffordable', () => {
    const c = withExpiring(barca(), peakPlayer(barca()).id);
    const p = pendingRenewals(c)[0]!;
    expect(acceptRenewal({ ...c, budget: 0 }, p.playerId).status).toBe('presupuesto');
  });

  it('soft-fails for an unknown or non-expiring player', () => {
    const c = barca();
    expect(acceptRenewal(c, 'no-such-id').status).toBe('no-encontrado');
    // A player with a multi-season deal is not up for renewal.
    const multiYear = humanOf(c).players[0]!.id;
    expect(c.contracts[multiYear]!.yearsLeft).toBeGreaterThan(1);
    expect(acceptRenewal(c, multiYear).status).toBe('no-encontrado');
  });
});

describe('offerRenewal (counter-offer)', () => {
  it('accepts an offer at or above the threshold and rejects below it', () => {
    const c0 = barca();
    const p = peakPlayer(c0);
    const c = withExpiring(c0, p.id, 1_000_000);
    const demand = pendingRenewals(c).find((o) => o.playerId === p.id)!.demand;

    const low = offerRenewal(c, p.id, demand.minSalary - 1, 3);
    expect(low.status).toBe('rejected');
    if (low.status === 'rejected') expect(low.demand.minSalary).toBe(demand.minSalary);
    // A rejected offer leaves the negotiation OPEN (still pending).
    expect(pendingRenewals(c).map((o) => o.playerId)).toContain(p.id);

    const ok = offerRenewal(c, p.id, demand.minSalary, 3);
    expect(ok.status).toBe('renewed');
    if (ok.status === 'renewed') {
      expect(ok.career.contracts[p.id]).toEqual({ salary: demand.minSalary, yearsLeft: 4 });
    }
  });

  it('clamps the offered term to at most RENEWAL_MAX_YEARS', () => {
    const c0 = barca();
    const p = peakPlayer(c0);
    const c = withExpiring(c0, p.id, 1_000_000);
    const demand = pendingRenewals(c).find((o) => o.playerId === p.id)!.demand;
    const out = offerRenewal(c, p.id, demand.salary, 99);
    expect(out.status).toBe('renewed');
    if (out.status === 'renewed') expect(out.career.contracts[p.id]!.yearsLeft).toBe(RENEWAL_MAX_YEARS + 1);
  });
});

describe('Bosman: not renewing a final-year deal frees the player', () => {
  const ctx = { seed: 7, seasonNumber: 2, seasonStartYear: seasonStartYear('97/98') };

  it('letGoPlayer records the decision without touching budget or squad', () => {
    const c0 = barca();
    const p = peakPlayer(c0);
    const c = withExpiring(c0, p.id);
    const out = letGoPlayer(c, p.id);
    expect(out.status).toBe('released');
    if (out.status !== 'released') return;
    expect(out.career.budget).toBe(c.budget);
    expect(out.career.renewals!.resolved[p.id]).toEqual({ outcome: 'released' });
    expect(resolvedRenewals(out.career).map((r) => r.playerId)).toContain(p.id);
  });

  it('an un-renewed expiring deal ticks to 0 and the player leaves FREE', () => {
    const c0 = barca();
    const p = peakPlayer(c0);
    const c = letGoPlayer(withExpiring(c0, p.id), p.id);
    if (c.status !== 'released') throw new Error('expected released');
    const adv = advanceContracts(humanOf(c.career).players, c.career.contracts, ctx);
    expect(adv.released.some((r) => r.id === p.id)).toBe(true);
    expect(adv.contracts[p.id]).toBeUndefined();
  });

  it('a renewed deal survives the same tick with its new terms', () => {
    const c0 = barca();
    const p = peakPlayer(c0);
    const renewed = acceptRenewal(withExpiring(c0, p.id), p.id);
    if (renewed.status !== 'renewed') throw new Error('expected renewed');
    const adv = advanceContracts(humanOf(renewed.career).players, renewed.career.contracts, ctx);
    expect(adv.released.some((r) => r.id === p.id)).toBe(false);
    // years+1 stored → ticked down once → exactly the agreed term next season.
    expect(adv.contracts[p.id]).toEqual({ salary: renewed.salary, yearsLeft: renewed.years });
  });
});

describe('Bosman through a real season transition (96/97 -> 97/98)', () => {
  const next = loadPrimera9798();
  const nextBarcaIds = new Set(next.equipos.find((t) => t.id === HUMAN)!.jugadores.map((p) => p.id));

  /** A player Barça keep in the real 97/98 data (same id across seasons). */
  function stayingPlayer(c: CareerState): Player {
    const p = humanOf(c).players.find((pl) => nextBarcaIds.has(pl.id));
    if (!p) throw new Error('fixture: no Barça player persists 96/97 -> 97/98');
    return p;
  }

  it('frees an un-renewed player even though history would keep him', () => {
    const c0 = barca(2024);
    const staying = stayingPlayer(c0);
    const c = withExpiring(c0, staying.id);
    const after = applyTransition(c, next, new Set());
    expect(humanOf(after).players.some((p) => p.id === staying.id)).toBe(false);
    expect(after.contracts[staying.id]).toBeUndefined();
  });

  it('keeps a renewed player on his new deal, and resets the renewals book', () => {
    const c0 = barca(2024);
    const staying = stayingPlayer(c0);
    const renewed = acceptRenewal(withExpiring(c0, staying.id), staying.id);
    if (renewed.status !== 'renewed') throw new Error('expected renewed');
    const after = applyTransition(renewed.career, next, new Set());
    expect(humanOf(after).players.some((p) => p.id === staying.id)).toBe(true);
    expect(after.contracts[staying.id]).toEqual({ salary: renewed.salary, yearsLeft: renewed.years });
    // The transition settles the negotiations: the next season starts clean.
    expect(after.renewals).toEqual(DEFAULT_RENEWALS);
  });
});

describe('persistence round-trip', () => {
  const league = loadPrimera9697();

  it('round-trips this season renewal decisions (renew + let go) exactly', () => {
    const c0 = barca();
    const keep = peakPlayer(c0);
    const gone = humanOf(c0).players.find((p) => p.id !== keep.id)!;
    const renewedKeep = acceptRenewal(withExpiring(withExpiring(c0, keep.id), gone.id), keep.id);
    if (renewedKeep.status !== 'renewed') throw new Error('expected renewed');
    const released = letGoPlayer(renewedKeep.career, gone.id);
    if (released.status !== 'released') throw new Error('expected released');

    const save = serializeCareer(released.career);
    const restored = restoreCareer(save, league);
    expect(restored.renewals).toEqual(released.career.renewals);
    // The renewed contract (salario + años) survives the round-trip too.
    expect(restored.contracts[keep.id]).toEqual(released.career.contracts[keep.id]);
  });

  it('defaults renewals to empty for a legacy (pre-renovaciones) save', () => {
    const save = serializeCareer(barca());
    const legacy = { ...save };
    delete (legacy as { renewals?: unknown }).renewals;
    const restored = restoreCareer(legacy as typeof save, league);
    expect(restored.renewals).toEqual({ seasonNumber: 0, resolved: {} });
  });
});
