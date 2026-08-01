import { describe, it, expect } from 'vitest';
import { computePichichi, computeZamora, computeSeasonAwards } from './trophies';
import type { AwardTeam } from './types';
import type { MatchEvent, MatchResult } from '../match';

/** A goal event by the given scorer for the given side. */
function goal(team: 'home' | 'away', playerId: string, playerName: string, min = 10): MatchEvent {
  return { min, type: 'goal', team, playerId, playerName };
}

/** Build a result with an explicit event list; score is derived from the goals. */
function result(homeId: string, awayId: string, events: MatchEvent[]): MatchResult {
  const homeGoals = events.filter((e) => e.type === 'goal' && e.team === 'home').length;
  const awayGoals = events.filter((e) => e.type === 'goal' && e.team === 'away').length;
  return { homeId, awayId, homeGoals, awayGoals, events };
}

const teams: AwardTeam[] = [
  {
    id: 'a',
    players: [
      { id: 'a-gk1', nombre: 'Portero A', esPortero: true, media: 80 },
      { id: 'a-gk2', nombre: 'Suplente A', esPortero: true, media: 60 },
      { id: 'a-fw', nombre: 'Delantero A', esPortero: false, media: 85 },
    ],
  },
  {
    id: 'b',
    players: [
      { id: 'b-gk', nombre: 'Portero B', esPortero: true, media: 75 },
      { id: 'b-fw', nombre: 'Delantero B', esPortero: false, media: 82 },
    ],
  },
];

describe('computePichichi', () => {
  it('returns the top scorer with their goal count and team', () => {
    const results = [
      result('a', 'b', [goal('home', 'a-fw', 'Delantero A'), goal('home', 'a-fw', 'Delantero A')]),
      result('b', 'a', [goal('away', 'a-fw', 'Delantero A'), goal('home', 'b-fw', 'Delantero B')]),
    ];
    const pichichi = computePichichi(results);
    expect(pichichi).toEqual({ playerId: 'a-fw', playerName: 'Delantero A', teamId: 'a', goals: 3 });
  });

  it('is order-independent and breaks ties by the lower playerId', () => {
    const results = [
      result('a', 'b', [goal('home', 'a-fw', 'Delantero A'), goal('away', 'b-fw', 'Delantero B')]),
    ];
    const forward = computePichichi(results);
    const reversed = computePichichi([...results].reverse());
    expect(forward).toEqual(reversed);
    // Both on 1 goal -> 'a-fw' < 'b-fw'.
    expect(forward?.playerId).toBe('a-fw');
  });

  it('returns null when no goal was scored', () => {
    const results = [result('a', 'b', [{ min: 5, type: 'chance', team: 'home', playerId: 'a-fw', playerName: 'Delantero A' }])];
    expect(computePichichi(results)).toBeNull();
  });
});

describe('computeZamora', () => {
  it('awards the least-conceded team primary keeper', () => {
    // a concedes 0 then 1 (=1 in 2); b concedes 2 then 1 (=3 in 2) -> a's keeper.
    const results = [
      result('a', 'b', [goal('home', 'a-fw', 'Delantero A'), goal('home', 'a-fw', 'Delantero A')]),
      result('b', 'a', [goal('home', 'b-fw', 'Delantero B'), goal('away', 'a-fw', 'Delantero A')]),
    ];
    const zamora = computeZamora(results, teams);
    expect(zamora).toEqual({
      playerId: 'a-gk1',
      playerName: 'Portero A',
      teamId: 'a',
      goalsConceded: 1,
      matches: 2,
    });
  });

  it('picks the highest-media keeper as the team titular', () => {
    // b concedes 0, a concedes 1 -> b wins Zamora with its only keeper.
    const zamoraB = computeZamora([result('a', 'b', [goal('away', 'b-fw', 'Delantero B')])], teams);
    expect(zamoraB?.playerId).toBe('b-gk');
    // Now make a the winner (a concedes 0, b concedes 1) and confirm its titular
    // is the media-80 keeper, not the media-60 suplente.
    const zamoraA = computeZamora([result('b', 'a', [goal('away', 'a-fw', 'x')])], teams);
    expect(zamoraA?.playerId).toBe('a-gk1');
  });

  it('returns null when nothing has been played', () => {
    expect(computeZamora([], teams)).toBeNull();
  });
});

describe('computeSeasonAwards', () => {
  it('bundles both trophies', () => {
    const results = [
      result('a', 'b', [goal('home', 'a-fw', 'Delantero A'), goal('away', 'b-fw', 'Delantero B')]),
    ];
    const awards = computeSeasonAwards(results, teams);
    expect(awards.pichichi?.playerId).toBe('a-fw');
    expect(awards.zamora?.teamId).toBe('a'); // both conceded 1 -> tie broken by lower teamId
  });

  it('is deterministic: same results yield identical awards', () => {
    const results = [
      result('a', 'b', [goal('home', 'a-fw', 'Delantero A')]),
      result('b', 'a', [goal('away', 'a-fw', 'Delantero A'), goal('home', 'b-fw', 'Delantero B')]),
    ];
    expect(computeSeasonAwards(results, teams)).toEqual(computeSeasonAwards(results, teams));
  });
});
