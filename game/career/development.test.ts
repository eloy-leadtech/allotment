import { describe, it, expect } from 'vitest';
import type { Attributes, Player } from '@data';
import {
  developPlayer,
  developSquad,
  playerAge,
  seasonStartYear,
  type DevelopmentContext,
} from './development';

const baseAttrs: Attributes = {
  calidad: 70,
  agresividad: 60,
  resistencia: 70,
  velocidad: 70,
  fisico: 65,
  remate: 60,
  ofensivo: 65,
  pase: 68,
  entrada: 62,
  porteria: 20,
};

function makePlayer(over: Partial<Player> & { birthYear: number }): Player {
  const { birthYear, ...rest } = over;
  return {
    id: rest.id ?? `p-${birthYear}`,
    nombre: rest.nombre ?? 'Test',
    nombreCompleto: rest.nombreCompleto ?? 'Test Player',
    posicion: rest.posicion ?? 'MED',
    esPortero: rest.esPortero ?? false,
    demarcaciones: rest.demarcaciones ?? [],
    atributos: rest.atributos ?? { ...baseAttrs },
    potencial: rest.potencial,
    media: rest.media ?? 70,
    dorsal: rest.dorsal ?? null,
    // Use an explicit `in` check so a caller can force fechaNacimiento to null.
    fechaNacimiento: 'fechaNacimiento' in rest ? (rest.fechaNacimiento ?? null) : `${birthYear}-06-15`,
    alturaCm: rest.alturaCm ?? 180,
    pesoKg: rest.pesoKg ?? 75,
    nacionalidad: rest.nacionalidad ?? null,
    clubAnterior: rest.clubAnterior ?? null,
  };
}

const ctx = (over: Partial<DevelopmentContext> = {}): DevelopmentContext => ({
  seed: 2024,
  seasonNumber: 1,
  seasonStartYear: 1997,
  ...over,
});

describe('seasonStartYear', () => {
  it('parses season labels with century inference', () => {
    expect(seasonStartYear('96/97')).toBe(1996);
    expect(seasonStartYear('99/00')).toBe(1999);
    expect(seasonStartYear('00/01')).toBe(2000);
  });
  it('throws on garbage', () => {
    expect(() => seasonStartYear('nope')).toThrow();
  });
});

describe('playerAge', () => {
  it('computes age from birth year and season start', () => {
    expect(playerAge(makePlayer({ birthYear: 1975 }), 1997)).toBe(22);
  });
  it('returns null when the birth date is unknown', () => {
    expect(playerAge(makePlayer({ birthYear: 1975, fechaNacimiento: null }), 1997)).toBeNull();
  });
});

describe('developPlayer', () => {
  it('is deterministic: same seed/season/player => identical result', () => {
    const p = makePlayer({ birthYear: 1975, id: 'det' });
    const a = developPlayer(p, ctx());
    const b = developPlayer(p, ctx());
    expect(a).toEqual(b);
  });

  it('does not mutate the input player', () => {
    const p = makePlayer({ birthYear: 1975 });
    const snapshot = JSON.parse(JSON.stringify(p));
    developPlayer(p, ctx());
    expect(p).toEqual(snapshot);
  });

  it('keeps all attributes and media within 1..99', () => {
    for (let year = 1958; year <= 1982; year += 1) {
      const p = makePlayer({ birthYear: year, id: `range-${year}` });
      const { player } = developPlayer(p, ctx());
      expect(player.media).toBeGreaterThanOrEqual(1);
      expect(player.media).toBeLessThanOrEqual(99);
      for (const v of Object.values(player.atributos)) {
        if (v === null) continue;
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(99);
      }
    }
  });

  it('young players trend upward on average', () => {
    let up = 0;
    const N = 40;
    for (let i = 0; i < N; i += 1) {
      const p = makePlayer({ birthYear: 1978, id: `young-${i}` }); // age 19
      const { player } = developPlayer(p, ctx({ seed: 1000 + i }));
      if (player.media >= p.media) up += 1;
    }
    expect(up).toBeGreaterThan(N * 0.7);
  });

  it('old players trend downward on average', () => {
    let down = 0;
    const N = 40;
    for (let i = 0; i < N; i += 1) {
      const p = makePlayer({ birthYear: 1964, id: `old-${i}` }); // age 33
      const { player, retired } = developPlayer(p, ctx({ seed: 5000 + i }));
      if (!retired && player.media <= p.media) down += 1;
    }
    expect(down).toBeGreaterThan(N * 0.5);
  });

  it('preserves the curated media baseline when the core barely moves (peak age)', () => {
    const p = makePlayer({ birthYear: 1972, id: 'peak', media: 88 }); // age 25, peak
    const { player } = developPlayer(p, ctx());
    // media moves by the core delta, so at peak it stays within a couple points.
    expect(Math.abs(player.media - 88)).toBeLessThanOrEqual(2);
  });

  it('never grows an attribute past a known potential ceiling', () => {
    const potencial: Attributes = { ...baseAttrs, pase: 72, remate: 63 };
    const p = makePlayer({ birthYear: 1979, id: 'capped', atributos: { ...baseAttrs }, potencial }); // age 18
    // Develop several seasons; capped attributes must never exceed the ceiling.
    let cur = p;
    for (let s = 1; s <= 6; s += 1) {
      cur = developPlayer(cur, ctx({ seasonNumber: s, seasonStartYear: 1996 + s })).player;
      expect(cur.atributos.pase).toBeLessThanOrEqual(72);
      expect(cur.atributos.remate).toBeLessThanOrEqual(63);
    }
  });

  it('eventually retires very old players', () => {
    let retiredCount = 0;
    const N = 30;
    for (let i = 0; i < N; i += 1) {
      const p = makePlayer({ birthYear: 1958, id: `veteran-${i}` }); // age 39
      if (developPlayer(p, ctx({ seed: 9000 + i })).retired) retiredCount += 1;
    }
    expect(retiredCount).toBeGreaterThan(N * 0.7);
  });

  it('goalkeepers retire later than outfielders at the same age', () => {
    const N = 60;
    let gkRetired = 0;
    let ofRetired = 0;
    for (let i = 0; i < N; i += 1) {
      const gk = makePlayer({ birthYear: 1958, id: `gk-${i}`, esPortero: true, posicion: 'POR' }); // age 39: GK plays on (<41)
      const of = makePlayer({ birthYear: 1958, id: `of-${i}`, esPortero: false }); // age 39: outfield retires (>=39)
      if (developPlayer(gk, ctx({ seed: 3000 + i })).retired) gkRetired += 1;
      if (developPlayer(of, ctx({ seed: 3000 + i })).retired) ofRetired += 1;
    }
    expect(gkRetired).toBeLessThan(ofRetired);
  });
});

describe('developSquad', () => {
  it('partitions survivors and retired, sorted by id, without duplicates', () => {
    const players = [
      makePlayer({ birthYear: 1978, id: 'zeta' }),
      makePlayer({ birthYear: 1958, id: 'alpha' }), // likely retires
      makePlayer({ birthYear: 1972, id: 'mid' }),
    ];
    const { players: survivors, retired } = developSquad(players, ctx());
    const allIds = [...survivors, ...retired].map((p) => p.id).sort();
    expect(allIds).toEqual(['alpha', 'mid', 'zeta']);
    // survivors sorted by id
    const surviveIds = survivors.map((p) => p.id);
    expect(surviveIds).toEqual([...surviveIds].sort());
  });

  it('is order-independent (per-player seeding)', () => {
    const players = [
      makePlayer({ birthYear: 1978, id: 'a' }),
      makePlayer({ birthYear: 1970, id: 'b' }),
      makePlayer({ birthYear: 1965, id: 'c' }),
    ];
    const forward = developSquad(players, ctx());
    const reversed = developSquad([...players].reverse(), ctx());
    expect(forward).toEqual(reversed);
  });
});
