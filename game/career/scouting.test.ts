import { describe, it, expect } from 'vitest';
import type { Attributes, Player, Position } from '@data';
import { synthesizePotential, potentialOverall, scoutEstimate } from './scouting';

const baseAttrs: Attributes = {
  calidad: 50,
  agresividad: 50,
  resistencia: 50,
  velocidad: 50,
  fisico: 50,
  remate: 50,
  ofensivo: 50,
  pase: 50,
  entrada: 50,
  porteria: 50,
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
    media: over.media ?? 60,
    dorsal: over.dorsal ?? null,
    fechaNacimiento: 'fechaNacimiento' in over ? (over.fechaNacimiento ?? null) : '1978-06-15',
    alturaCm: over.alturaCm ?? 180,
    pesoKg: over.pesoKg ?? 75,
    nacionalidad: over.nacionalidad ?? null,
    clubAnterior: over.clubAnterior ?? null,
  };
}

/** Deterministic-ish spread of attribute values for stress loops. */
function attrsFor(i: number): Attributes {
  const v = (offset: number): number => ((i * 7 + offset * 13) % 90) + 5; // 5..94
  return {
    calidad: v(0),
    agresividad: v(1),
    resistencia: v(2),
    velocidad: v(3),
    fisico: v(4),
    remate: v(5),
    ofensivo: v(6),
    pase: v(7),
    entrada: v(8),
    porteria: v(9),
  };
}

const POSITIONS: readonly Position[] = ['POR', 'DEF', 'MED', 'DEL'];

describe('synthesizePotential', () => {
  it('is deterministic for the same player and seed', () => {
    const p = makePlayer({ id: 'det' });
    expect(synthesizePotential(p, 2024)).toEqual(synthesizePotential(p, 2024));
  });

  it('yields a ceiling >= current and within 0..99 for every attribute', () => {
    for (let i = 0; i < 60; i += 1) {
      const pos = POSITIONS[i % POSITIONS.length] ?? 'MED';
      const p = makePlayer({ id: `ceil-${i}`, posicion: pos, atributos: attrsFor(i), media: (i % 90) + 5 });
      const pot = synthesizePotential(p, 1000 + i);
      for (const key of Object.keys(pot) as (keyof Attributes)[]) {
        const ceil = pot[key];
        const cur = p.atributos[key];
        if (cur === null) {
          expect(ceil).toBeNull();
          continue;
        }
        expect(ceil).not.toBeNull();
        const c = ceil ?? 0;
        expect(c).toBeGreaterThanOrEqual(cur);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(99);
      }
    }
  });

  it('keeps calidad null in the potential when the current calidad is null', () => {
    const p = makePlayer({ id: 'nocal', atributos: { ...baseAttrs, calidad: null } });
    expect(synthesizePotential(p, 7).calidad).toBeNull();
  });

  it('gives more margin on average to high media/calidad players', () => {
    // Moderate attributes so the 99 clamp does not distort the comparison.
    const flat = { ...baseAttrs, calidad: 45 };
    let highSum = 0;
    let lowSum = 0;
    const N = 40;
    for (let i = 0; i < N; i += 1) {
      const high = makePlayer({ id: `hi-${i}`, atributos: { ...flat, calidad: 90 }, media: 90 });
      const low = makePlayer({ id: `lo-${i}`, atributos: { ...flat, calidad: 30 }, media: 30 });
      const hp = synthesizePotential(high, 500 + i);
      const lp = synthesizePotential(low, 500 + i);
      for (const key of Object.keys(baseAttrs) as (keyof Attributes)[]) {
        const cur = flat[key];
        if (cur === null) continue;
        highSum += (hp[key] ?? 0) - cur;
        lowSum += (lp[key] ?? 0) - cur;
      }
    }
    expect(highSum).toBeGreaterThan(lowSum);
  });

  it('does not mutate the input player', () => {
    const p = makePlayer({ id: 'immut', atributos: attrsFor(3) });
    const snap = JSON.parse(JSON.stringify(p));
    synthesizePotential(p, 42);
    expect(p).toEqual(snap);
  });
});

describe('potentialOverall', () => {
  it('is deterministic and within [0,99]', () => {
    for (let i = 0; i < 40; i += 1) {
      const pos = POSITIONS[i % POSITIONS.length] ?? 'MED';
      const a = attrsFor(i);
      const o1 = potentialOverall(a, pos);
      const o2 = potentialOverall(a, pos);
      expect(o1).toBe(o2);
      expect(o1).toBeGreaterThanOrEqual(0);
      expect(o1).toBeLessThanOrEqual(99);
    }
  });

  it('rises when a position-key attribute rises', () => {
    const cases: Record<Position, keyof Attributes> = {
      POR: 'porteria',
      DEF: 'entrada',
      MED: 'pase',
      DEL: 'remate',
    };
    for (const pos of POSITIONS) {
      const key = cases[pos];
      const lo: Attributes = { ...baseAttrs, [key]: 40 };
      const hi: Attributes = { ...baseAttrs, [key]: 80 };
      expect(potentialOverall(hi, pos)).toBeGreaterThan(potentialOverall(lo, pos));
    }
  });
});

describe('scoutEstimate', () => {
  it('is deterministic for the same inputs', () => {
    const p = makePlayer({ id: 'sdet' });
    const pot = synthesizePotential(p, 1);
    expect(scoutEstimate(p, pot, 2, 9)).toEqual(scoutEstimate(p, pot, 2, 9));
  });

  it('returns low <= high within [0,99]', () => {
    for (let i = 0; i < 60; i += 1) {
      const pos = POSITIONS[i % POSITIONS.length] ?? 'MED';
      const p = makePlayer({ id: `sr-${i}`, posicion: pos, atributos: attrsFor(i) });
      const pot = synthesizePotential(p, 100 + i);
      for (let obs = 0; obs <= 5; obs += 1) {
        const { low, high } = scoutEstimate(p, pot, obs, 200 + i);
        expect(low).toBeLessThanOrEqual(high);
        expect(low).toBeGreaterThanOrEqual(0);
        expect(high).toBeLessThanOrEqual(99);
      }
    }
  });

  it('narrows the range on average as observed seasons increase', () => {
    let wide = 0;
    let narrow = 0;
    const N = 40;
    for (let i = 0; i < N; i += 1) {
      const pos = POSITIONS[i % POSITIONS.length] ?? 'MED';
      // Moderate potentials keep ranges off the 0/99 boundaries.
      const pot: Attributes = { ...baseAttrs, calidad: 55 };
      const p = makePlayer({ id: `w-${i}`, posicion: pos });
      const r0 = scoutEstimate(p, pot, 0, 3000 + i);
      const r5 = scoutEstimate(p, pot, 5, 3000 + i);
      wide += r0.high - r0.low;
      narrow += r5.high - r5.low;
    }
    expect(narrow).toBeLessThan(wide);
  });

  it('can produce a range that does NOT contain the true potential overall (fallible)', () => {
    let found = false;
    outer: for (let seed = 0; seed < 50 && !found; seed += 1) {
      for (let i = 0; i < 20; i += 1) {
        const pos = POSITIONS[i % POSITIONS.length] ?? 'MED';
        const p = makePlayer({ id: `f-${seed}-${i}`, posicion: pos, atributos: attrsFor(i) });
        const pot = synthesizePotential(p, seed * 31 + i);
        const truth = potentialOverall(pot, pos);
        for (let obs = 0; obs <= 5; obs += 1) {
          const { low, high } = scoutEstimate(p, pot, obs, seed);
          if (truth < low || truth > high) {
            found = true;
            break outer;
          }
        }
      }
    }
    expect(found).toBe(true);
  });

  it('does not mutate its inputs', () => {
    const p = makePlayer({ id: 'simmut', atributos: attrsFor(2) });
    const pot = synthesizePotential(p, 5);
    const pSnap = JSON.parse(JSON.stringify(p));
    const potSnap = JSON.parse(JSON.stringify(pot));
    scoutEstimate(p, pot, 3, 77);
    expect(p).toEqual(pSnap);
    expect(pot).toEqual(potSnap);
  });
});
