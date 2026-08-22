import { describe, it, expect } from 'vitest';
import { FRESH_FATIGUE, clampFatigue, type CompetitionTeam, type MatchPlayer } from '@engine';
import { loadPrimera9697 } from '@data';
import { newSeason, advanceMatchday, toMatchPlayer, isSeasonOver } from './season';
import {
  INTERNATIONAL_MEDIA_FLOOR,
  INTERNATIONAL_BREAK_FATIGUE,
  callUpProbability,
  isInternational,
  calledUpPlayers,
  paronMatchdays,
  isParonMatchday,
  applyInternationalBreak,
  type CallUpNotice,
} from './convocatorias';

const league = loadPrimera9697();

/** Build a bare MatchPlayer for unit tests (only the call-up-relevant fields matter). */
function mp(
  id: string,
  media: number,
  extra: Partial<MatchPlayer> = {},
): MatchPlayer {
  return {
    id,
    nombre: id,
    posicion: 'DEL',
    esPortero: false,
    media,
    remate: media,
    ofensivo: media,
    pase: media,
    entrada: media,
    porteria: media,
    fatigue: FRESH_FATIGUE,
    ...extra,
  };
}

describe('callUpProbability', () => {
  it('is zero below the media floor', () => {
    expect(callUpProbability(INTERNATIONAL_MEDIA_FLOOR - 1, false)).toBe(0);
    expect(callUpProbability(50, true)).toBe(0);
  });

  it('rises monotonically with media', () => {
    const a = callUpProbability(INTERNATIONAL_MEDIA_FLOOR, false);
    const b = callUpProbability(INTERNATIONAL_MEDIA_FLOOR + 5, false);
    const c = callUpProbability(95, false);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(c).toBeLessThanOrEqual(1);
  });

  it('nudges the odds up when a nationality signal is present, capped at 1', () => {
    const withNat = callUpProbability(85, true);
    const withoutNat = callUpProbability(85, false);
    expect(withNat).toBeGreaterThan(withoutNat);
    expect(callUpProbability(99, true)).toBeLessThanOrEqual(1);
  });
});

describe('isInternational', () => {
  it('is deterministic for a given seed and player', () => {
    const p = mp('p1', 85);
    const seed = 12345;
    const runs = Array.from({ length: 5 }, () => isInternational(p, seed));
    expect(new Set(runs).size).toBe(1);
  });

  it('never calls up a player below the media floor', () => {
    const p = mp('low', INTERNATIONAL_MEDIA_FLOOR - 1);
    for (let seed = 0; seed < 50; seed += 1) {
      expect(isInternational(p, seed)).toBe(false);
    }
  });

  it('always calls up an elite player whose probability saturates at 1', () => {
    // media 99 + nationality signal => probability 1 (>= ceil + bonus).
    const elite = mp('elite', 99, { nacionalidad: 'España' });
    for (let seed = 0; seed < 20; seed += 1) {
      expect(isInternational(elite, seed)).toBe(true);
    }
  });

  it('does NOT depend on nacionalidad alone: a high-media player with no nationality can still be called up', () => {
    // Robustness: the ~90%-null nationality field must not gate call-ups.
    const seeds = Array.from({ length: 60 }, (_, i) => i);
    const anyCalledUp = seeds.some((seed) => isInternational(mp('noflag', 88), seed));
    expect(anyCalledUp).toBe(true);
  });
});

describe('calledUpPlayers (real squad)', () => {
  const seed = 4242;
  const teams: CompetitionTeam[] = league.equipos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    players: t.jugadores.map(toMatchPlayer),
  }));

  it('is deterministic and returns a realistic non-empty subset of high-media players', () => {
    // League-wide there are surely some internationals for a fixed seed.
    const allCalledUp = teams.flatMap((t) => calledUpPlayers(t.players, seed));
    expect(allCalledUp.length).toBeGreaterThan(0);
    // Every convocado is a good player (>= floor) and it never returns the whole squad.
    for (const t of teams) {
      const calledUp = calledUpPlayers(t.players, seed);
      expect(calledUp.length).toBeLessThan(t.players.length);
      for (const p of calledUp) expect(p.media).toBeGreaterThanOrEqual(INTERNATIONAL_MEDIA_FLOOR);
    }
    // Same seed => same ids.
    const a = teams.flatMap((t) => calledUpPlayers(t.players, seed).map((p) => p.id));
    const b = teams.flatMap((t) => calledUpPlayers(t.players, seed).map((p) => p.id));
    expect(a).toEqual(b);
  });

  it('picks a different subset for a different seed (the hash matters)', () => {
    const a = teams.flatMap((t) => calledUpPlayers(t.players, 1).map((p) => p.id)).sort();
    const b = teams.flatMap((t) => calledUpPlayers(t.players, 2).map((p) => p.id)).sort();
    expect(a).not.toEqual(b);
  });
});

describe('paronMatchdays / isParonMatchday', () => {
  it('places one or two breaks around the thirds of the season', () => {
    expect(paronMatchdays(42)).toEqual([14, 28]);
    expect(isParonMatchday(14, 42)).toBe(true);
    expect(isParonMatchday(28, 42)).toBe(true);
    expect(isParonMatchday(15, 42)).toBe(false);
  });

  it('gives no break to a very short season', () => {
    expect(paronMatchdays(4)).toEqual([]);
    expect(isParonMatchday(2, 4)).toBe(false);
  });
});

describe('applyInternationalBreak', () => {
  const ctx = { seed: 7, totalMatchdays: 42, humanTeamId: 'H' };
  // media 99 + nationality => probability 1 (always called up); media 50 => never.
  const humanTeam = (): CompetitionTeam => ({
    id: 'H',
    nombre: 'Human',
    players: [mp('star', 99, { nacionalidad: 'España' }), mp('squad', 50, { fatigue: 40 })],
  });
  const rivalTeam = (): CompetitionTeam => ({
    id: 'R',
    nombre: 'Rival',
    players: [mp('rstar', 99, { nacionalidad: 'Brasil' })],
  });

  it('is a no-op with no notice on a non-parón matchday', () => {
    const teams = [humanTeam(), rivalTeam()];
    const out = applyInternationalBreak(teams, { ...ctx, matchday: 15 });
    expect(out.notice).toBeNull();
    expect(out.teams).toEqual(teams);
  });

  it('adds break fatigue to internationals only and reports the human notice on a parón', () => {
    const out = applyInternationalBreak([humanTeam(), rivalTeam()], { ...ctx, matchday: 14 });
    const human = out.teams.find((t) => t.id === 'H')!;
    const star = human.players.find((p) => p.id === 'star')!;
    const squad = human.players.find((p) => p.id === 'squad')!;
    expect(star.fatigue).toBe(FRESH_FATIGUE + INTERNATIONAL_BREAK_FATIGUE);
    expect(squad.fatigue).toBe(40); // untouched: not an international

    expect(out.notice).not.toBeNull();
    const notice = out.notice as CallUpNotice;
    expect(notice.matchday).toBe(14);
    expect(notice.players.map((p) => p.id)).toEqual(['star']);
    expect(notice.players[0]).toMatchObject({
      fatigueBefore: FRESH_FATIGUE,
      fatigueAfter: FRESH_FATIGUE + INTERNATIONAL_BREAK_FATIGUE,
    });
  });

  it('clamps stacked break fatigue to the [0,100] range', () => {
    const team: CompetitionTeam = {
      id: 'H',
      nombre: 'Human',
      players: [mp('star', 99, { fatigue: 90, nacionalidad: 'España' })],
    };
    const out = applyInternationalBreak([team], { ...ctx, matchday: 14 });
    const star = out.teams[0]!.players[0]!;
    expect(star.fatigue).toBe(clampFatigue(90 + INTERNATIONAL_BREAK_FATIGUE));
    expect(star.fatigue).toBe(100);
  });

  it('produces no notice when the human club has no international called up', () => {
    const team: CompetitionTeam = {
      id: 'H',
      nombre: 'Human',
      players: [mp('a', 60), mp('b', 55)],
    };
    const out = applyInternationalBreak([team], { ...ctx, matchday: 14 });
    expect(out.notice).toBeNull();
  });
});

describe('advanceMatchday integration', () => {
  const SEED = 4242;

  /** A team id that definitely has a call-up for SEED (so the notice fires). */
  function teamWithCallUps(): string {
    const base = newSeason(league, league.equipos[0]!.id, SEED);
    let best = base.teams[0]!;
    let bestCount = -1;
    for (const t of base.teams) {
      const n = calledUpPlayers(t.players, SEED).length;
      if (n > bestCount) {
        best = t;
        bestCount = n;
      }
    }
    expect(bestCount).toBeGreaterThan(0);
    return best.id;
  }

  it('fires the call-up notice on the parón matchday and applies the break fatigue in the real flow', () => {
    const humanId = teamWithCallUps();
    let s = newSeason(league, humanId, SEED);
    const [firstParon] = paronMatchdays(s.totalMatchdays);
    expect(firstParon).toBeGreaterThan(0);

    let notice: CallUpNotice | undefined;
    while (!isSeasonOver(s)) {
      const atParon = s.currentMatchday === firstParon;
      const step = advanceMatchday(s);
      s = step.state;
      if (atParon) {
        notice = step.callUp;
        break;
      }
      // Before the parón there is never a call-up notice.
      expect(step.callUp).toBeUndefined();
    }

    expect(notice).toBeDefined();
    expect(notice!.matchday).toBe(firstParon);
    expect(notice!.players.length).toBeGreaterThan(0);
    for (const p of notice!.players) {
      expect(p.fatigueAfter).toBe(clampFatigue(p.fatigueBefore + INTERNATIONAL_BREAK_FATIGUE));
      expect(p.fatigueAfter).toBeGreaterThan(p.fatigueBefore);
    }
  });

  it('reconstructs identical state on replay past a parón (deterministic, unpersisted)', () => {
    const humanId = league.equipos[0]!.id;
    const play = (): CompetitionTeam[] => {
      let s = newSeason(league, humanId, 777);
      // 16 > the first parón (14 for a 42-matchday season): crosses the break.
      for (let i = 0; i < 16 && !isSeasonOver(s); i += 1) s = advanceMatchday(s).state;
      return s.teams;
    };
    expect(play()).toEqual(play());
  });
});
