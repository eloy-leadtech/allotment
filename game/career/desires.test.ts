import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import type { Player } from '@data';
import { NEUTRAL_MORALE, type CompetitionTeam, type MatchPlayer } from '@engine';
import {
  derivePlayerDesire,
  desireMoraleDelta,
  desireInfo,
  applyDesireMorale,
  humanMatchdayContext,
  YOUTH_AGE,
  type DesireKind,
} from './desires';
import { newCareer } from './career';
import { advanceMatchday } from '../season/season';
import { serializeCareer, restoreCareer } from '../save/save';
import type { Contract } from './contracts';

/** A minimal but structurally-valid Player for the pure derivation checks. */
function player(id: string, media: number, opts: { birth?: string; gk?: boolean } = {}): Player {
  return {
    id,
    nombre: id,
    nombreCompleto: id,
    posicion: opts.gk ? 'POR' : 'DEL',
    esPortero: opts.gk ?? false,
    media,
    fechaNacimiento: opts.birth ?? '1975-01-01',
    atributos: {},
  } as unknown as Player;
}

const deal = (yearsLeft: number): Contract => ({ salary: 100_000, yearsLeft });

describe('derivePlayerDesire', () => {
  const base = { age: 30, isStarter: true, modestClub: false, topMedia: 90 } as const;

  it('a key player in the last year of his deal wants to RENOVAR', () => {
    expect(derivePlayerDesire(player('p', 85), { ...base, contract: deal(1) })).toBe('renovar');
  });

  it('a key player with years left does not ask to renew', () => {
    expect(derivePlayerDesire(player('p', 85), { ...base, contract: deal(3) })).toBe('contento');
  });

  it('a fringe player (low media, benched) with an expiring deal does NOT get renovar', () => {
    const desire = derivePlayerDesire(player('p', 60), {
      age: 30,
      isStarter: false,
      modestClub: false,
      topMedia: 90,
      contract: deal(1),
    });
    expect(desire).not.toBe('renovar');
  });

  it('a young promise who is not a starter wants MINUTOS', () => {
    const desire = derivePlayerDesire(player('kid', 68), {
      age: YOUTH_AGE,
      isStarter: false,
      modestClub: false,
      topMedia: 90,
      contract: deal(3),
    });
    expect(desire).toBe('minutos');
  });

  it('a young starter is content (he already plays)', () => {
    const desire = derivePlayerDesire(player('kid', 80), {
      age: 20,
      isStarter: true,
      modestClub: false,
      topMedia: 90,
      contract: deal(3),
    });
    expect(desire).toBe('contento');
  });

  it('a crack at a modest club craves EUROPA', () => {
    const desire = derivePlayerDesire(player('crack', 90), {
      age: 27,
      isStarter: true,
      modestClub: true,
      topMedia: 90,
      contract: deal(3),
    });
    expect(desire).toBe('europa');
  });

  it('a crack at an ambitious club is content', () => {
    const desire = derivePlayerDesire(player('crack', 90), {
      age: 27,
      isStarter: true,
      modestClub: false,
      topMedia: 90,
      contract: deal(3),
    });
    expect(desire).toBe('contento');
  });

  it('renovar takes priority over europa for an expiring crack', () => {
    const desire = derivePlayerDesire(player('crack', 90), {
      age: 27,
      isStarter: true,
      modestClub: true,
      topMedia: 90,
      contract: deal(1),
    });
    expect(desire).toBe('renovar');
  });
});

describe('desireMoraleDelta', () => {
  it('rewards minutes played and dents a benching for a MINUTOS wish', () => {
    expect(desireMoraleDelta('minutos', true, 'draw')).toBeGreaterThan(0);
    expect(desireMoraleDelta('minutos', false, 'win')).toBeLessThan(0);
  });

  it('drifts a RENOVAR wish down regardless of the result', () => {
    expect(desireMoraleDelta('renovar', true, 'win')).toBeLessThan(0);
    expect(desireMoraleDelta('renovar', false, 'loss')).toBeLessThan(0);
  });

  it('rides the result for an EUROPA wish (up on wins, down on losses)', () => {
    expect(desireMoraleDelta('europa', true, 'win')).toBeGreaterThan(0);
    expect(desireMoraleDelta('europa', true, 'loss')).toBeLessThan(0);
  });

  it('is zero for a content player', () => {
    expect(desireMoraleDelta('contento', true, 'win')).toBe(0);
    expect(desireMoraleDelta('contento', false, 'loss')).toBe(0);
  });

  it('keeps every delta small (never distorts balance)', () => {
    const kinds: DesireKind[] = ['renovar', 'minutos', 'europa', 'contento'];
    for (const k of kinds) {
      for (const played of [true, false]) {
        for (const outcome of ['win', 'draw', 'loss'] as const) {
          expect(Math.abs(desireMoraleDelta(k, played, outcome))).toBeLessThanOrEqual(3);
        }
      }
    }
  });
});

/** A minimal MatchPlayer for the drift checks. */
function mp(id: string, morale = NEUTRAL_MORALE): MatchPlayer {
  return { id, nombre: id, posicion: 'DEL', esPortero: false, media: 70, remate: 70, ofensivo: 70, pase: 70, entrada: 70, porteria: 10, morale };
}

describe('applyDesireMorale', () => {
  const human = 'H';
  const desires: Record<string, DesireKind> = { starter: 'contento', kid: 'minutos', vet: 'renovar' };
  const team = (): CompetitionTeam => ({
    id: human,
    nombre: 'Human',
    players: [mp('starter'), mp('kid'), mp('vet')],
  });

  it('lifts a MINUTOS player who played and dents one who was benched', () => {
    const played = applyDesireMorale([team()], human, desires, {
      played: true,
      outcome: 'draw',
      playedIds: new Set(['starter', 'kid']),
    });
    const kid = played[0]?.players.find((p) => p.id === 'kid');
    expect(kid?.morale).toBeGreaterThan(NEUTRAL_MORALE);

    const benched = applyDesireMorale([team()], human, desires, {
      played: true,
      outcome: 'draw',
      playedIds: new Set(['starter', 'vet']),
    });
    const kidBenched = benched[0]?.players.find((p) => p.id === 'kid');
    expect(kidBenched?.morale).toBeLessThan(NEUTRAL_MORALE);
  });

  it('drifts a RENOVAR player down and leaves a content player untouched', () => {
    const out = applyDesireMorale([team()], human, desires, {
      played: true,
      outcome: 'win',
      playedIds: new Set(['starter', 'kid', 'vet']),
    });
    expect(out[0]?.players.find((p) => p.id === 'vet')?.morale).toBeLessThan(NEUTRAL_MORALE);
    expect(out[0]?.players.find((p) => p.id === 'starter')?.morale).toBe(NEUTRAL_MORALE);
  });

  it('is a no-op when the human had no fixture, and never touches other teams', () => {
    const rival: CompetitionTeam = { id: 'R', nombre: 'Rival', players: [mp('x')] };
    const bye = applyDesireMorale([team(), rival], human, desires, {
      played: false,
      outcome: 'draw',
      playedIds: new Set(),
    });
    expect(bye[0]?.players.find((p) => p.id === 'kid')?.morale).toBe(NEUTRAL_MORALE);
    // Rival is returned by reference (untouched).
    expect(bye[1]).toBe(rival);
  });

  it('keeps a chosen-XI snapshot in lockstep with the updated players', () => {
    const xiTeam: CompetitionTeam = {
      id: human,
      nombre: 'Human',
      players: [mp('starter'), mp('kid'), mp('vet')],
      tactics: { formation: '4-4-2', xi: [mp('kid')] },
    };
    const out = applyDesireMorale([xiTeam], human, { kid: 'minutos' }, {
      played: true,
      outcome: 'draw',
      playedIds: new Set(['kid']),
    });
    const inPlayers = out[0]?.players.find((p) => p.id === 'kid')?.morale;
    const inXi = out[0]?.tactics?.xi?.find((p) => p.id === 'kid')?.morale;
    expect(inXi).toBe(inPlayers);
    expect(inXi).toBeGreaterThan(NEUTRAL_MORALE);
  });
});

describe('humanMatchdayContext', () => {
  it('reads a win/loss and the fielded XI, and marks a bye as not played', () => {
    const t: CompetitionTeam = {
      id: 'H',
      nombre: 'H',
      players: [mp('a'), mp('b')],
      tactics: { formation: '4-4-2', xi: [mp('a'), mp('b')] },
    };
    const ctx = humanMatchdayContext(t, 2, 0);
    expect(ctx.played).toBe(true);
    expect(ctx.outcome).toBe('win');
    expect(ctx.playedIds.has('a')).toBe(true);
    expect(humanMatchdayContext(undefined, undefined, undefined).played).toBe(false);
  });
});

describe('desireInfo', () => {
  it('marks the three wishes as wants and content as neutral', () => {
    expect(desireInfo('renovar').tone).toBe('want');
    expect(desireInfo('minutos').tone).toBe('want');
    expect(desireInfo('europa').tone).toBe('want');
    expect(desireInfo('contento').tone).toBe('neutral');
    for (const k of ['renovar', 'minutos', 'europa', 'contento'] as const) {
      expect(desireInfo(k).label.length).toBeGreaterThan(0);
    }
  });
});

describe('desires in a live career', () => {
  const league = loadPrimera9697();
  const humanTeamId = league.equipos[0]!.id;

  it('a career season carries a wish for every human player', () => {
    const career = newCareer(league, humanTeamId, 2024);
    const squad = career.teams.find((t) => t.id === humanTeamId)!;
    const desires = career.season.humanDesires;
    expect(desires).toBeDefined();
    for (const p of squad.players) {
      expect(desires![p.id]).toBeDefined();
    }
  });

  it('drives real per-matchday morale drift (season diverges from neutral)', () => {
    const career = newCareer(league, humanTeamId, 2024);
    let season = career.season;
    for (let i = 0; i < 6; i += 1) season = advanceMatchday(season).state;
    const human = season.teams.find((t) => t.id === humanTeamId);
    // At least one human player has a non-neutral morale (the mechanic is live).
    expect(human?.players.some((p) => (p.morale ?? NEUTRAL_MORALE) !== NEUTRAL_MORALE)).toBe(true);
  });

  it('is re-derived on load (never persisted) and reconstructs morale exactly', () => {
    const career = newCareer(league, humanTeamId, 2024);
    let season = career.season;
    for (let i = 0; i < 8; i += 1) season = advanceMatchday(season).state;
    const live = { ...career, season };

    const save = serializeCareer(live);
    // The wish map is derived, not part of the persisted payload.
    expect(JSON.stringify(save)).not.toMatch(/humanDesires|desire/i);

    const restored = restoreCareer(save, league);
    expect(restored.season.humanDesires).toEqual(live.season.humanDesires);
    const key = (t?: { players: { id: string; morale?: number }[] }) =>
      (t?.players ?? []).map((p) => `${p.id}:${p.morale}`).sort();
    const liveHuman = live.season.teams.find((t) => t.id === humanTeamId);
    const restoredHuman = restored.season.teams.find((t) => t.id === humanTeamId);
    expect(key(restoredHuman)).toEqual(key(liveHuman));
  });
});
