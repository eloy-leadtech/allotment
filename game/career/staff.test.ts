import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import type { Attributes, Player } from '@data';
import type { MatchResult } from '@engine';
import {
  DEFAULT_STAFF,
  STAFF_ROLES,
  staffOptions,
  staffSalary,
  staffHireCost,
  staffLevel,
  staffWageBill,
  hireStaff,
  fireStaff,
  physioTrainingFactor,
  medicalRecoveryFactor,
  scoutPrecisionLevel,
  assistantPerformanceBonus,
  type StaffState,
} from './staff';
import { newCareer, seasonFromCareer } from './career';
import { wageBill } from './contracts';
import { liquidateSeason } from './credit';
import { trainingAttributeDelta } from './training';
import { developPlayer, type DevelopmentContext } from './development';
import { applyMatchdayAvailability, recoveredMatchesOut } from './availability';
import { scoutEstimate, potentialOverall } from './scouting';

const league = loadPrimera9697();
const humanTeamId = league.equipos[0]!.id;
const rivalTeamId = league.equipos[1]!.id;

const baseAttrs: Attributes = {
  calidad: 70,
  agresividad: 60,
  resistencia: 70,
  velocidad: 70,
  fisico: 65,
  remate: 55,
  ofensivo: 60,
  pase: 65,
  entrada: 55,
  porteria: 20,
};

function makePlayer(over: Partial<Player> & { id: string }): Player {
  return {
    id: over.id,
    nombre: over.nombre ?? 'Test',
    nombreCompleto: over.nombreCompleto ?? 'Test Player',
    posicion: over.posicion ?? 'MED',
    esPortero: over.esPortero ?? false,
    demarcaciones: over.demarcaciones ?? [],
    atributos: over.atributos ?? { ...baseAttrs },
    potencial: over.potencial,
    media: over.media ?? 65,
    dorsal: over.dorsal ?? null,
    fechaNacimiento: 'fechaNacimiento' in over ? (over.fechaNacimiento ?? null) : '1978-06-15',
    alturaCm: over.alturaCm ?? 180,
    pesoKg: over.pesoKg ?? 75,
    nacionalidad: over.nacionalidad ?? null,
    clubAnterior: over.clubAnterior ?? null,
  };
}

describe('staff: costs and wage bill', () => {
  it('salary scales linearly with level; hire fee is half the salary', () => {
    for (const role of STAFF_ROLES) {
      expect(staffSalary(role.role, 2)).toBe(staffSalary(role.role, 1) * 2);
      expect(staffHireCost(role.role, 3)).toBe(Math.round(staffSalary(role.role, 3) * 0.5));
    }
  });

  it('staffWageBill sums only the hired roles (empty = 0)', () => {
    expect(staffWageBill(DEFAULT_STAFF)).toBe(0);
    const staff: StaffState = { medico: { level: 3 }, ojeador: { level: 2 } };
    expect(staffWageBill(staff)).toBe(staffSalary('medico', 3) + staffSalary('ojeador', 2));
  });

  it('staffOptions offers the full 1-5 ladder, cheapest first', () => {
    const opts = staffOptions('segundo');
    expect(opts.map((o) => o.level)).toEqual([1, 2, 3, 4, 5]);
    expect(opts[0]!.salary).toBeLessThan(opts[4]!.salary);
  });
});

describe('staff: hire / fire adjust the budget (finances)', () => {
  it('hiring deducts the up-front fee and sets the level', () => {
    const career = newCareer(league, humanTeamId, 2024);
    const before = career.budget;
    const res = hireStaff(career, 'preparador', 4);
    expect(res.ok).toBe(true);
    expect(res.career.budget).toBe(before - staffHireCost('preparador', 4));
    expect(staffLevel(res.career.staff, 'preparador')).toBe(4);
  });

  it('soft-fails when the budget cannot cover the fee, leaving the career untouched', () => {
    const career = { ...newCareer(league, humanTeamId, 2024), budget: 1000 };
    const res = hireStaff(career, 'medico', 5);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('presupuesto');
    expect(res.career).toBe(career);
  });

  it('rejects an out-of-range level', () => {
    const career = newCareer(league, humanTeamId, 2024);
    expect(hireStaff(career, 'ojeador', 0).reason).toBe('nivel');
    expect(hireStaff(career, 'ojeador', 6).reason).toBe('nivel');
  });

  it('firing removes the role, dropping it from the wage bill', () => {
    const career = hireStaff(newCareer(league, humanTeamId, 2024), 'segundo', 3).career;
    expect(staffWageBill(career.staff)).toBe(staffSalary('segundo', 3));
    const fired = fireStaff(career, 'segundo');
    expect(staffLevel(fired.staff, 'segundo')).toBe(0);
    expect(staffWageBill(fired.staff)).toBe(0);
  });

  it('the staff salary is charged at the season liquidation (lower budget)', () => {
    const contracts = { a: { salary: 1_000_000, yearsLeft: 2 } };
    const staff: StaffState = { segundo: { level: 4 }, medico: { level: 3 } };
    const common = { budget: 5_000_000, loan: 0, income: 3_000_000, creditLimit: 10_000_000, seasonsOverLimit: 0 };
    const withoutStaff = liquidateSeason({ ...common, wages: wageBill(contracts) });
    const withStaff = liquidateSeason({ ...common, wages: wageBill(contracts) + staffWageBill(staff) });
    expect(staffWageBill(staff)).toBeGreaterThan(0);
    expect(withStaff.budget).toBe(withoutStaff.budget - staffWageBill(staff));
  });
});

describe('preparador físico -> training gains', () => {
  const ctx = (over: Partial<DevelopmentContext> = {}): DevelopmentContext => ({
    seed: 2024,
    seasonNumber: 1,
    seasonStartYear: 2000,
    ...over,
  });

  it('physioTrainingFactor grows with the preparador level (1 = none)', () => {
    expect(physioTrainingFactor(DEFAULT_STAFF)).toBe(1);
    expect(physioTrainingFactor({ preparador: { level: 5 } })).toBeGreaterThan(1);
  });

  it('a preparador amplifies a POSITIVE training delta (measurable)', () => {
    const plain = trainingAttributeDelta('ataque', 'remate', 20, 1);
    const boosted = trainingAttributeDelta('ataque', 'remate', 20, physioTrainingFactor({ preparador: { level: 5 } }));
    expect(plain).toBeGreaterThan(0);
    expect(boosted).toBeGreaterThan(plain);
  });

  it('never worsens a NEGLECTED (negative) attribute', () => {
    // 'ataque' neglects entrada (negative). The factor must not amplify the loss.
    const plain = trainingAttributeDelta('ataque', 'entrada', 20, 1);
    const boosted = trainingAttributeDelta('ataque', 'entrada', 20, 5);
    expect(plain).toBeLessThan(0);
    expect(boosted).toBe(plain);
  });

  it('a developed young player ends at least as strong with a preparador', () => {
    const young = makePlayer({ id: 'y1', posicion: 'DEL', media: 60, fechaNacimiento: '1981-06-15' });
    const plain = developPlayer(young, ctx({ training: 'ataque' }));
    const withPhysio = developPlayer(young, ctx({ training: 'ataque', physioFactor: physioTrainingFactor({ preparador: { level: 5 } }) }));
    expect(withPhysio.player.atributos.remate!).toBeGreaterThanOrEqual(plain.player.atributos.remate!);
    expect(withPhysio.player.media).toBeGreaterThanOrEqual(plain.player.media);
  });
});

describe('médico -> injury recovery', () => {
  it('medicalRecoveryFactor shrinks with the médico level (1 = none)', () => {
    expect(medicalRecoveryFactor(DEFAULT_STAFF)).toBe(1);
    expect(medicalRecoveryFactor({ medico: { level: 5 } })).toBeLessThan(1);
    expect(medicalRecoveryFactor({ medico: { level: 5 } })).toBeGreaterThan(0);
  });

  it('recoveredMatchesOut shortens the layoff but never below one matchday', () => {
    expect(recoveredMatchesOut(6, 0.5)).toBe(3);
    expect(recoveredMatchesOut(1, 0.5)).toBe(1);
    expect(recoveredMatchesOut(8, 1)).toBe(8);
  });

  it('a médico gets HUMAN players back sooner; rivals heal at the normal rate', () => {
    const injuryEvent = (playerId: string) => ({
      min: 10,
      type: 'injury' as const,
      team: 'home' as const,
      playerId,
      playerName: playerId,
      matchesOut: 6,
    });
    const results: MatchResult[] = [
      { homeId: 'H', awayId: 'A', homeGoals: 0, awayGoals: 0, events: [injuryEvent('mine'), injuryEvent('rival')] },
    ];
    const medical = { playerIds: new Set(['mine']), factor: medicalRecoveryFactor({ medico: { level: 5 } }) };

    const withMedic = applyMatchdayAvailability({}, results, 5, medical);
    const withoutMedic = applyMatchdayAvailability({}, results, 5);

    // Mine returns sooner with a médico (6 -> 3 matches out => md 8 vs md 11).
    expect(withMedic.mine!.injuredUntil).toBeLessThan(withoutMedic.mine!.injuredUntil!);
    expect(withMedic.mine!.injuredUntil).toBe(5 + recoveredMatchesOut(6, medical.factor));
    // The rival is untouched by our médico.
    expect(withMedic.rival!.injuredUntil).toBe(withoutMedic.rival!.injuredUntil);
  });
});

describe('ojeador -> scouting precision', () => {
  it('a hired ojeador narrows the band and reduces the error', () => {
    const player = makePlayer({ id: 's1', posicion: 'MED', media: 72 });
    const potencial: Attributes = { ...baseAttrs, pase: 80, ofensivo: 78, entrada: 70, remate: 74, velocidad: 72 };
    const truth = potentialOverall(potencial, 'MED');

    const noScout = scoutEstimate(player, potencial, 0, 2024, 0);
    const eliteScout = scoutEstimate(player, potencial, 0, 2024, 5);

    const width = (r: { low: number; high: number }) => r.high - r.low;
    const error = (r: { low: number; high: number }) => Math.abs((r.low + r.high) / 2 - truth);

    expect(scoutPrecisionLevel({ ojeador: { level: 5 } })).toBe(5);
    expect(width(eliteScout)).toBeLessThan(width(noScout));
    expect(error(eliteScout)).toBeLessThanOrEqual(error(noScout));
  });
});

describe('segundo entrenador -> match performance', () => {
  it('assistantPerformanceBonus scales with the segundo level (0 = none)', () => {
    expect(assistantPerformanceBonus(DEFAULT_STAFF)).toBe(0);
    expect(assistantPerformanceBonus({ segundo: { level: 5 } })).toBeGreaterThan(0);
  });

  it('lifts the HUMAN squad media in the derived season; rivals unchanged', () => {
    const career = newCareer(league, humanTeamId, 2024);
    const base = seasonFromCareer(career);
    const boosted = seasonFromCareer({ ...career, staff: { segundo: { level: 5 } } });

    const media = (s: typeof base, teamId: string) =>
      s.teams.find((t) => t.id === teamId)!.players.reduce((sum, p) => sum + p.media, 0);

    expect(media(boosted, humanTeamId)).toBeGreaterThan(media(base, humanTeamId));
    expect(media(boosted, rivalTeamId)).toBe(media(base, rivalTeamId));
  });

  it('a médico attaches a recovery effect to the derived season (none without one)', () => {
    const career = newCareer(league, humanTeamId, 2024);
    expect(seasonFromCareer(career).medical).toBeUndefined();
    const withMedic = seasonFromCareer({ ...career, staff: { medico: { level: 4 } } });
    expect(withMedic.medical?.factor).toBeLessThan(1);
    expect(withMedic.medical?.playerIds.size).toBeGreaterThan(0);
  });
});
