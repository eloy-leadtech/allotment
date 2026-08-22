import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import type { MatchResult } from '@engine';
import { newCareer } from './career';
import { pressFeed, latestHeadlines } from './press';
import type { CareerState } from './types';

const league = loadPrimera9697();
const humanId = league.equipos[0]?.id ?? '';
const oppId = league.equipos[1]?.id ?? '';
const base = newCareer(league, humanId, 123);

/** A human match result (home) with the given scoreline. */
function match(goalsFor: number, goalsAgainst: number): MatchResult {
  return { homeId: humanId, awayId: oppId, homeGoals: goalsFor, awayGoals: goalsAgainst, events: [] };
}

/** The base career with the human's results swapped for a crafted sequence. */
function withResults(results: MatchResult[]): CareerState {
  return { ...base, season: { ...base.season, results } };
}

describe('pressFeed', () => {
  it('files one headline per human matchday, oldest first', () => {
    const feed = pressFeed(withResults([match(2, 0), match(1, 1), match(0, 2)]));
    expect(feed).toHaveLength(3);
    expect(feed.map((h) => h.matchday)).toEqual([1, 2, 3]);
    expect(feed.every((h) => h.text.length > 0)).toBe(true);
  });

  it('adds a streak headline on three straight wins', () => {
    const feed = pressFeed(withResults([match(2, 0), match(3, 1), match(1, 0)]));
    // 3 result headlines + 1 streak headline reacting to the third matchday.
    expect(feed).toHaveLength(4);
    const streak = feed.filter((h) => h.matchday === 3);
    expect(streak.some((h) => h.text.includes('3 victorias'))).toBe(true);
  });

  it('adds a streak headline on three straight losses', () => {
    const feed = pressFeed(withResults([match(0, 2), match(1, 3), match(0, 1)]));
    expect(feed.some((h) => h.text.includes('3 derrotas'))).toBe(true);
  });

  it('does not raise a streak headline before three in a row', () => {
    const feed = pressFeed(withResults([match(2, 0), match(1, 0)]));
    expect(feed).toHaveLength(2);
  });

  it('is deterministic for a given seed and results', () => {
    const results = [match(2, 0), match(0, 1), match(4, 0)];
    expect(pressFeed(withResults(results))).toEqual(pressFeed(withResults(results)));
  });

  it('latestHeadlines returns the most recent first, capped', () => {
    const feed = withResults([match(1, 0), match(2, 0), match(3, 0), match(0, 1)]);
    const latest = latestHeadlines(feed, 2);
    expect(latest).toHaveLength(2);
    const all = pressFeed(feed);
    expect(latest[0]).toEqual(all[all.length - 1]);
  });

  it('ignores matches the human did not play', () => {
    const other: MatchResult = { homeId: oppId, awayId: 'x', homeGoals: 5, awayGoals: 0, events: [] };
    const feed = pressFeed(withResults([other, match(1, 0)]));
    expect(feed).toHaveLength(1);
    expect(feed[0]?.matchday).toBe(1);
  });
});
