import { describe, it, expect } from 'vitest';
import { FRESH_FATIGUE, selectStartingXI, type CompetitionTeam } from '@engine';
import { loadPrimera9697 } from '@data';
import { newSeason, advanceMatchday, toMatchPlayer, isSeasonOver } from './season';
import { applyFatigue } from './fatigue';

const league = loadPrimera9697();
const firstTeam = league.equipos[0];
if (!firstTeam) throw new Error('league has no teams');
const humanTeamId = firstTeam.id;

function twoTeams(): CompetitionTeam[] {
  return league.equipos
    .slice(0, 2)
    .map((t) => ({ id: t.id, nombre: t.nombre, players: t.jugadores.map(toMatchPlayer) }));
}

describe('applyFatigue', () => {
  it('returns teams unchanged when no matches were played', () => {
    const teams = twoTeams();
    expect(applyFatigue(teams, [])).toEqual(teams);
  });

  it('tires the fielded XI and recovers everyone else', () => {
    const teams = twoTeams();
    const [home, away] = teams;
    if (!home || !away) throw new Error('need two teams');
    const homeXi = new Set(selectStartingXI(home.players).map((p) => p.id));

    const updated = applyFatigue(teams, [
      { homeId: home.id, awayId: away.id, homeGoals: 1, awayGoals: 1, events: [] },
    ]);
    const updatedHome = updated.find((t) => t.id === home.id);
    if (!updatedHome) throw new Error('home missing');

    const starter = updatedHome.players.find((p) => homeXi.has(p.id));
    const bench = updatedHome.players.find((p) => !homeXi.has(p.id));
    // Starters gained fatigue; benched players stay fresh (already at 0, recover to 0).
    expect(starter?.fatigue).toBeGreaterThan(FRESH_FATIGUE);
    if (bench) expect(bench.fatigue).toBe(FRESH_FATIGUE);
  });

  it('keeps an explicit tactics.xi snapshot in sync with the updated players', () => {
    const base = league.equipos[0];
    if (!base) throw new Error('no team');
    const players = base.jugadores.map(toMatchPlayer);
    const xi = selectStartingXI(players);
    const team: CompetitionTeam = { id: base.id, nombre: base.nombre, players, tactics: { formation: '4-4-2', xi } };
    const other = league.equipos[1];
    if (!other) throw new Error('no rival');
    const rival: CompetitionTeam = { id: other.id, nombre: other.nombre, players: other.jugadores.map(toMatchPlayer) };

    const updated = applyFatigue([team, rival], [
      { homeId: team.id, awayId: rival.id, homeGoals: 0, awayGoals: 0, events: [] },
    ]);
    const u = updated.find((t) => t.id === team.id);
    const firstXiId = xi[0]?.id;
    const inPlayers = u?.players.find((p) => p.id === firstXiId);
    const inXi = u?.tactics?.xi?.find((p) => p.id === firstXiId);
    expect(inXi).toBeDefined();
    expect(inXi?.fatigue).toBe(inPlayers?.fatigue);
  });
});

describe('season fatigue integration', () => {
  it('starts every player fresh', () => {
    const state = newSeason(league, humanTeamId, 2024);
    for (const t of state.teams) {
      for (const p of t.players) expect(p.fatigue).toBe(FRESH_FATIGUE);
    }
  });

  it('accumulates fatigue over matchdays and stays deterministic across replays', () => {
    const play = () => {
      let s = newSeason(league, humanTeamId, 99);
      for (let i = 0; i < 6; i += 1) s = advanceMatchday(s).state;
      return s;
    };
    const a = play();
    const b = play();
    const tired = a.teams.some((t) => t.players.some((p) => (p.fatigue ?? 0) > 0));
    expect(tired).toBe(true);
    expect(a.teams).toEqual(b.teams);
  });

  it('rewards rotation: a permanent auto-XI starter ends more fatigued than a bench player', () => {
    let s = newSeason(league, humanTeamId, 7);
    for (let i = 0; i < 15; i += 1) s = advanceMatchday(s).state;
    const team = s.teams.find((t) => t.id === humanTeamId);
    if (!team) throw new Error('team missing');
    const starterIds = new Set(selectStartingXI(team.players).map((p) => p.id));
    const starterFatigue = team.players
      .filter((p) => starterIds.has(p.id))
      .reduce((m, p) => Math.max(m, p.fatigue ?? 0), 0);
    const benchFatigue = team.players
      .filter((p) => !starterIds.has(p.id))
      .reduce((m, p) => Math.max(m, p.fatigue ?? 0), 0);
    // The eleven who play every week carry real fatigue; the bench stays fresher.
    expect(starterFatigue).toBeGreaterThan(benchFatigue);
  });

  it('never leaves fatigue outside [0,100] over a full season', () => {
    let s = newSeason(league, humanTeamId, 7);
    while (!isSeasonOver(s)) s = advanceMatchday(s).state;
    for (const t of s.teams) {
      for (const p of t.players) {
        expect(p.fatigue ?? 0).toBeGreaterThanOrEqual(0);
        expect(p.fatigue ?? 0).toBeLessThanOrEqual(100);
      }
    }
  });

  it('keeps the season goal average in the ~2.6-3.0 band with fatigue live', () => {
    let s = newSeason(league, humanTeamId, 19_9697);
    while (!isSeasonOver(s)) s = advanceMatchday(s).state;
    const goals = s.results.reduce((n, r) => n + r.homeGoals + r.awayGoals, 0);
    const mean = goals / s.results.length;
    expect(mean).toBeGreaterThanOrEqual(2.4);
    expect(mean).toBeLessThanOrEqual(3.2);
  });
});
