import { describe, it, expect } from 'vitest';
import type { CompetitionTeam, MatchPlayer } from '@engine';
import type { TournamentDef } from '../tournament';
import type { CareerTactics } from './types';
import {
  advanceSeleccionPhase,
  buildEdition,
  distributeGroups,
  finalsFieldSize,
  nextSeleccionCycle,
  newSeleccionCareer,
  qualifyingGroupCount,
  restoreSeleccion,
  seleccionDef,
  serializeSeleccion,
  setSeleccionTactics,
  SeleccionSaveSchema,
  NOT_QUALIFIED_FINISH,
  FRIENDLY_COUNT,
} from './seleccion';

function player(id: string, line: MatchPlayer['posicion'], media: number): MatchPlayer {
  return {
    id,
    nombre: id,
    posicion: line,
    esPortero: line === 'POR',
    media,
    remate: media,
    ofensivo: media,
    pase: media,
    entrada: media,
    porteria: line === 'POR' ? media : 10,
  };
}

/** A minimal 11-man national team of the given uniform strength. */
function team(id: string, media: number): CompetitionTeam {
  const players = [player(`${id}-gk`, 'POR', media)];
  for (let i = 0; i < 10; i += 1) {
    const line = i < 4 ? 'DEF' : i < 8 ? 'MED' : 'DEL';
    players.push(player(`${id}-p${i}`, line, media));
  }
  return { id, nombre: id.toUpperCase(), players };
}

/** A pool of `n` nations; `human` (if in range) is given `humanMedia`, the rest `restMedia`. */
function pool(n: number, opts: { human?: string; humanMedia?: number; restMedia?: number } = {}): CompetitionTeam[] {
  const restMedia = opts.restMedia ?? 60;
  const teams = Array.from({ length: n }, (_, i) => team(`n${i + 1}`, restMedia + (i % 5)));
  if (opts.human) teams.push(team(opts.human, opts.humanMedia ?? restMedia));
  return teams;
}

/** A tiny tournament def so buildEdition unit tests stay fast (F=8, Q=4). */
const miniDef: TournamentDef = { id: 'euro2000', nombre: 'Mini', dbId: 'x', finalistIds: [], numGroups: 2 };

describe('distributeGroups', () => {
  it('splits ids into the requested number of groups, using every id once', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `n${i + 1}`);
    const groups = distributeGroups(ids, 4, 2024);
    expect(groups).toHaveLength(4);
    expect(groups.flat().sort()).toEqual([...ids].sort());
  });

  it('keeps group sizes within one of each other', () => {
    const ids = Array.from({ length: 51 }, (_, i) => `n${i + 1}`);
    const groups = distributeGroups(ids, 8, 7);
    const sizes = groups.map((g) => g.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(sizes.reduce((s, x) => s + x, 0)).toBe(51);
  });

  it('is deterministic', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `n${i + 1}`);
    expect(distributeGroups(ids, 4, 99)).toEqual(distributeGroups(ids, 4, 99));
  });
});

describe('finals field sizing', () => {
  it('finals field is 4 per finals group, qualifying groups are half of that', () => {
    expect(finalsFieldSize(seleccionDef('euro2000'))).toBe(16);
    expect(qualifyingGroupCount(seleccionDef('euro2000'))).toBe(8);
    expect(finalsFieldSize(seleccionDef('mundial98'))).toBe(32);
    expect(qualifyingGroupCount(seleccionDef('mundial98'))).toBe(16);
  });
});

describe('buildEdition', () => {
  it('qualifies exactly the finals field (top two of every qualifying group)', () => {
    const teams = pool(19, { human: 'esp', humanMedia: 70 }); // 20 nations, F=8, Q=4
    const ed = buildEdition(teams, miniDef, 'esp', 2024, 1);
    expect(ed.qualifiedIds).toHaveLength(finalsFieldSize(miniDef));
    expect(new Set(ed.qualifiedIds).size).toBe(ed.qualifiedIds.length); // no duplicates
  });

  it('plays the warm-up friendlies against distinct opponents (never itself)', () => {
    const teams = pool(19, { human: 'esp', humanMedia: 70 });
    const ed = buildEdition(teams, miniDef, 'esp', 1, 1);
    expect(ed.friendlies).toHaveLength(FRIENDLY_COUNT);
    for (const f of ed.friendlies) {
      expect(f.homeId).toBe('esp');
      expect(f.opponentId).not.toBe('esp');
      expect(f.match.homeId).toBe('esp');
    }
    expect(new Set(ed.friendlies.map((f) => f.opponentId)).size).toBe(FRIENDLY_COUNT);
  });

  it('is deterministic (same seed+cycle ⇒ identical edition)', () => {
    const teams = pool(19, { human: 'esp', humanMedia: 70 });
    expect(buildEdition(teams, miniDef, 'esp', 2024, 1)).toEqual(
      buildEdition(teams, miniDef, 'esp', 2024, 1),
    );
  });

  it('a dominant nation finishes top of its group and qualifies, then plays the final', () => {
    const teams = pool(19, { human: 'esp', humanMedia: 99, restMedia: 45 });
    const ed = buildEdition(teams, miniDef, 'esp', 2024, 1);
    expect(ed.humanGroupPosition).toBe(1);
    expect(ed.qualified).toBe(true);
    expect(ed.final).toBeDefined();
    expect(ed.finish).not.toBe(NOT_QUALIFIED_FINISH);
  });

  it('a hopeless minnow misses out: no final, "No clasificado"', () => {
    const teams = pool(19, { human: 'min', humanMedia: 20, restMedia: 85 });
    const ed = buildEdition(teams, miniDef, 'min', 2024, 1);
    expect(ed.qualified).toBe(false);
    expect(ed.final).toBeUndefined();
    expect(ed.finish).toBe(NOT_QUALIFIED_FINISH);
    expect(ed.humanGroupPosition).toBeGreaterThan(2);
  });

  it('applies the convocatoria: a different formation changes the human results', () => {
    const teams = pool(19, { human: 'esp', humanMedia: 70 });
    const plain = buildEdition(teams, miniDef, 'esp', 2024, 1);
    const attacking: CareerTactics = { formation: '3-4-3' };
    const withTactics = buildEdition(teams, miniDef, 'esp', 2024, 1, attacking);
    // Tactics only touch the human's own matches, so groups/champion of the rest
    // are unaffected is NOT asserted here; we only need proof the convocatoria bit.
    expect(JSON.stringify(withTactics.group.results)).not.toBe(JSON.stringify(plain.group.results));
  });

  it('throws when the human nation is not in the pool', () => {
    const teams = pool(19, { human: 'esp' });
    expect(() => buildEdition(teams, miniDef, 'nope', 1, 1)).toThrow(/not in pool/i);
  });
});

describe('seleccion career flow', () => {
  const def = seleccionDef('euro2000'); // Q=8, F=16

  it('a new career starts at cycle 1 in the convocatoria phase with empty history', () => {
    const teams = pool(23, { human: 'esp', humanMedia: 99, restMedia: 45 }); // 24 nations → groups of 3
    const career = newSeleccionCareer(teams, def, 'esp', 2024);
    expect(career.cycle).toBe(1);
    expect(career.phase).toBe('convocatoria');
    expect(career.history).toEqual([]);
    expect(career.palmares).toEqual([]);
    expect(career.edition.cycle).toBe(1);
  });

  it('advances through every phase to "fin" when qualified (final included)', () => {
    const teams = pool(23, { human: 'esp', humanMedia: 99, restMedia: 45 });
    let career = newSeleccionCareer(teams, def, 'esp', 2024);
    expect(career.edition.qualified).toBe(true);
    const seen = [career.phase];
    for (let i = 0; i < 10 && career.phase !== 'fin'; i += 1) {
      career = advanceSeleccionPhase(career);
      seen.push(career.phase);
    }
    expect(seen).toEqual(['convocatoria', 'amistosos', 'clasificacion', 'final', 'fin']);
  });

  it('skips the final phase when the human did not qualify', () => {
    const teams = pool(23, { human: 'min', humanMedia: 20, restMedia: 85 });
    let career = newSeleccionCareer(teams, def, 'min', 2024);
    expect(career.edition.qualified).toBe(false);
    const seen = [career.phase];
    for (let i = 0; i < 10 && career.phase !== 'fin'; i += 1) {
      career = advanceSeleccionPhase(career);
      seen.push(career.phase);
    }
    expect(seen).toEqual(['convocatoria', 'amistosos', 'clasificacion', 'fin']);
  });

  it('setSeleccionTactics changes the edition in convocatoria, but is locked afterwards', () => {
    const teams = pool(23, { human: 'esp', humanMedia: 70, restMedia: 68 });
    const career = newSeleccionCareer(teams, def, 'esp', 2024);
    const tuned = setSeleccionTactics(career, teams, { formation: '3-4-3' });
    expect(tuned.tactics).toEqual({ formation: '3-4-3' });
    expect(JSON.stringify(tuned.edition.group.results)).not.toBe(
      JSON.stringify(career.edition.group.results),
    );
    // Once under way the convocatoria is locked (no retroactive rewrite).
    const underway = advanceSeleccionPhase(tuned); // -> amistosos
    const attempt = setSeleccionTactics(underway, teams, { formation: '5-4-1' });
    expect(attempt).toBe(underway);
  });

  it('nextSeleccionCycle records history, awards titles and starts the next edition', () => {
    const teams = pool(23, { human: 'esp', humanMedia: 99, restMedia: 40 });
    let career = newSeleccionCareer(teams, def, 'esp', 2024);
    // Run the edition to the end.
    while (career.phase !== 'fin') career = advanceSeleccionPhase(career);
    const wasChampion = career.edition.champion;
    const next = nextSeleccionCycle(career, teams);
    expect(next.cycle).toBe(2);
    expect(next.phase).toBe('convocatoria');
    expect(next.history).toHaveLength(1);
    expect(next.history[0]!.cycle).toBe(1);
    expect(next.palmares.length).toBe(wasChampion ? 1 : 0);
    expect(next.edition.cycle).toBe(2);
  });

  it('refuses to advance to the next cycle before the edition is finished', () => {
    const teams = pool(23, { human: 'esp', humanMedia: 99, restMedia: 40 });
    const career = newSeleccionCareer(teams, def, 'esp', 2024); // phase 'convocatoria'
    expect(nextSeleccionCycle(career, teams)).toBe(career);
  });
});

describe('seleccion persistence (versioned snapshot + replay)', () => {
  const def = seleccionDef('euro2000');

  function finishedCareer() {
    const teams = pool(23, { human: 'esp', humanMedia: 99, restMedia: 40 });
    let career = newSeleccionCareer(teams, def, 'esp', 2024);
    career = setSeleccionTactics(career, teams, { formation: '4-3-3' });
    while (career.phase !== 'fin') career = advanceSeleccionPhase(career);
    career = nextSeleccionCycle(career, teams); // now cycle 2, with history/palmarés
    career = advanceSeleccionPhase(career); // -> amistosos (mid-edition)
    return { teams, career };
  }

  it('round-trips a career: decisions, history and palmarés, re-deriving the edition', () => {
    const { teams, career } = finishedCareer();
    const save = serializeSeleccion(career);
    expect(save.version).toBe(1);

    const restored = restoreSeleccion(save, teams);
    expect(restored.seed).toBe(career.seed);
    expect(restored.humanNationId).toBe(career.humanNationId);
    expect(restored.cycle).toBe(career.cycle);
    expect(restored.phase).toBe(career.phase);
    expect(restored.tactics).toEqual(career.tactics);
    expect(restored.history).toEqual(career.history);
    expect(restored.palmares).toEqual(career.palmares);
    // The in-progress edition is re-derived identically (not persisted).
    expect(restored.edition).toEqual(career.edition);
  });

  it('is deterministic: restoring the same save twice yields identical careers', () => {
    const { teams, career } = finishedCareer();
    const save = serializeSeleccion(career);
    expect(restoreSeleccion(save, teams)).toEqual(restoreSeleccion(save, teams));
  });

  it('does NOT persist the derived edition (payload stays small)', () => {
    const { career } = finishedCareer();
    const save = serializeSeleccion(career);
    expect(JSON.stringify(save)).not.toMatch(/"friendlies"|"knockout"|"results"/);
  });

  it('defaults history/palmarés to [] for a minimal save', () => {
    const teams = pool(23, { human: 'esp', humanMedia: 99, restMedia: 40 });
    const minimal = {
      version: 1 as const,
      seed: 5,
      humanNationId: 'esp',
      tournamentId: 'euro2000' as const,
      cycle: 1,
      phase: 'convocatoria' as const,
    };
    const restored = restoreSeleccion(minimal, teams);
    expect(restored.history).toEqual([]);
    expect(restored.palmares).toEqual([]);
  });

  it('rejects a corrupt payload via the Zod schema', () => {
    const { career } = finishedCareer();
    const good = serializeSeleccion(career);
    expect(() => SeleccionSaveSchema.parse({ ...good, version: 2 })).toThrow();
    expect(() => SeleccionSaveSchema.parse({ ...good, cycle: 0 })).toThrow();
    expect(() => SeleccionSaveSchema.parse({ ...good, tournamentId: 'nope' })).toThrow();
  });
});
