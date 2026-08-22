import { describe, it, expect } from 'vitest';
import type { Attributes, Player } from '@data';
import {
  TRAINING_FOCI,
  DEFAULT_TRAINING_FOCUS,
  trainingAttributeDelta,
} from './training';
import { developPlayer, type DevelopmentContext } from './development';

const baseAttrs: Attributes = {
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
    media: rest.media ?? 60,
    dorsal: rest.dorsal ?? null,
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

describe('training foci table', () => {
  it('exposes the four foci with the default among them', () => {
    const foci = TRAINING_FOCI.map((f) => f.focus);
    expect(foci).toEqual(['ataque', 'defensa', 'fisico', 'equilibrado']);
    expect(foci).toContain(DEFAULT_TRAINING_FOCUS);
    // Every focus has a non-empty label and hint for the UI.
    for (const f of TRAINING_FOCI) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.hint.length).toBeGreaterThan(0);
    }
  });
});

describe('trainingAttributeDelta', () => {
  it('accelerates the focused attributes and neglects their opposites', () => {
    // Ataque trains up shooting, trades down defending.
    expect(trainingAttributeDelta('ataque', 'remate', 26)).toBeGreaterThan(0);
    expect(trainingAttributeDelta('ataque', 'entrada', 26)).toBeLessThan(0);
    // Defensa is the mirror.
    expect(trainingAttributeDelta('defensa', 'entrada', 26)).toBeGreaterThan(0);
    expect(trainingAttributeDelta('defensa', 'remate', 26)).toBeLessThan(0);
    // Físico trains athleticism at the cost of technique.
    expect(trainingAttributeDelta('fisico', 'resistencia', 26)).toBeGreaterThan(0);
    expect(trainingAttributeDelta('fisico', 'pase', 26)).toBeLessThan(0);
  });

  it('equilibrado is a mild, uniformly non-negative boost', () => {
    for (const key of Object.keys(baseAttrs) as (keyof Attributes)[]) {
      expect(trainingAttributeDelta('equilibrado', key, 26)).toBeGreaterThanOrEqual(0);
    }
    // ...and it is moderate: no single attribute is pushed hard.
    for (const key of Object.keys(baseAttrs) as (keyof Attributes)[]) {
      expect(trainingAttributeDelta('equilibrado', key, 26)).toBeLessThanOrEqual(0.5);
    }
  });

  it('amplifies POSITIVE gains for young players but never the neglect', () => {
    // A trained-up attribute gains more for a 19-year-old than a 26-year-old.
    const youngGain = trainingAttributeDelta('ataque', 'remate', 19);
    const primeGain = trainingAttributeDelta('ataque', 'remate', 26);
    expect(youngGain).toBeGreaterThan(primeGain);
    // The neglected attribute is identical regardless of age (no youth penalty).
    expect(trainingAttributeDelta('ataque', 'entrada', 19)).toBe(
      trainingAttributeDelta('ataque', 'entrada', 26),
    );
    // Unknown age falls back to the prime (non-amplified) value.
    expect(trainingAttributeDelta('ataque', 'remate', null)).toBe(primeGain);
  });
});

describe('training layered onto developPlayer', () => {
  it('is deterministic: same focus => identical evolution', () => {
    const p = makePlayer({ birthYear: 1975, id: 'det' });
    const a = developPlayer(p, ctx({ training: 'ataque' }));
    const b = developPlayer(p, ctx({ training: 'ataque' }));
    expect(a).toEqual(b);
  });

  it('changes the outcome versus no training (deterministically)', () => {
    const p = makePlayer({ birthYear: 1978, id: 'young' }); // age 19, still growing
    // Same seed => identical, reproducible outcome for a given focus.
    expect(developPlayer(p, ctx({ training: 'ataque' }))).toEqual(
      developPlayer(p, ctx({ training: 'ataque' })),
    );
    // Averaged over seeds, attacking training lifts shooting and dents tackling
    // relative to no focus (single seeds can tie after rounding/clamping).
    let remAtk = 0;
    let remNone = 0;
    let entAtk = 0;
    let entNone = 0;
    const N = 40;
    for (let i = 0; i < N; i += 1) {
      const none = developPlayer(p, ctx({ seed: 700 + i })).player;
      const atk = developPlayer(p, ctx({ seed: 700 + i, training: 'ataque' })).player;
      remAtk += atk.atributos.remate;
      remNone += none.atributos.remate;
      entAtk += atk.atributos.entrada ?? 0;
      entNone += none.atributos.entrada ?? 0;
    }
    expect(remAtk / N).toBeGreaterThan(remNone / N);
    expect(entAtk / N).toBeLessThan(entNone / N);
  });

  it('an attacking focus grows shooting more than a defensive one (on average)', () => {
    let atkSum = 0;
    let defSum = 0;
    const N = 40;
    for (let i = 0; i < N; i += 1) {
      const p = makePlayer({ birthYear: 1976, id: `avg-${i}` }); // age 21, developing
      atkSum += developPlayer(p, ctx({ seed: 100 + i, training: 'ataque' })).player.atributos.remate;
      defSum += developPlayer(p, ctx({ seed: 100 + i, training: 'defensa' })).player.atributos.remate;
    }
    expect(atkSum / N).toBeGreaterThan(defSum / N);
  });

  it('keeps the effect MODERATE: media does not run away from the untrained baseline', () => {
    let maxGap = 0;
    const N = 40;
    for (let i = 0; i < N; i += 1) {
      const p = makePlayer({ birthYear: 1977, id: `mod-${i}` }); // age 20
      const none = developPlayer(p, ctx({ seed: 500 + i })).player;
      const atk = developPlayer(p, ctx({ seed: 500 + i, training: 'ataque' })).player;
      maxGap = Math.max(maxGap, Math.abs(atk.media - none.media));
    }
    // One season of focus shifts media by only a couple of points — no crack factory.
    expect(maxGap).toBeLessThanOrEqual(3);
  });

  it('respects the potential ceiling even with a boosting focus', () => {
    const potencial: Attributes = { ...baseAttrs, remate: 63 };
    const p = makePlayer({ birthYear: 1979, id: 'capped', atributos: { ...baseAttrs }, potencial }); // age 18
    let cur = p;
    for (let s = 1; s <= 6; s += 1) {
      cur = developPlayer(cur, ctx({ seasonNumber: s, seasonStartYear: 1996 + s, training: 'ataque' })).player;
      expect(cur.atributos.remate).toBeLessThanOrEqual(63);
    }
  });

  it('does not affect the input player or unknown-age players', () => {
    const noAge = makePlayer({ birthYear: 1975, id: 'noage', fechaNacimiento: null });
    const res = developPlayer(noAge, ctx({ training: 'ataque' }));
    expect(res.age).toBeNull();
    expect(res.player).toEqual(noAge); // held steady, training is a no-op without age
  });
});
