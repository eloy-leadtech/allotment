import { describe, it, expect } from 'vitest';
import { loadPrimera9697, loadPrimera9798 } from '@data';
import { newCareer } from './career';
import {
  loanOutCandidates,
  loanOffers,
  loanOutPlayer,
  loanInPlayer,
  loanCommission,
  loanFee,
  careerLoans,
  DEFAULT_LOANS,
} from './loans';
import { applyTransition } from './transition';
import { wageBill } from './contracts';
import { serializeCareer, restoreCareer } from '../save/save';
import { advanceMatchday } from '../season/season';
import { playerAge, seasonStartYear } from './development';

const HUMAN = 'barcelona';
const league = loadPrimera9697();
const squadIds = (career: ReturnType<typeof newCareer>, id: string): string[] =>
  career.teams.find((t) => t.id === id)?.players.map((p) => p.id) ?? [];
const personKey = (p: { nombreCompleto: string; fechaNacimiento: string | null }): string =>
  `${p.nombreCompleto}|${p.fechaNacimiento ?? '?'}`;

describe('loan offers & candidates', () => {
  it('lists your squad as loan-out candidates, most valuable first, never loanees', () => {
    const career = newCareer(league, HUMAN, 7);
    const cands = loanOutCandidates(career);
    expect(cands.length).toBe(career.teams.find((t) => t.id === HUMAN)!.players.length);
    for (let i = 1; i < cands.length; i += 1) {
      expect(cands[i - 1]!.value).toBeGreaterThanOrEqual(cands[i]!.value);
    }
    expect(cands.every((c) => c.commission > 0)).toBe(true);
  });

  it('offers only eligible AI players (never your own, never a prime star), deterministically', () => {
    const career = newCareer(league, HUMAN, 7);
    const a = loanOffers(career);
    const b = loanOffers(career);
    expect(a).toEqual(b); // deterministic from the rosters, no RNG
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((o) => o.clubId !== HUMAN)).toBe(true);
    // No galáctico is offered on loan.
    expect(a.every((o) => o.player.media < 78)).toBe(true);
    // A loan fee is cheaper than an outright purchase (asking is ~130% of value).
    expect(a.every((o) => o.fee < o.value)).toBe(true);
    for (let i = 1; i < a.length; i += 1) {
      expect(a[i - 1]!.player.media).toBeGreaterThanOrEqual(a[i]!.player.media);
    }
  });
});

describe('loanOutPlayer (CEDER)', () => {
  it('removes the player from your XI, drops his wage, pays a commission and books the loan', () => {
    const career = newCareer(league, HUMAN, 7);
    const target = loanOutCandidates(career)[10]!; // a mid-value squad player
    const wagesBefore = wageBill(career.contracts);
    const commission = loanCommission(
      target.player,
      playerAge(target.player, seasonStartYear(career.temporada)),
    );

    const { career: after, ok } = loanOutPlayer(career, target.player.id);
    expect(ok).toBe(true);
    expect(squadIds(after, HUMAN)).not.toContain(target.player.id);
    // His deal left the active wage book (you save his ficha this season).
    expect(after.contracts[target.player.id]).toBeUndefined();
    expect(wageBill(after.contracts)).toBeLessThan(wagesBefore);
    expect(after.budget).toBe(career.budget + commission);
    // The loan is recorded for the return next season.
    expect(careerLoans(after).out).toHaveLength(1);
    expect(careerLoans(after).out[0]!.player.id).toBe(target.player.id);
    // The derived season no longer fields him.
    expect(after.season.teams.find((t) => t.id === HUMAN)!.players.some((p) => p.id === target.player.id)).toBe(false);
  });

  it('soft-fails on an unknown player and is closed once the season is under way', () => {
    const career = newCareer(league, HUMAN, 7);
    expect(loanOutPlayer(career, 'no-such').ok).toBe(false);
    const started = { ...career, season: advanceMatchday(career.season).state };
    expect(() => loanOutPlayer(started, loanOutCandidates(career)[0]!.player.id)).toThrow(/mercado/i);
  });
});

describe('loanInPlayer (INCORPORAR CEDIDO)', () => {
  it('signs an AI loanee: he joins you on a 1-year deal, the fee is paid and his club loses him', () => {
    const career = { ...newCareer(league, HUMAN, 7), budget: 5_000_000_000 };
    const offer = loanOffers(career)[0]!;
    const fee = loanFee(offer.player, playerAge(offer.player, seasonStartYear(career.temporada)));

    const { career: after, ok } = loanInPlayer(career, offer.player.id);
    expect(ok).toBe(true);
    expect(squadIds(after, HUMAN)).toContain(offer.player.id);
    expect(squadIds(after, offer.clubId)).not.toContain(offer.player.id);
    expect(after.budget).toBe(career.budget - fee);
    // Modelled as a 1-season deal so the transition drops him automatically.
    expect(after.contracts[offer.player.id]!.yearsLeft).toBe(1);
    expect(careerLoans(after).in).toContain(offer.player.id);
    // The derived season fields him for your club.
    expect(after.season.teams.find((t) => t.id === HUMAN)!.players.some((p) => p.id === offer.player.id)).toBe(true);
  });

  it('refuses when you cannot afford the fee', () => {
    const career = { ...newCareer(league, HUMAN, 7), budget: 0 };
    const offer = loanOffers(career)[0]!;
    const { ok, reason } = loanInPlayer(career, offer.player.id);
    expect(ok).toBe(false);
    expect(reason).toBe('presupuesto');
  });

  it('refuses an ineligible (non-offered) AI player', () => {
    const career = { ...newCareer(league, HUMAN, 7), budget: 5_000_000_000 };
    const offeredIds = new Set(loanOffers(career).map((o) => o.player.id));
    const notOffered = career.teams
      .find((t) => t.id !== HUMAN)!
      .players.find((p) => !offeredIds.has(p.id));
    if (!notOffered) return;
    expect(loanInPlayer(career, notOffered.id).ok).toBe(false);
  });
});

describe('loan settlement at the season transition', () => {
  const next = loadPrimera9798();

  it('a loaned-out player returns next season (and only to your club)', () => {
    const career = newCareer(league, HUMAN, 7);
    const target = loanOutCandidates(career)[10]!.player;
    const lent = loanOutPlayer(career, target.id).career;
    expect(squadIds(lent, HUMAN)).not.toContain(target.id);

    const advanced = applyTransition(lent, next, new Set());
    // He is back in your squad, aged, and nobody else has him.
    const barca = advanced.teams.find((t) => t.id === HUMAN)!;
    expect(barca.players.some((p) => personKey(p) === personKey(target))).toBe(true);
    const elsewhere = advanced.teams
      .filter((t) => t.id !== HUMAN)
      .some((t) => t.players.some((p) => personKey(p) === personKey(target)));
    expect(elsewhere).toBe(false);
    // His deal is restored on the wage book.
    const returnee = barca.players.find((p) => personKey(p) === personKey(target))!;
    expect(advanced.contracts[returnee.id]).toBeDefined();
    // The loan book is settled clean.
    expect(advanced.loans).toEqual(DEFAULT_LOANS);
  });

  it('a loaned-in player is gone next season (the loan ended)', () => {
    const career = { ...newCareer(league, HUMAN, 7), budget: 5_000_000_000 };
    const offer = loanOffers(career)[0]!;
    const signed = loanInPlayer(career, offer.player.id).career;
    expect(squadIds(signed, HUMAN)).toContain(offer.player.id);

    const advanced = applyTransition(signed, next, new Set());
    expect(squadIds(advanced, HUMAN)).not.toContain(offer.player.id);
    expect(advanced.loans).toEqual(DEFAULT_LOANS);
  });
});

describe('save round-trip', () => {
  it('persists the loan book (out & in) through a v2 save', () => {
    const career = { ...newCareer(league, HUMAN, 7), budget: 5_000_000_000 };
    const lentOut = loanOutPlayer(career, loanOutCandidates(career)[5]!.player.id).career;
    const withIn = loanInPlayer(lentOut, loanOffers(lentOut)[0]!.player.id).career;

    const restored = restoreCareer(serializeCareer(withIn), league);
    expect(careerLoans(restored).out.map((o) => o.player.id)).toEqual(
      careerLoans(withIn).out.map((o) => o.player.id),
    );
    expect(careerLoans(restored).in).toEqual(careerLoans(withIn).in);
    // A pre-cesiones save (no loans field) restores to an empty loan book.
    const legacy = serializeCareer(newCareer(league, HUMAN, 7)) as Record<string, unknown>;
    delete legacy.loans;
    expect(careerLoans(restoreCareer(legacy as never, league))).toEqual(DEFAULT_LOANS);
  });
});
