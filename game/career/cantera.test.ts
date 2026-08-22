import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import type { Attributes } from '@data';
import { newCareer } from './career';
import { advanceMatchday } from '../season/season';
import { potentialOverall } from './scouting';
import {
  generateYouthBatch,
  rolloverYouth,
  promoteProspect,
  discardProspect,
  prospectObservedSeasons,
  prospectScoutRange,
  YOUTH_BATCH_MIN,
  YOUTH_BATCH_MAX,
  YOUTH_MAX_SEASONS_IN_ACADEMY,
  type YouthGenParams,
} from './cantera';

const league = loadPrimera9697();
const humanTeamId = league.equipos[0]!.id;

const params = (over: Partial<YouthGenParams> = {}): YouthGenParams => ({
  seed: 2024,
  seasonNumber: 1,
  temporada: league.temporada,
  humanTeamId,
  ...over,
});

const ATTR_KEYS: readonly (keyof Attributes)[] = [
  'calidad', 'agresividad', 'resistencia', 'velocidad', 'fisico',
  'remate', 'ofensivo', 'pase', 'entrada', 'porteria',
];

describe('generateYouthBatch', () => {
  it('is deterministic for the same seed/season/club', () => {
    expect(generateYouthBatch(params())).toEqual(generateYouthBatch(params()));
  });

  it('differs across seasons and clubs', () => {
    const a = generateYouthBatch(params({ seasonNumber: 1 }));
    const b = generateYouthBatch(params({ seasonNumber: 2 }));
    const c = generateYouthBatch(params({ humanTeamId: league.equipos[1]!.id }));
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('breeds between MIN and MAX juveniles', () => {
    for (let s = 1; s <= 30; s += 1) {
      const batch = generateYouthBatch(params({ seasonNumber: s, seed: 7 + s }));
      expect(batch.length).toBeGreaterThanOrEqual(YOUTH_BATCH_MIN);
      expect(batch.length).toBeLessThanOrEqual(YOUTH_BATCH_MAX);
    }
  });

  it('produces young players (16-18) with a potential ceiling >= current and media <= potential', () => {
    for (let s = 1; s <= 20; s += 1) {
      const batch = generateYouthBatch(params({ seasonNumber: s, seed: 100 + s }));
      const startYear = 1996; // 96/97
      for (const { player, entrySeason } of batch) {
        expect(entrySeason).toBe(s);
        // Age 16-18 at the season start.
        const birthYear = Number(player.fechaNacimiento!.slice(0, 4));
        const age = startYear - birthYear;
        expect(age).toBeGreaterThanOrEqual(16);
        expect(age).toBeLessThanOrEqual(18);
        // Potential set, and never below the current value on any attribute.
        expect(player.potencial).toBeDefined();
        for (const key of ATTR_KEYS) {
          const cur = player.atributos[key];
          const ceil = player.potencial![key];
          if (cur === null) continue;
          expect(ceil).not.toBeNull();
          expect(ceil as number).toBeGreaterThanOrEqual(cur);
        }
        // media is the current overall, at or below the (hidden) potential overall.
        const curOverall = potentialOverall(player.atributos, player.posicion);
        const potOverall = potentialOverall(player.potencial!, player.posicion);
        expect(player.media).toBe(curOverall);
        expect(player.media).toBeLessThanOrEqual(potOverall);
      }
    }
  });

  it('gives every prospect a unique, cantera-prefixed id', () => {
    const batch = generateYouthBatch(params());
    const ids = batch.map((p) => p.player.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('cantera-')).toBe(true);
  });
});

describe('prospect scouting', () => {
  it('observed seasons grows from 0 at entry', () => {
    const [prospect] = generateYouthBatch(params({ seasonNumber: 3 }));
    expect(prospectObservedSeasons(prospect!, 3)).toBe(0);
    expect(prospectObservedSeasons(prospect!, 5)).toBe(2);
  });

  it('returns a valid, deterministic potential range', () => {
    const [prospect] = generateYouthBatch(params());
    const r1 = prospectScoutRange(prospect!, 2024, 1);
    const r2 = prospectScoutRange(prospect!, 2024, 1);
    expect(r1).toEqual(r2);
    expect(r1.low).toBeLessThanOrEqual(r1.high);
    expect(r1.low).toBeGreaterThanOrEqual(0);
    expect(r1.high).toBeLessThanOrEqual(99);
  });
});

describe('rolloverYouth', () => {
  it('drops prospects that overstayed and appends a fresh hornada', () => {
    const s1 = generateYouthBatch(params({ seasonNumber: 1 }));
    // Advance to season 1 + MAX: the season-1 intake must be gone.
    const nextSeason = 1 + YOUTH_MAX_SEASONS_IN_ACADEMY;
    const rolled = rolloverYouth(s1, params({ seasonNumber: nextSeason }));
    const oldIds = new Set(s1.map((p) => p.player.id));
    expect(rolled.every((p) => !oldIds.has(p.player.id))).toBe(true);
    expect(rolled.length).toBeGreaterThanOrEqual(YOUTH_BATCH_MIN);
  });

  it('keeps recent prospects one more season', () => {
    const s1 = generateYouthBatch(params({ seasonNumber: 1 }));
    const rolled = rolloverYouth(s1, params({ seasonNumber: 2 }));
    for (const p of s1) {
      expect(rolled.some((r) => r.player.id === p.player.id)).toBe(true);
    }
  });
});

describe('promoteProspect / discardProspect', () => {
  it('newCareer seeds an opening hornada', () => {
    const career = newCareer(league, humanTeamId, 2024);
    expect(career.youthProspects.length).toBeGreaterThanOrEqual(YOUTH_BATCH_MIN);
  });

  it('promotes a prospect into the squad and the in-progress season without resetting matchdays', () => {
    let career = newCareer(league, humanTeamId, 2024);
    // Play a few matchdays so we can prove promotion does not rewind the season.
    for (let i = 0; i < 5; i += 1) career = { ...career, season: advanceMatchday(career.season).state };
    const matchdayBefore = career.season.currentMatchday;
    const resultsBefore = career.season.results.length;

    const prospect = career.youthProspects[0]!;
    const squadBefore = career.teams.find((t) => t.id === humanTeamId)!.players.length;

    const next = promoteProspect(career, prospect.player.id);

    // Removed from the academy, added to the source-of-truth squad.
    expect(next.youthProspects.some((p) => p.player.id === prospect.player.id)).toBe(false);
    const squad = next.teams.find((t) => t.id === humanTeamId)!.players;
    expect(squad.length).toBe(squadBefore + 1);
    expect(squad.some((p) => p.id === prospect.player.id)).toBe(true);
    // Added to the derived competition team too (selectable next matchday).
    const seasonTeam = next.season.teams.find((t) => t.id === humanTeamId)!;
    expect(seasonTeam.players.some((p) => p.id === prospect.player.id)).toBe(true);
    // Season progress untouched.
    expect(next.season.currentMatchday).toBe(matchdayBefore);
    expect(next.season.results.length).toBe(resultsBefore);
  });

  it('promoting an unknown id is a no-op', () => {
    const career = newCareer(league, humanTeamId, 2024);
    expect(promoteProspect(career, 'does-not-exist')).toEqual(career);
  });

  it('discards a prospect from the academy only', () => {
    const career = newCareer(league, humanTeamId, 2024);
    const prospect = career.youthProspects[0]!;
    const squadBefore = career.teams.find((t) => t.id === humanTeamId)!.players.length;
    const next = discardProspect(career, prospect.player.id);
    expect(next.youthProspects.some((p) => p.player.id === prospect.player.id)).toBe(false);
    expect(next.teams.find((t) => t.id === humanTeamId)!.players.length).toBe(squadBefore);
  });
});
