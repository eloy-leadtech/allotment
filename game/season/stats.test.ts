import { describe, it, expect } from 'vitest';
import type { CompetitionTeam, MatchEvent, MatchPlayer, MatchResult } from '@engine';
import type { SeasonState } from './season';
import type { PalmaresTitle, SeasonSummary } from '../career/types';
import {
  topScorers,
  topKeepers,
  humanForm,
  humanTeamStats,
  seasonStats,
  careerRecords,
} from './stats';

/** A minimal-but-complete match player. */
function mp(id: string, nombre: string, esPortero: boolean, media: number): MatchPlayer {
  return {
    id,
    nombre,
    posicion: esPortero ? 'POR' : 'DEL',
    esPortero,
    media,
    remate: 50,
    ofensivo: 50,
    pase: 50,
    entrada: 50,
    porteria: esPortero ? 70 : 20,
  };
}

/** A team with a titular keeper (media 80) + a suplente keeper + a forward. */
function team(id: string): CompetitionTeam {
  return {
    id,
    nombre: id.toUpperCase(),
    players: [
      mp(`${id}-gk1`, `Portero ${id}`, true, 80),
      mp(`${id}-gk2`, `Suplente ${id}`, true, 60),
      mp(`${id}-fw`, `Delantero ${id}`, false, 85),
    ],
  };
}

function goal(team: 'home' | 'away', playerId: string, playerName: string, min = 10): MatchEvent {
  return { min, type: 'goal', team, playerId, playerName };
}

function result(homeId: string, awayId: string, events: MatchEvent[]): MatchResult {
  const homeGoals = events.filter((e) => e.type === 'goal' && e.team === 'home').length;
  const awayGoals = events.filter((e) => e.type === 'goal' && e.team === 'away').length;
  return { homeId, awayId, homeGoals, awayGoals, events };
}

/** A minimal season state carrying only what the stats read (teams/results/human). */
function makeState(
  teams: CompetitionTeam[],
  results: MatchResult[],
  humanTeamId: string,
): SeasonState {
  return {
    leagueId: 'test',
    temporada: '96/97',
    seed: 1,
    humanTeamId,
    pointsForWin: 3,
    relegationSpots: 0,
    teams,
    fixtures: [],
    totalMatchdays: 1,
    currentMatchday: 2,
    results,
    availability: {},
  };
}

describe('topScorers', () => {
  it('returns the Pichichi race best-first, its head matching the Pichichi', () => {
    const teams = [team('a'), team('b')];
    const results = [
      result('a', 'b', [goal('home', 'a-fw', 'Delantero a'), goal('home', 'a-fw', 'Delantero a')]),
      result('b', 'a', [goal('home', 'b-fw', 'Delantero b'), goal('away', 'a-fw', 'Delantero a')]),
    ];
    const state = makeState(teams, results, 'a');
    const scorers = topScorers(state);
    expect(scorers[0]).toEqual({ playerId: 'a-fw', playerName: 'Delantero a', teamId: 'a', goals: 3 });
    expect(scorers[1]).toEqual({ playerId: 'b-fw', playerName: 'Delantero b', teamId: 'b', goals: 1 });
  });

  it('honours the top limit', () => {
    const teams = [team('a'), team('b')];
    const results = [
      result('a', 'b', [goal('home', 'a-fw', 'Delantero a'), goal('away', 'b-fw', 'Delantero b')]),
    ];
    expect(topScorers(makeState(teams, results, 'a'), 1)).toHaveLength(1);
  });

  it('is empty when no goal was scored', () => {
    const teams = [team('a'), team('b')];
    expect(topScorers(makeState(teams, [result('a', 'b', [])], 'a'))).toEqual([]);
  });
});

describe('topKeepers', () => {
  it('ranks the least-conceded team primary keeper first', () => {
    const teams = [team('a'), team('b')];
    // a concedes 1 (in 2 games); b concedes 3 -> a's keeper leads.
    const results = [
      result('a', 'b', [goal('home', 'a-fw', 'x'), goal('home', 'a-fw', 'x')]),
      result('b', 'a', [goal('home', 'b-fw', 'y'), goal('away', 'a-fw', 'x')]),
    ];
    const keepers = topKeepers(makeState(teams, results, 'a'));
    expect(keepers[0]).toEqual({
      playerId: 'a-gk1',
      playerName: 'Portero a',
      teamId: 'a',
      goalsConceded: 1,
      matches: 2,
    });
    expect(keepers[1]?.teamId).toBe('b');
  });
});

describe('humanForm', () => {
  it('reports V/E/D from the human perspective, oldest→newest', () => {
    const teams = [team('a'), team('b')];
    const results = [
      result('a', 'b', [goal('home', 'a-fw', 'x'), goal('home', 'a-fw', 'x')]), // a 2-0 win (V)
      result('b', 'a', [goal('home', 'b-fw', 'y'), goal('away', 'a-fw', 'x')]), // a away draw 1-1 (E)
      result('a', 'b', [goal('away', 'b-fw', 'y')]), // a 0-1 loss (D)
    ];
    const form = humanForm(makeState(teams, results, 'a'));
    expect(form.map((f) => f.outcome)).toEqual(['V', 'E', 'D']);
    expect(form[0]).toEqual({ opponentId: 'b', home: true, goalsFor: 2, goalsAgainst: 0, outcome: 'V' });
    expect(form[1]).toMatchObject({ opponentId: 'b', home: false, goalsFor: 1, goalsAgainst: 1 });
  });

  it('caps to the most recent N matches', () => {
    const teams = [team('a'), team('b')];
    const results = [
      result('a', 'b', [goal('home', 'a-fw', 'x')]),
      result('b', 'a', [goal('away', 'a-fw', 'x')]),
      result('a', 'b', [goal('home', 'a-fw', 'x')]),
    ];
    const form = humanForm(makeState(teams, results, 'a'), 2);
    expect(form).toHaveLength(2);
    // last two, oldest→newest: away win then home win
    expect(form.map((f) => f.home)).toEqual([false, true]);
  });

  it('ignores matches the human did not play', () => {
    const teams = [team('a'), team('b')];
    const results = [result('a', 'b', [goal('home', 'a-fw', 'x')])];
    expect(humanForm(makeState(teams, results, 'a'))).toHaveLength(1);
    // As 'b' the same match is a loss; a third team plays nothing.
    expect(humanForm(makeState(teams, results, 'b'))[0]?.outcome).toBe('D');
  });
});

describe('humanTeamStats', () => {
  it('exposes the human line with its 1-indexed position', () => {
    const teams = [team('a'), team('b')];
    // a beats b 2-0: a first (3 pts), b second.
    const results = [result('a', 'b', [goal('home', 'a-fw', 'x'), goal('home', 'a-fw', 'x')])];
    const stats = humanTeamStats(makeState(teams, results, 'a'));
    expect(stats).toMatchObject({
      teamId: 'a',
      position: 1,
      played: 1,
      won: 1,
      goalsFor: 2,
      goalsAgainst: 0,
      points: 3,
    });
    const loser = humanTeamStats(makeState(teams, results, 'b'));
    expect(loser).toMatchObject({ teamId: 'b', position: 2, lost: 1, points: 0 });
  });
});

describe('seasonStats', () => {
  it('bundles scorers, keepers, team and form, and is deterministic', () => {
    const teams = [team('a'), team('b')];
    const results = [
      result('a', 'b', [goal('home', 'a-fw', 'Delantero a'), goal('away', 'b-fw', 'Delantero b')]),
    ];
    const state = makeState(teams, results, 'a');
    const stats = seasonStats(state);
    expect(stats.topScorers[0]?.playerId).toBe('a-fw');
    expect(stats.topKeepers[0]?.teamId).toBe('a'); // both concede 1 → tie broken by lower teamId
    expect(stats.team?.teamId).toBe('a');
    expect(stats.form).toHaveLength(1);
    expect(seasonStats(state)).toEqual(seasonStats(state));
  });
});

describe('careerRecords', () => {
  const history: SeasonSummary[] = [
    {
      seasonNumber: 1,
      temporada: '96/97',
      championId: 'rival',
      humanPosition: 5,
      pichichi: { playerId: 'rival-fw', playerName: 'Otro', teamId: 'rival', goals: 25 },
    },
    {
      seasonNumber: 2,
      temporada: '97/98',
      championId: 'a',
      humanPosition: 1,
      pichichi: { playerId: 'a-fw', playerName: 'Mío', teamId: 'a', goals: 30 },
    },
  ];
  const palmares: PalmaresTitle[] = [
    { competition: 'liga', seasonNumber: 2, temporada: '97/98', division: 'primera' },
  ];

  it('summarises best position, titles and own Pichichis', () => {
    const rec = careerRecords(history, palmares, 'a');
    expect(rec.seasonsPlayed).toBe(2);
    expect(rec.bestPosition).toBe(1);
    expect(rec.titles).toBe(1);
    expect(rec.ownPichichis).toEqual([
      { seasonNumber: 2, temporada: '97/98', playerName: 'Mío', goals: 30 },
    ]);
  });

  it('handles an empty history', () => {
    expect(careerRecords([], [], 'a')).toEqual({
      seasonsPlayed: 0,
      bestPosition: null,
      titles: 0,
      ownPichichis: [],
    });
  });
});
