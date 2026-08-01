import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import { newCareer } from './career';
import {
  observePlayer,
  playerScoutReport,
  abilityEstimate,
  scoutingObservations,
  scoutTargets,
  REVEAL_THRESHOLD,
} from './ojeo';
import type { CareerState } from './types';

const league = loadPrimera9697();
const humanTeamId = league.equipos[0]?.id;
if (!humanTeamId) throw new Error('league has no teams');

function freshCareer(): CareerState {
  return newCareer(league, humanTeamId, 2024);
}

/** A rival player's id (first player of some non-human club). */
function aRivalId(career: CareerState): string {
  const rival = career.teams.find((t) => t.id !== career.humanTeamId);
  const id = rival?.players[0]?.id;
  if (!id) throw new Error('no rival player');
  return id;
}

/** A player id from the human's own squad. */
function anOwnId(career: CareerState): string {
  const own = career.teams.find((t) => t.id === career.humanTeamId);
  const id = own?.players[0]?.id;
  if (!id) throw new Error('no own player');
  return id;
}

describe('observePlayer', () => {
  it('records a first observation for a rival and does not mutate the input', () => {
    const career = freshCareer();
    const snap = JSON.parse(JSON.stringify(career.scouting));
    const rival = aRivalId(career);

    const res = observePlayer(career, rival);
    expect(res.ok).toBe(true);
    expect(res.career.scouting[rival]).toEqual({ observations: 1, lastSeason: career.seasonNumber });
    // Input untouched (pure).
    expect(career.scouting).toEqual(snap);
    expect(scoutingObservations(res.career, rival)).toBe(1);
  });

  it('refuses to ojear your own player', () => {
    const career = freshCareer();
    const res = observePlayer(career, anOwnId(career));
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('propio');
    expect(res.career).toBe(career);
  });

  it('refuses an unknown player id', () => {
    const career = freshCareer();
    const res = observePlayer(career, 'no-such-player');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('no-encontrado');
  });

  it('refuses a second observation in the same season (bounded by time, not clicks)', () => {
    const career = freshCareer();
    const rival = aRivalId(career);
    const once = observePlayer(career, rival);
    expect(once.ok).toBe(true);
    const twice = observePlayer(once.career, rival);
    expect(twice.ok).toBe(false);
    expect(twice.reason).toBe('ya-ojeado');
    // Still exactly one observation on record.
    expect(scoutingObservations(twice.career, rival)).toBe(1);
  });

  it('accumulates observations across seasons', () => {
    const career = freshCareer();
    const rival = aRivalId(career);
    const s1 = observePlayer(career, rival).career;
    // Simulate the next career season (only seasonNumber matters for the gate).
    const s2base: CareerState = { ...s1, seasonNumber: s1.seasonNumber + 1 };
    const s2 = observePlayer(s2base, rival).career;
    expect(scoutingObservations(s2, rival)).toBe(2);
    expect(s2.scouting[rival]?.lastSeason).toBe(s2base.seasonNumber);
  });
});

describe('playerScoutReport', () => {
  it('hides the exact media until REVEAL_THRESHOLD observations', () => {
    let career = freshCareer();
    const rival = aRivalId(career);
    const player = career.teams
      .flatMap((t) => t.players)
      .find((p) => p.id === rival);
    if (!player) throw new Error('player not found');

    // Unscouted: media hidden, still gets a fallible ability band.
    const before = playerScoutReport(career, player);
    expect(before.revealed).toBe(false);
    expect(before.media).toBeNull();
    expect(before.ability.low).toBeLessThanOrEqual(before.ability.high);

    // Observe REVEAL_THRESHOLD times across seasons.
    for (let i = 0; i < REVEAL_THRESHOLD; i += 1) {
      const bumped: CareerState = { ...career, seasonNumber: career.seasonNumber + i };
      career = observePlayer(bumped, rival).career;
    }
    const after = playerScoutReport(career, player);
    expect(after.observations).toBe(REVEAL_THRESHOLD);
    expect(after.revealed).toBe(true);
    expect(after.media).toBe(player.media);
  });

  it('flags whether the player was already scouted this season', () => {
    const career = freshCareer();
    const rival = aRivalId(career);
    const player = career.teams.flatMap((t) => t.players).find((p) => p.id === rival)!;
    expect(playerScoutReport(career, player).scoutedThisSeason).toBe(false);
    const after = observePlayer(career, rival).career;
    expect(playerScoutReport(after, player).scoutedThisSeason).toBe(true);
  });
});

describe('abilityEstimate', () => {
  it('is deterministic and returns low <= high within [0,99]', () => {
    const career = freshCareer();
    const player = career.teams.flatMap((t) => t.players)[0]!;
    for (let obs = 0; obs <= 5; obs += 1) {
      const a = abilityEstimate(player, obs, 7);
      const b = abilityEstimate(player, obs, 7);
      expect(a).toEqual(b);
      expect(a.low).toBeLessThanOrEqual(a.high);
      expect(a.low).toBeGreaterThanOrEqual(0);
      expect(a.high).toBeLessThanOrEqual(99);
    }
  });

  it('narrows the band on average as observations increase', () => {
    const career = freshCareer();
    const players = career.teams.flatMap((t) => t.players).slice(0, 40);
    let wide = 0;
    let narrow = 0;
    for (const p of players) {
      const r0 = abilityEstimate(p, 0, career.seed);
      const r5 = abilityEstimate(p, 5, career.seed);
      wide += r0.high - r0.low;
      narrow += r5.high - r5.low;
    }
    expect(narrow).toBeLessThan(wide);
  });

  it('does not mutate its input player', () => {
    const career = freshCareer();
    const player = career.teams.flatMap((t) => t.players)[0]!;
    const snap = JSON.parse(JSON.stringify(player));
    abilityEstimate(player, 3, 11);
    expect(player).toEqual(snap);
  });
});

describe('scoutTargets', () => {
  it('lists only rival players and surfaces the most-observed first', () => {
    const career = freshCareer();
    const rival = aRivalId(career);
    const scouted = observePlayer(career, rival).career;

    const targets = scoutTargets(scouted);
    // No human-club players are ever a scouting target.
    expect(targets.some((t) => t.clubId === career.humanTeamId)).toBe(false);
    // The one player we ojeado sorts to the very top.
    expect(targets[0]?.player.id).toBe(rival);
    expect(targets[0]?.report.observations).toBe(1);
  });
});
