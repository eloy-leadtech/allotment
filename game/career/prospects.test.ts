import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import { newCareer } from './career';
import { advanceMatchday } from '../season/season';
import { serializeCareer, restoreCareer, CareerSaveSchema } from '../save/save';
import { playerAge, seasonStartYear } from './development';
import {
  leagueProspects,
  isProspect,
  isFollowingProspect,
  prospectSeasonsObserved,
  followProspect,
  unfollowProspect,
  signProspect,
  PROSPECT_MAX_AGE,
} from './prospects';
import type { CareerState } from './types';

const league = loadPrimera9697();
const humanTeamId = league.equipos[0]?.id;
if (!humanTeamId) throw new Error('league has no teams');

function freshCareer(): CareerState {
  return newCareer(league, humanTeamId!, 2024);
}

/** The id of the first prospect in the deterministic league list. */
function aProspectId(career: CareerState): string {
  const id = leagueProspects(career)[0]?.player.id;
  if (!id) throw new Error('no prospect');
  return id;
}

/** A player id from the human's own squad. */
function anOwnId(career: CareerState): string {
  const own = career.teams.find((t) => t.id === career.humanTeamId);
  const id = own?.players[0]?.id;
  if (!id) throw new Error('no own player');
  return id;
}

describe('leagueProspects', () => {
  it('is deterministic: same career yields an identical list', () => {
    const career = freshCareer();
    expect(leagueProspects(career)).toEqual(leagueProspects(career));
    // A career built from the same inputs produces the very same shortlist.
    expect(leagueProspects(freshCareer())).toEqual(leagueProspects(career));
  });

  it('lists only young, promising RIVAL players with a valid band', () => {
    const career = freshCareer();
    const startYear = seasonStartYear(career.temporada);
    const list = leagueProspects(career);
    expect(list.length).toBeGreaterThan(0);
    for (const r of list) {
      // Never a player from your own club.
      expect(r.clubId).not.toBe(career.humanTeamId);
      // Young enough.
      expect(r.age).toBeLessThanOrEqual(PROSPECT_MAX_AGE);
      expect(playerAge(r.player, startYear)).toBe(r.age);
      // Genuinely a promesa by the shared potential model.
      expect(isProspect(r.player, r.age, career.seed)).toBe(true);
      // Fallible band is well-formed within the 0-99 scale.
      expect(r.potential.low).toBeLessThanOrEqual(r.potential.high);
      expect(r.potential.low).toBeGreaterThanOrEqual(0);
      expect(r.potential.high).toBeLessThanOrEqual(99);
    }
  });

  it('surfaces a followed prospect to the top of the list', () => {
    const career = freshCareer();
    const id = aProspectId(career);
    const followed = followProspect(career, id).career;
    expect(leagueProspects(followed)[0]?.player.id).toBe(id);
    expect(leagueProspects(followed)[0]?.following).toBe(true);
  });

  it('does not leak: the shortlist membership never depends on follow state', () => {
    const career = freshCareer();
    const id = aProspectId(career);
    const before = new Set(leagueProspects(career).map((r) => r.player.id));
    const after = new Set(leagueProspects(followProspect(career, id).career).map((r) => r.player.id));
    expect(after).toEqual(before);
  });
});

describe('following narrows the fallible band', () => {
  it('the band strictly narrows the more seasons you have followed', () => {
    const career = freshCareer();
    const id = aProspectId(career);
    const followed = followProspect(career, id).career;

    // Same season you started: nothing observed yet (widest band).
    expect(prospectSeasonsObserved(followed, id)).toBe(0);
    const now = leagueProspects(followed).find((r) => r.player.id === id)!;

    // Simulate five career seasons of continuous following (only seasonNumber gates it).
    const later: CareerState = { ...followed, seasonNumber: followed.seasonNumber + 5 };
    expect(prospectSeasonsObserved(later, id)).toBe(5);
    const then = leagueProspects(later).find((r) => r.player.id === id)!;

    const width = (r: { potential: { low: number; high: number } }) => r.potential.high - r.potential.low;
    expect(width(then)).toBeLessThan(width(now));
  });

  it('narrows on average across every prospect as seasons followed grow', () => {
    const career = freshCareer();
    const list = leagueProspects(career);
    // Follow all of them this season, then jump five seasons ahead.
    let followed = career;
    for (const r of list) followed = followProspect(followed, r.player.id).career;
    const later: CareerState = { ...followed, seasonNumber: followed.seasonNumber + 5 };

    const totalWidth = (c: CareerState) =>
      leagueProspects(c).reduce((s, r) => s + (r.potential.high - r.potential.low), 0);
    expect(totalWidth(later)).toBeLessThan(totalWidth(followed));
  });
});

describe('followProspect / unfollowProspect', () => {
  it('records a follow from the current season and does not mutate the input', () => {
    const career = freshCareer();
    const snap = JSON.parse(JSON.stringify(career.prospectTracking));
    const id = aProspectId(career);

    const res = followProspect(career, id);
    expect(res.ok).toBe(true);
    expect(res.career.prospectTracking[id]).toEqual({ since: career.seasonNumber });
    expect(isFollowingProspect(res.career, id)).toBe(true);
    // Input untouched (pure).
    expect(career.prospectTracking).toEqual(snap);
    expect(isFollowingProspect(career, id)).toBe(false);
  });

  it('refuses to follow the same prospect twice', () => {
    const career = freshCareer();
    const id = aProspectId(career);
    const once = followProspect(career, id);
    const twice = followProspect(once.career, id);
    expect(twice.ok).toBe(false);
    expect(twice.reason).toBe('ya-seguido');
  });

  it('refuses your own player, an unknown id, and a non-promesa', () => {
    const career = freshCareer();
    expect(followProspect(career, anOwnId(career)).reason).toBe('propio');
    expect(followProspect(career, 'no-such-player').reason).toBe('no-encontrado');

    // A rival who is NOT a young promesa (not on the shortlist) is rejected.
    const prospectIds = new Set(leagueProspects(career).map((r) => r.player.id));
    const nonProspect = career.teams
      .filter((t) => t.id !== career.humanTeamId)
      .flatMap((t) => t.players)
      .find((p) => !prospectIds.has(p.id));
    if (!nonProspect) throw new Error('expected a non-prospect rival');
    expect(followProspect(career, nonProspect.id).reason).toBe('no-promesa');
  });

  it('unfollow removes the record and soft-fails when not following', () => {
    const career = freshCareer();
    const id = aProspectId(career);
    const followed = followProspect(career, id).career;

    const un = unfollowProspect(followed, id);
    expect(un.ok).toBe(true);
    expect(isFollowingProspect(un.career, id)).toBe(false);

    const again = unfollowProspect(un.career, id);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('no-seguido');
  });
});

describe('signProspect (market hook)', () => {
  it('signs a followed prospect through the market, banking them and clearing the follow', () => {
    let career = freshCareer();
    const list = leagueProspects(career);
    // Pick a followed prospect the club can afford (cheapest by estimated band).
    const target = list[list.length - 1]!;
    const id = target.player.id;
    career = followProspect(career, id).career;
    // Ensure the budget covers it (this is a market-mechanics test, not a budget one).
    career = { ...career, budget: 500_000_000 };

    const before = career.teams.find((t) => t.id === career.humanTeamId)!.players.length;
    const res = signProspect(career, id);
    expect(res.ok).toBe(true);
    const human = res.career.teams.find((t) => t.id === res.career.humanTeamId)!;
    expect(human.players.length).toBe(before + 1);
    expect(human.players.some((p) => p.id === id)).toBe(true);
    // The follow record is dropped now that the player is yours.
    expect(isFollowingProspect(res.career, id)).toBe(false);
    // Budget was debited and a contract was created (market.ts did the work).
    expect(res.career.budget).toBeLessThan(career.budget);
    expect(res.career.contracts[id]).toBeDefined();
  });

  it('soft-fails when the market is closed (a matchday has been played)', () => {
    const career = freshCareer();
    const id = aProspectId(career);
    // Play one matchday to close the pre-season transfer window.
    const started: CareerState = { ...career, season: advanceMatchday(career.season).state };
    const res = signProspect(started, id);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('mercado-cerrado');
  });

  it('soft-fails without budget', () => {
    const career = { ...freshCareer(), budget: 0 };
    const id = aProspectId(career);
    const res = signProspect(career, id);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('presupuesto');
  });
});

describe('persistence', () => {
  it('round-trips the follow-list through a save', () => {
    const base = freshCareer();
    const id = aProspectId(base);
    const career = followProspect(base, id).career;

    const save = serializeCareer(career);
    expect(save.prospectTracking).toEqual({ [id]: { since: career.seasonNumber } });

    const restored = restoreCareer(save, league);
    expect(restored.prospectTracking).toEqual(career.prospectTracking);
    // The restored career reproduces the exact same fallible band.
    const a = leagueProspects(career).find((r) => r.player.id === id)!;
    const b = leagueProspects(restored).find((r) => r.player.id === id)!;
    expect(b.potential).toEqual(a.potential);
  });

  it('defaults to an empty follow-list for pre-promesas saves (missing field)', () => {
    const save = serializeCareer(freshCareer());
    // Simulate an older save that predates the feature.
    const legacy = { ...save } as Record<string, unknown>;
    delete legacy.prospectTracking;
    const parsed = CareerSaveSchema.parse(legacy);
    expect(parsed.prospectTracking).toEqual({});
  });
});
