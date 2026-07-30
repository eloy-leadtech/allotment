import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import type { Attributes, Player } from '@data';
import {
  marketValue,
  squadValue,
  initialBudget,
  formatEuros,
  buyableListings,
  buyPlayer,
  negotiateBuy,
  acceptCounter,
  releaseClause,
  askingPrice,
  sellPlayer,
  acceptBid,
  generateBids,
} from './market';
import { newCareer } from './career';
import { advanceMatchday } from '../season/season';

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

describe('market transactions', () => {
  const league = loadPrimera9697();
  const HUMAN = 'barcelona';
  const squadOf = (career: ReturnType<typeof newCareer>, id: string) =>
    career.teams.find((t) => t.id === id)?.players.map((p) => p.id) ?? [];

  it('lists buyable AI players (not your own), most valuable first', () => {
    const career = newCareer(league, HUMAN, 7);
    const listings = buyableListings(career);
    expect(listings.length).toBeGreaterThan(0);
    expect(listings.every((l) => l.clubId !== HUMAN)).toBe(true);
    for (let i = 1; i < listings.length; i += 1) {
      expect(listings[i - 1]!.value).toBeGreaterThanOrEqual(listings[i]!.value);
    }
    expect(listings[0]!.askingPrice).toBeGreaterThan(listings[0]!.value);
  });

  it('buys an affordable player: they join you, budget drops, seller loses them', () => {
    const career = newCareer(league, HUMAN, 7);
    const cheapest = buyableListings(career).at(-1)!;
    expect(career.budget).toBeGreaterThanOrEqual(cheapest.askingPrice);

    const { career: after, ok } = buyPlayer(career, cheapest.player.id);
    expect(ok).toBe(true);
    expect(after.budget).toBe(career.budget - cheapest.askingPrice);
    expect(squadOf(after, HUMAN)).toContain(cheapest.player.id);
    expect(squadOf(after, cheapest.clubId)).not.toContain(cheapest.player.id);
    // The derived season reflects the new roster.
    const barcaMatch = after.season.teams.find((t) => t.id === HUMAN);
    expect(barcaMatch?.players.some((p) => p.id === cheapest.player.id)).toBe(true);
  });

  it('refuses a purchase you cannot afford, leaving the career untouched', () => {
    const career = { ...newCareer(league, HUMAN, 7), budget: 0 };
    const target = buyableListings(career)[0]!;
    const { career: after, ok, reason } = buyPlayer(career, target.player.id);
    expect(ok).toBe(false);
    expect(reason).toBe('presupuesto');
    expect(after).toBe(career);
  });

  it('soft-fails on an unknown player id', () => {
    const career = newCareer(league, HUMAN, 7);
    const { ok, reason } = buyPlayer(career, 'no-such-player');
    expect(ok).toBe(false);
    expect(reason).toBe('no-encontrado');
  });

  describe('negotiateBuy', () => {
    const richCareer = () => ({ ...newCareer(league, HUMAN, 7), budget: 5_000_000_000 });

    it('accepts an offer at or above the asking price', () => {
      const career = richCareer();
      const target = buyableListings(career)[0]!;
      const outcome = negotiateBuy(career, target.player.id, target.askingPrice);
      expect(outcome.status).toBe('accepted');
      if (outcome.status === 'accepted') {
        expect(outcome.price).toBe(target.askingPrice);
        expect(squadOf(outcome.career, HUMAN)).toContain(target.player.id);
        expect(outcome.career.budget).toBe(career.budget - target.askingPrice);
      }
    });

    it('caps the price at the release clause even if you offer more', () => {
      const career = richCareer();
      const target = buyableListings(career)[0]!;
      const outcome = negotiateBuy(career, target.player.id, target.clause + 10_000_000);
      expect(outcome.status).toBe('accepted');
      if (outcome.status === 'accepted') expect(outcome.price).toBe(target.clause);
    });

    it('counters a slightly-low offer at the midpoint with the asking price', () => {
      const career = richCareer();
      const target = buyableListings(career)[0]!;
      const low = Math.round(target.askingPrice * 0.9); // within the 85% floor
      const outcome = negotiateBuy(career, target.player.id, low);
      expect(outcome.status).toBe('countered');
      if (outcome.status === 'countered') {
        expect(outcome.counter).toBe(Math.round((low + target.askingPrice) / 2));
        expect(outcome.counter).toBeLessThan(target.askingPrice);
        expect(outcome.counter).toBeGreaterThan(low);
      }
    });

    it('rejects an offer far below the asking price', () => {
      const career = richCareer();
      const target = buyableListings(career)[0]!;
      const outcome = negotiateBuy(career, target.player.id, Math.round(target.askingPrice * 0.5));
      expect(outcome.status).toBe('rejected');
    });

    it('reports no-budget when an accepted price exceeds the budget', () => {
      const career = { ...newCareer(league, HUMAN, 7), budget: 1 };
      const target = buyableListings(career)[0]!;
      const outcome = negotiateBuy(career, target.player.id, target.askingPrice);
      expect(outcome.status).toBe('no-budget');
    });

    it('acceptCounter closes the deal at the countered price', () => {
      const career = richCareer();
      const target = buyableListings(career)[0]!;
      const low = Math.round(target.askingPrice * 0.9);
      const counter = Math.round((low + target.askingPrice) / 2);
      const { career: after, ok } = acceptCounter(career, target.player.id, counter);
      expect(ok).toBe(true);
      expect(after.budget).toBe(career.budget - counter);
      expect(squadOf(after, HUMAN)).toContain(target.player.id);
    });

    it('acceptCounter rejects a price outside the negotiable band', () => {
      const career = richCareer();
      const target = buyableListings(career)[0]!;
      // Far below the floor is not a legitimate counter.
      const { ok } = acceptCounter(career, target.player.id, Math.round(target.askingPrice * 0.5));
      expect(ok).toBe(false);
    });

    it('the release clause exceeds the asking price', () => {
      const career = newCareer(league, HUMAN, 7);
      const someone = career.teams.find((t) => t.id !== HUMAN)!.players[0]!;
      expect(releaseClause(someone, 25)).toBeGreaterThan(askingPrice(someone, 25));
    });
  });

  it('sells one of your players to another club for the agreed amount', () => {
    const career = newCareer(league, HUMAN, 7);
    const mine = career.teams.find((t) => t.id === HUMAN)!.players[0]!;
    const { career: after, ok } = sellPlayer(career, mine.id, 'real-madrid', 1_000_000);
    expect(ok).toBe(true);
    expect(after.budget).toBe(career.budget + 1_000_000);
    expect(squadOf(after, HUMAN)).not.toContain(mine.id);
    expect(squadOf(after, 'real-madrid')).toContain(mine.id);
  });

  it('generates deterministic AI bids for your players', () => {
    const career = newCareer(league, HUMAN, 7);
    const a = generateBids(career);
    const b = generateBids(career);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    const myIds = new Set(squadOf(career, HUMAN));
    for (const bid of a) {
      expect(myIds.has(bid.playerId)).toBe(true);
      expect(bid.fromClubId).not.toBe(HUMAN);
      expect(bid.amount).toBeGreaterThan(0);
    }
  });

  it('accepting a bid sells the player and adds the money', () => {
    const career = newCareer(league, HUMAN, 7);
    const bid = generateBids(career)[0]!;
    const { career: after, ok } = acceptBid(career, bid);
    expect(ok).toBe(true);
    expect(after.budget).toBe(career.budget + bid.amount);
    expect(squadOf(after, HUMAN)).not.toContain(bid.playerId);
    expect(squadOf(after, bid.fromClubId)).toContain(bid.playerId);
  });

  it('is closed once the season is under way', () => {
    const career = newCareer(league, HUMAN, 7);
    const started = { ...career, season: advanceMatchday(career.season).state };
    const target = buyableListings(career)[0]!;
    expect(() => buyPlayer(started, target.player.id)).toThrow(/mercado/i);
  });
});
