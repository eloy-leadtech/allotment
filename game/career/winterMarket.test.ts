import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import { newCareer } from './career';
import { advanceMatchday, isSeasonOver } from '../season/season';
import { serializeCareer, restoreCareer } from '../save/save';
import { winterWindowMatchday } from './winterMovements';
import { buyableListings } from './market';
import {
  isWinterWindowOpen,
  winterBuyableListings,
  winterBuyPlayer,
  winterSellPlayer,
  winterNegotiateBuy,
  winterAcceptCounter,
  winterAcceptBid,
  generateWinterBids,
  closeWinterWindow,
} from './winterMarket';
import type { CareerState } from './types';

const league = loadPrimera9697();
const HUMAN = 'barcelona';

/** Advance a career's derived season up to (not playing) `targetMatchday`. */
function playTo(career: CareerState, targetMatchday: number): CareerState {
  let c = career;
  while (c.season.currentMatchday < targetMatchday && !isSeasonOver(c.season)) {
    c = { ...c, season: advanceMatchday(c.season).state };
  }
  return c;
}

/** Player ids on a club's CURRENT (career-level) roster. */
const rosterIds = (career: CareerState, teamId: string): string[] =>
  career.teams.find((t) => t.id === teamId)?.players.map((p) => p.id) ?? [];

/** Player ids on a club's in-progress SEASON (derived) roster. */
const seasonRosterIds = (career: CareerState, teamId: string): string[] =>
  career.season.teams.find((t) => t.id === teamId)?.players.map((p) => p.id) ?? [];

/** A rich career sitting at the winter window (plenty of budget to spend). */
function careerAtWindow(seed = 7): { career: CareerState; windowMatchday: number } {
  const base = { ...newCareer(league, HUMAN, seed), budget: 5_000_000_000 };
  const windowMatchday = winterWindowMatchday(base.season.totalMatchdays);
  return { career: playTo(base, windowMatchday), windowMatchday };
}

describe('winter window opening', () => {
  it('opens exactly at the season midpoint, not before', () => {
    const { career, windowMatchday } = careerAtWindow();
    expect(windowMatchday).toBe(Math.floor(career.season.totalMatchdays / 2) + 1);
    // The freshly-derived career (matchday 1) is not in the window yet.
    expect(isWinterWindowOpen({ ...newCareer(league, HUMAN, 7) })).toBe(false);
    // One matchday before the window it is still closed.
    const before = playTo({ ...newCareer(league, HUMAN, 7) }, windowMatchday - 1);
    expect(before.season.currentMatchday).toBe(windowMatchday - 1);
    expect(isWinterWindowOpen(before)).toBe(false);
    // At the window it is open.
    expect(career.season.currentMatchday).toBe(windowMatchday);
    expect(isWinterWindowOpen(career)).toBe(true);
  });

  it('is closed again once the human closes it', () => {
    const { career } = careerAtWindow();
    expect(isWinterWindowOpen(career)).toBe(true);
    const closed = closeWinterWindow(career);
    expect(closed.winter?.closed).toBe(true);
    expect(isWinterWindowOpen(closed)).toBe(false);
  });

  it('the transactional entry points throw when the window is not open', () => {
    const fresh = newCareer(league, HUMAN, 7);
    const target = buyableListings(fresh)[0]!;
    expect(() => winterBuyPlayer(fresh, target.player.id)).toThrow(/invierno/i);
    expect(() => winterSellPlayer(fresh, rosterIds(fresh, HUMAN)[0]!, 'real-madrid', 1)).toThrow(
      /invierno/i,
    );
  });

  it('lists the same AI buy pool as the pre-season market', () => {
    const { career } = careerAtWindow();
    expect(winterBuyableListings(career).map((l) => l.player.id)).toEqual(
      buyableListings(career).map((l) => l.player.id),
    );
  });
});

describe('winter transfers affect only what is left to play', () => {
  it('a winter signing joins the second half but leaves the played matchdays untouched', () => {
    const { career, windowMatchday } = careerAtWindow();
    const firstHalfResults = career.season.results;
    expect(firstHalfResults.length).toBeGreaterThan(0);

    const target = winterBuyableListings(career)[0]!; // the most valuable available player
    const { career: after, ok } = winterBuyPlayer(career, target.player.id);
    expect(ok).toBe(true);

    // The window has not advanced: still sitting at the same matchday.
    expect(after.season.currentMatchday).toBe(windowMatchday);
    // The already-played first half is byte-for-byte the same (no desync).
    expect(after.season.results).toEqual(firstHalfResults);
    // The signing is on the CURRENT roster, the wage book and the second-half squad.
    expect(rosterIds(after, HUMAN)).toContain(target.player.id);
    expect(seasonRosterIds(after, HUMAN)).toContain(target.player.id);
    expect(after.contracts[target.player.id]).toBeDefined();
    expect(after.budget).toBe(career.budget - target.askingPrice);
    // The seller lost the player from the current and derived rosters.
    expect(rosterIds(after, target.clubId)).not.toContain(target.player.id);
    expect(seasonRosterIds(after, target.clubId)).not.toContain(target.player.id);
    // The movement is logged so the derivation can reconstruct both halves.
    expect(after.winter?.movements).toEqual([
      { playerId: target.player.id, fromClubId: target.clubId, toClubId: HUMAN },
    ]);
  });

  it('actually changes the second half (the new squad plays on)', () => {
    const { career } = careerAtWindow();
    const target = winterBuyableListings(career)[0]!;
    const { career: after } = winterBuyPlayer(career, target.player.id);

    // Play both the untouched and the reinforced career to the end of the season.
    const baselineEnd = playTo(career, career.season.totalMatchdays + 1);
    const reinforcedEnd = playTo(after, after.season.totalMatchdays + 1);

    // Same first half...
    const firstHalf = career.season.results.length;
    expect(reinforcedEnd.season.results.slice(0, firstHalf)).toEqual(
      baselineEnd.season.results.slice(0, firstHalf),
    );
    // ...but the full season diverges: the winter signing reshaped the run-in.
    expect(reinforcedEnd.season.results).not.toEqual(baselineEnd.season.results);
  });

  it('selling a player at the window removes them from the second half only', () => {
    const { career } = careerAtWindow();
    const firstHalfResults = career.season.results;
    const mine = rosterIds(career, HUMAN)[0]!;
    const { career: after, ok } = winterSellPlayer(career, mine, 'real-madrid', 3_000_000);
    expect(ok).toBe(true);
    expect(after.season.results).toEqual(firstHalfResults);
    expect(seasonRosterIds(after, HUMAN)).not.toContain(mine);
    expect(seasonRosterIds(after, 'real-madrid')).toContain(mine);
    expect(after.budget).toBe(career.budget + 3_000_000);
    expect(after.contracts[mine]).toBeUndefined();
  });
});

describe('winter negotiation mirrors the pre-season market', () => {
  it('caps the price at the release clause and debits the budget', () => {
    const { career } = careerAtWindow();
    const target = winterBuyableListings(career)[0]!;
    const outcome = winterNegotiateBuy(career, target.player.id, target.clause + 10_000_000);
    expect(outcome.status).toBe('accepted');
    if (outcome.status === 'accepted') {
      expect(outcome.price).toBe(target.clause);
      expect(outcome.career.budget).toBe(career.budget - target.clause);
      expect(rosterIds(outcome.career, HUMAN)).toContain(target.player.id);
    }
  });

  it('counters a slightly-low offer and closes it with acceptCounter', () => {
    const { career } = careerAtWindow();
    const target = winterBuyableListings(career)[0]!;
    const low = Math.round(target.askingPrice * 0.9);
    const outcome = winterNegotiateBuy(career, target.player.id, low);
    expect(outcome.status).toBe('countered');
    if (outcome.status === 'countered') {
      const counter = outcome.counter;
      expect(counter).toBe(Math.round((low + target.askingPrice) / 2));
      const { career: after, ok } = winterAcceptCounter(career, target.player.id, counter);
      expect(ok).toBe(true);
      expect(after.budget).toBe(career.budget - counter);
      expect(rosterIds(after, HUMAN)).toContain(target.player.id);
    }
  });

  it('rejects an offer far below the asking price', () => {
    const { career } = careerAtWindow();
    const target = winterBuyableListings(career)[0]!;
    const outcome = winterNegotiateBuy(career, target.player.id, Math.round(target.askingPrice * 0.5));
    expect(outcome.status).toBe('rejected');
  });
});

describe('winter AI bids', () => {
  it('are deterministic and only for your players', () => {
    const { career } = careerAtWindow();
    const a = generateWinterBids(career);
    const b = generateWinterBids(career);
    expect(a).toEqual(b);
    const myIds = new Set(rosterIds(career, HUMAN));
    for (const bid of a) {
      expect(myIds.has(bid.playerId)).toBe(true);
      expect(bid.fromClubId).not.toBe(HUMAN);
      expect(bid.amount).toBeGreaterThan(0);
    }
  });

  it('accepting a winter bid sells the player and banks the fee', () => {
    const { career } = careerAtWindow();
    const bid = generateWinterBids(career)[0]!;
    const firstHalfResults = career.season.results;
    const { career: after, ok } = winterAcceptBid(career, bid);
    expect(ok).toBe(true);
    expect(after.budget).toBe(career.budget + bid.amount);
    expect(after.season.results).toEqual(firstHalfResults);
    expect(seasonRosterIds(after, HUMAN)).not.toContain(bid.playerId);
  });
});

describe('determinism', () => {
  it('the same career and the same winter buy yield identical seasons', () => {
    const a = careerAtWindow(99).career;
    const b = careerAtWindow(99).career;
    const target = winterBuyableListings(a)[0]!;
    const afterA = winterBuyPlayer(a, target.player.id).career;
    const afterB = winterBuyPlayer(b, target.player.id).career;
    expect(afterA.season.results).toEqual(afterB.season.results);
    expect(rosterIds(afterA, HUMAN)).toEqual(rosterIds(afterB, HUMAN));
    expect(afterA.winter).toEqual(afterB.winter);
  });
});

describe('persistence round-trips through save/load', () => {
  it('a career with winter movements reloads to the exact same season', () => {
    const { career, windowMatchday } = careerAtWindow(123);

    // Buy the best available player, sell one of ours via an AI bid, then close the
    // window and play several matchdays into the second half.
    const buyTarget = winterBuyableListings(career)[0]!;
    let live = winterBuyPlayer(career, buyTarget.player.id).career;
    const bid = generateWinterBids(live)[0];
    if (bid) live = winterAcceptBid(live, bid).career;
    live = closeWinterWindow(live);
    live = playTo(live, windowMatchday + 5);
    expect(live.season.currentMatchday).toBe(windowMatchday + 5);

    const restored = restoreCareer(serializeCareer(live), league);

    expect(restored.season.currentMatchday).toBe(live.season.currentMatchday);
    expect(restored.season.results).toEqual(live.season.results);
    expect(rosterIds(restored, HUMAN)).toEqual(rosterIds(live, HUMAN));
    expect(seasonRosterIds(restored, HUMAN)).toEqual(seasonRosterIds(live, HUMAN));
    expect(restored.budget).toBe(live.budget);
    expect(restored.contracts).toEqual(live.contracts);
    expect(restored.winter).toEqual(live.winter);
  });

  it('reloading mid-window keeps the window open with its movements', () => {
    const { career, windowMatchday } = careerAtWindow(55);
    const target = winterBuyableListings(career)[0]!;
    const live = winterBuyPlayer(career, target.player.id).career; // window still open

    const restored = restoreCareer(serializeCareer(live), league);
    expect(restored.season.currentMatchday).toBe(windowMatchday);
    expect(isWinterWindowOpen(restored)).toBe(true);
    expect(restored.winter?.movements).toEqual(live.winter?.movements);
    expect(seasonRosterIds(restored, HUMAN)).toEqual(seasonRosterIds(live, HUMAN));
  });

  it('a pre-invierno v2 save (no winter field) still loads', () => {
    const { career } = careerAtWindow(8);
    const save = serializeCareer(career) as Record<string, unknown>;
    delete save.winter; // simulate a save written before the winter window existed
    const restored = restoreCareer(save as never, league);
    expect(restored.winter?.movements).toEqual([]);
    expect(restored.winter?.closed).toBe(false);
    expect(isWinterWindowOpen(restored)).toBe(true);
  });
});
