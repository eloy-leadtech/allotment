import { describe, it, expect } from 'vitest';
import { NEUTRAL_FORM, NEUTRAL_MORALE, selectStartingXI, type CompetitionTeam } from '@engine';
import { loadPrimera9697 } from '@data';
import { newSeason, advanceMatchday, toMatchPlayer, fixturesForMatchday } from './season';
import { applyFormMorale } from './formMorale';

const league = loadPrimera9697();
const firstTeam = league.equipos[0];
if (!firstTeam) throw new Error('league has no teams');
const humanTeamId = firstTeam.id;

describe('applyFormMorale', () => {
  it('returns teams unchanged when no matches were played', () => {
    const teams: CompetitionTeam[] = league.equipos
      .slice(0, 2)
      .map((t) => ({ id: t.id, nombre: t.nombre, players: t.jugadores.map(toMatchPlayer) }));
    expect(applyFormMorale(teams, [])).toEqual(teams);
  });

  it('moves the fielded XI away from neutral and keeps others neutral', () => {
    const teams: CompetitionTeam[] = league.equipos
      .slice(0, 2)
      .map((t) => ({ id: t.id, nombre: t.nombre, players: t.jugadores.map(toMatchPlayer) }));
    const [home, away] = teams;
    if (!home || !away) throw new Error('need two teams');
    const homeXi = new Set(selectStartingXI(home.players).map((p) => p.id));

    const updated = applyFormMorale(teams, [
      { homeId: home.id, awayId: away.id, homeGoals: 3, awayGoals: 0, events: [] },
    ]);
    const updatedHome = updated.find((t) => t.id === home.id);
    if (!updatedHome) throw new Error('home missing');

    const starter = updatedHome.players.find((p) => homeXi.has(p.id));
    const bench = updatedHome.players.find((p) => !homeXi.has(p.id));
    // Winners who played gain form; bench players regress/penalise below neutral.
    expect(starter?.form).toBeGreaterThan(NEUTRAL_FORM);
    if (bench) expect(bench.form).toBeLessThanOrEqual(NEUTRAL_FORM);
  });

  it('keeps an explicit tactics.xi snapshot in sync with the updated players', () => {
    const base = league.equipos[0];
    if (!base) throw new Error('no team');
    const players = base.jugadores.map(toMatchPlayer);
    const xi = selectStartingXI(players);
    const team: CompetitionTeam = {
      id: base.id,
      nombre: base.nombre,
      players,
      tactics: { formation: '4-4-2', xi },
    };
    const other = league.equipos[1];
    if (!other) throw new Error('no rival');
    const rival: CompetitionTeam = {
      id: other.id,
      nombre: other.nombre,
      players: other.jugadores.map(toMatchPlayer),
    };

    const updated = applyFormMorale([team, rival], [
      { homeId: team.id, awayId: rival.id, homeGoals: 1, awayGoals: 0, events: [] },
    ]);
    const u = updated.find((t) => t.id === team.id);
    const firstXiId = xi[0]?.id;
    const inPlayers = u?.players.find((p) => p.id === firstXiId);
    const inXi = u?.tactics?.xi?.find((p) => p.id === firstXiId);
    expect(inXi).toBeDefined();
    expect(inXi?.form).toBe(inPlayers?.form);
    expect(inXi?.morale).toBe(inPlayers?.morale);
  });
});

describe('season form/morale integration', () => {
  it('starts every player neutral', () => {
    const state = newSeason(league, humanTeamId, 2024);
    for (const t of state.teams) {
      for (const p of t.players) {
        expect(p.form).toBe(NEUTRAL_FORM);
        expect(p.morale).toBe(NEUTRAL_MORALE);
      }
    }
  });

  it('evolves form/morale after a matchday and stays deterministic across replays', () => {
    const play = () => {
      let s = newSeason(league, humanTeamId, 99);
      for (let i = 0; i < 5; i += 1) s = advanceMatchday(s).state;
      return s;
    };
    const a = play();
    const b = play();
    // Some player has diverged from neutral after five matchdays.
    const diverged = a.teams.some((t) => t.players.some((p) => p.form !== NEUTRAL_FORM));
    expect(diverged).toBe(true);
    // Replays are identical (deterministic reconstruction).
    expect(a.teams).toEqual(b.teams);
  });

  it('never leaves a played player with out-of-range form/morale', () => {
    let s = newSeason(league, humanTeamId, 7);
    for (let i = 0; i < 20; i += 1) s = advanceMatchday(s).state;
    for (const t of s.teams) {
      for (const p of t.players) {
        expect(p.form ?? NEUTRAL_FORM).toBeGreaterThanOrEqual(0);
        expect(p.form ?? NEUTRAL_FORM).toBeLessThanOrEqual(100);
        expect(p.morale ?? NEUTRAL_MORALE).toBeGreaterThanOrEqual(0);
        expect(p.morale ?? NEUTRAL_MORALE).toBeLessThanOrEqual(100);
      }
    }
    // Sanity: a real matchday was played this round.
    expect(fixturesForMatchday(s, 1).length).toBeGreaterThan(0);
  });
});
