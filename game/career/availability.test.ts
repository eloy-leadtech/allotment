import { describe, it, expect } from 'vitest';
import type { MatchEvent, MatchResult } from '@engine';
import {
  applyMatchdayAvailability,
  availabilityStatus,
  isAvailable,
  YELLOWS_PER_BAN,
  type AvailabilityMap,
} from './availability';

/** Build a one-fixture matchday result carrying the given events. */
function result(events: MatchEvent[]): MatchResult {
  return { homeId: 'H', awayId: 'A', homeGoals: 0, awayGoals: 0, events };
}

const yellow = (playerId: string): MatchEvent => ({
  min: 20,
  type: 'yellow',
  team: 'home',
  playerId,
  playerName: playerId,
});
const secondYellow = (playerId: string): MatchEvent => ({
  min: 80,
  type: 'secondYellow',
  team: 'home',
  playerId,
  playerName: playerId,
});
const red = (playerId: string): MatchEvent => ({
  min: 55,
  type: 'red',
  team: 'home',
  playerId,
  playerName: playerId,
});
const injury = (playerId: string, matchesOut: number): MatchEvent => ({
  min: 30,
  type: 'injury',
  team: 'home',
  playerId,
  playerName: playerId,
  matchesOut,
});

describe('availability: yellow accumulation', () => {
  it('suspends one match after the fifth yellow, not before', () => {
    let map: AvailabilityMap = {};
    for (let md = 1; md <= YELLOWS_PER_BAN; md += 1) {
      map = applyMatchdayAvailability(map, [result([yellow('p1')])], md);
      const suspendedNow = !isAvailable(map['p1'], md + 1);
      expect(suspendedNow).toBe(md === YELLOWS_PER_BAN);
    }
    expect(map['p1']?.yellowAccum).toBe(YELLOWS_PER_BAN);
  });

  it('serves exactly one matchday, then is available again', () => {
    // Reach 5 yellows over matchdays 1..5 (suspension pending for md6).
    let map: AvailabilityMap = {};
    for (let md = 1; md <= 5; md += 1) {
      map = applyMatchdayAvailability(map, [result([yellow('p1')])], md);
    }
    expect(isAvailable(map['p1'], 6)).toBe(false); // sits md6
    map = applyMatchdayAvailability(map, [], 6); // served md6
    expect(isAvailable(map['p1'], 7)).toBe(true); // free md7
  });
});

describe('availability: red and double yellow', () => {
  it('a direct red bans 1 or 2 matches deterministically', () => {
    const map = applyMatchdayAvailability({}, [result([red('p1')])], 3);
    const out = map['p1']?.suspendedMatches ?? 0;
    expect(out === 1 || out === 2).toBe(true);
    // Same inputs reproduce the same ban length.
    const again = applyMatchdayAvailability({}, [result([red('p1')])], 3);
    expect(again['p1']?.suspendedMatches).toBe(out);
  });

  it('a double yellow bans exactly one match and does not add to the 5-yellow tally', () => {
    const map = applyMatchdayAvailability(
      {},
      [result([yellow('p1'), secondYellow('p1')])],
      4,
    );
    expect(map['p1']?.suspendedMatches).toBe(1);
    expect(map['p1']?.yellowAccum ?? 0).toBe(0);
  });
});

describe('availability: injuries', () => {
  it('marks the player out for N matchdays and frees them afterwards', () => {
    const map = applyMatchdayAvailability({}, [result([injury('p1', 3)])], 5);
    // Injured during md5 => out md6, md7, md8; back on md9.
    expect(isAvailable(map['p1'], 6)).toBe(false);
    expect(isAvailable(map['p1'], 8)).toBe(false);
    expect(isAvailable(map['p1'], 9)).toBe(true);
    const st = availabilityStatus(map['p1'], 6);
    expect(st.status).toBe('injured');
    expect(st.matchesOut).toBe(3);
  });
});

describe('availability: countdown across matchdays', () => {
  it('a two-match ban is served over the next two matchdays', () => {
    let map: AvailabilityMap = { p1: { yellowAccum: 0, suspendedMatches: 2 } };
    expect(isAvailable(map['p1'], 2)).toBe(false);
    map = applyMatchdayAvailability(map, [], 2);
    expect(map['p1']?.suspendedMatches).toBe(1);
    expect(isAvailable(map['p1'], 3)).toBe(false);
    map = applyMatchdayAvailability(map, [], 3);
    expect(map['p1']?.suspendedMatches).toBeUndefined();
    expect(isAvailable(map['p1'], 4)).toBe(true);
  });
});
