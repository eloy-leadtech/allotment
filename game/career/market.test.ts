import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import type { Attributes, Player } from '@data';
import { marketValue, squadValue, initialBudget, formatEuros } from './market';
import { newCareer } from './career';

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

describe('marketValue', () => {
  it('rises steeply with rating (a superstar dwarfs a starter)', () => {
    const star = marketValue(makePlayer({ media: 92 }), 25);
    const starter = marketValue(makePlayer({ media: 72 }), 25);
    const squad = marketValue(makePlayer({ media: 55 }), 25);
    expect(star).toBeGreaterThan(starter * 3);
    expect(starter).toBeGreaterThan(squad);
  });

  it('peaks in the mid-20s and falls for veterans', () => {
    const p = makePlayer({ media: 85 });
    const peak = marketValue(p, 25);
    const veteran = marketValue(p, 34);
    const kid = marketValue(p, 18);
    expect(peak).toBeGreaterThan(veteran);
    expect(peak).toBeGreaterThan(kid);
    expect(veteran).toBeLessThan(kid); // a 34yo is worth less than an 18yo of equal rating
  });

  it('never goes below the floor and is a whole number', () => {
    const v = marketValue(makePlayer({ media: 30 }), 36);
    expect(v).toBeGreaterThanOrEqual(50_000);
    expect(Number.isInteger(v)).toBe(true);
  });

  it('is deterministic', () => {
    const p = makePlayer({ media: 80, id: 'det' });
    expect(marketValue(p, 24)).toBe(marketValue(p, 24));
  });
});

describe('squadValue / initialBudget', () => {
  const league = loadPrimera9697();
  const barca = league.equipos.find((t) => t.id === 'barcelona');
  const racing = league.equipos.find((t) => t.id === 'racing');
  if (!barca || !racing) throw new Error('teams missing');
  const toCareerTeam = (t: typeof barca) => ({ id: t.id, nombre: t.nombre, players: t.jugadores });

  it('a stronger squad is worth more and gets a bigger budget', () => {
    const barcaValue = squadValue(toCareerTeam(barca), 1996);
    const racingValue = squadValue(toCareerTeam(racing), 1996);
    expect(barcaValue).toBeGreaterThan(racingValue);
    expect(initialBudget(toCareerTeam(barca), 1996)).toBeGreaterThan(
      initialBudget(toCareerTeam(racing), 1996),
    );
  });

  it('newCareer seeds a positive budget for the human club', () => {
    const career = newCareer(league, 'barcelona', 2024);
    expect(career.budget).toBeGreaterThan(0);
    expect(Number.isInteger(career.budget)).toBe(true);
  });
});

describe('formatEuros', () => {
  it('formats millions, thousands and units in Spanish style', () => {
    expect(formatEuros(40_500_000)).toBe('40,5 M€');
    expect(formatEuros(120_000_000)).toBe('120 M€');
    expect(formatEuros(850_000)).toBe('850 k€');
    expect(formatEuros(500)).toBe('500 €');
  });
});
