/**
 * Integration: injuries and suspensions across a real Liga 96/97 season.
 *
 * The load-bearing invariant is that an unavailable player NEVER takes the field:
 * every event a matchday produces must come from a player who was fit that
 * matchday. That single check proves the auto-XI/lineup filter works end to end.
 */
import { describe, it, expect } from 'vitest';
import { loadPrimera9697 } from '@data';
import { newSeason, advanceMatchday, isAvailable, isSuspended, type SeasonState } from '@game';

const league = loadPrimera9697();
const firstTeam = league.equipos[0];
if (!firstTeam) throw new Error('league has no teams');
const humanTeamId = firstTeam.id;

interface Trace {
  final: SeasonState;
  injuriesSeen: number;
  suspensionsSeen: number;
  /** True if any event ever came from an unavailable player (should stay false). */
  ineligibleEverPlayed: boolean;
}

function playSeason(seed: number): Trace {
  let state = newSeason(league, humanTeamId, seed);
  let injuriesSeen = 0;
  let suspensionsSeen = 0;
  let ineligibleEverPlayed = false;
  let guard = 0;
  while (state.currentMatchday <= state.totalMatchdays) {
    const md = state.currentMatchday;
    const availBefore = state.availability;
    const step = advanceMatchday(state);
    for (const r of step.played) {
      for (const e of r.events) {
        // Nobody unavailable this matchday may generate an event.
        if (!isAvailable(availBefore[e.playerId], md)) ineligibleEverPlayed = true;
        if (e.type === 'injury') injuriesSeen += 1;
      }
    }
    // Count fresh suspensions that appeared after this matchday.
    for (const [id, a] of Object.entries(step.state.availability)) {
      if (isSuspended(a) && !isSuspended(availBefore[id])) suspensionsSeen += 1;
    }
    state = step.state;
    guard += 1;
    if (guard > 100) throw new Error('season did not terminate');
  }
  return { final: state, injuriesSeen, suspensionsSeen, ineligibleEverPlayed };
}

describe('injuries & suspensions: full-season integration', () => {
  const trace = playSeason(19_9697);

  it('never fields an injured or suspended player', () => {
    expect(trace.ineligibleEverPlayed).toBe(false);
  });

  it('produces injuries and suspensions over a real season', () => {
    expect(trace.injuriesSeen).toBeGreaterThan(0);
    expect(trace.suspensionsSeen).toBeGreaterThan(0);
  });

  it('is deterministic: same seed replays identical availability and results', () => {
    const a = playSeason(4242);
    const b = playSeason(4242);
    expect(a.final.availability).toEqual(b.final.availability);
    expect(JSON.stringify(a.final.results)).toBe(JSON.stringify(b.final.results));
  });
});
