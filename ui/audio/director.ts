/**
 * The audio director: the one place that decides WHEN the game makes noise, so
 * no screen has to. It listens to three things and turns them into cues:
 *
 *  1. Clicks anywhere in the document (one delegated listener): a tick on every
 *     button/link, a blip on primary actions. Screens opt out or pick another
 *     sound with a `data-sound` attribute (see README).
 *  2. The game store: the stadium ambience while a match is on screen, and the
 *     final whistle (plus a cheer if you won) when a matchday is simulated
 *     without watching.
 *  3. The live match: the match screen reveals the match beat by beat and shows
 *     the minute of the latest beat in its scoreboard (`.sb__status`: "14'", then
 *     "Final"). The director reads that clock and looks up the real events of the
 *     match (`viewingMatch.events`) the clock just passed, so goals, cards and the
 *     whistles land exactly when the screen shows them, in the teletipo view, the
 *     2D viewer, at any speed, paused, or skipped to the end. `director.test.tsx`
 *     renders the real match screen to pin that contract.
 *
 * Plain TypeScript: it talks to the sound engine through `SoundPlayer` and to
 * the store through the tiny `DirectorStore` shape, so tests need neither.
 */
import type { Screen } from '@app/navigation';
import type { EventType, MatchEvent, MatchResult } from '@engine';
import { SOUNDS, isSoundId, type SoundId } from './catalog';
import type { SoundPlayer } from './player';

/** The slice of the game store the director reads. */
export interface DirectorState {
  screen: Screen;
  lastResults: readonly MatchResult[];
  viewingMatch: MatchResult | null;
  career: { humanTeamId: string } | null;
}

export interface DirectorStore {
  getState(): DirectorState;
  subscribe(listener: (state: DirectorState, prev: DirectorState) => void): () => void;
}

export interface DirectorOptions {
  player: SoundPlayer;
  store: DirectorStore;
  /** Defaults to the global document. */
  doc?: Document;
}

// ───────────────────────────────────────────── tuning

/** Kick-off whistle waits a beat so it does not collide with the "play" blip. */
const KICKOFF_DELAY_MS = 250;
/** A second cue in the same batch trails the first by this much. */
const STAGGER_MS = 350;
/** A batch this big is a "show me everything" jump, not live play. */
const BULK_BEATS = 4;
/** The cheer for a win follows the final whistle by this much. */
const CHEER_DELAY_MS = 900;
/** Final whistle after a simulated matchday waits for the button blip to clear. */
const MATCHDAY_END_DELAY_MS = 250;
const CROWD_IN_MS = 1500;
const CROWD_OUT_MS = 800;
/** After the final whistle the crowd lingers a little before fading out. */
const CROWD_FINAL_OUT_MS = 2500;

// ───────────────────────────────────────────── clicks

const CLICKABLE = [
  'button',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="link"]',
  'a[href]',
  'summary',
  'input[type="checkbox"]',
  'input[type="radio"]',
].join(',');

function isElement(target: EventTarget | null): target is Element {
  return target !== null && (target as Node).nodeType === 1;
}

/**
 * Which sound a click deserves, or null for none. A click anywhere inside an
 * interactive control counts. `data-sound` on the control or an ancestor (the
 * nearest one wins) can silence it (`off`) or swap in another catalogue sound.
 */
export function soundForClick(target: EventTarget | null): SoundId | null {
  if (!isElement(target)) return null;
  const control = target.closest(CLICKABLE);
  if (!control) return null;
  if (control.matches(':disabled, [aria-disabled="true"]') || control.closest('fieldset[disabled]')) {
    return null;
  }
  const tagged = target.closest('[data-sound]');
  if (tagged) {
    const value = tagged.getAttribute('data-sound');
    if (value === 'off') return null;
    if (isSoundId(value) && !SOUNDS[value].loop) return value;
  }
  return control.classList.contains('retro-btn--primary') ? 'confirm' : 'click';
}

// ───────────────────────────────────────────── the live match

/** What the scoreboard clock says: the minute of the latest revealed beat, or the end. */
export type ScoreboardClock = { kind: 'minute'; minute: number } | { kind: 'final' };

/** The element of the match screen's scoreboard that carries the clock. */
const CLOCK_SELECTOR = '.sb__status';

/** Read the clock text ("14'" / "Final"); null for anything else. */
export function parseScoreboardClock(text: string | null | undefined): ScoreboardClock | null {
  const t = (text ?? '').trim();
  if (/^final$/i.test(t)) return { kind: 'final' };
  const minute = /^(\d{1,3})\s*['’′´]?$/.exec(t);
  return minute ? { kind: 'minute', minute: Number(minute[1]) } : null;
}

/** A beat of a match as the director names it: an engine event, or the two bookends. */
export type BeatKind = EventType | 'kickoff' | 'final';

/**
 * The beats the clock uncovered when it moved from `from` (the last minute seen;
 * -1 = nothing seen yet) to `to`, in the order they happened. The first reading
 * brings the kick-off; reaching the end brings everything left plus the final.
 */
export function beatsBetween(events: readonly MatchEvent[], from: number, to: ScoreboardClock): BeatKind[] {
  const beats: BeatKind[] = [];
  if (from < 0) beats.push('kickoff');
  for (const event of events) {
    if (event.min > from && (to.kind === 'final' || event.min <= to.minute)) beats.push(event.type);
  }
  if (to.kind === 'final') beats.push('final');
  return beats;
}

interface BeatCue {
  id: SoundId;
  /** Which cue wins when a batch holds several. */
  priority: number;
  delayMs: number;
}

/**
 * The beats that make a sound. Typed on `BeatKind`, so renaming an engine event
 * type breaks `tsc` here instead of silently muting a sound.
 */
const BEAT_CUES: Partial<Record<BeatKind, BeatCue>> = {
  final: { id: 'whistle-end', priority: 5, delayMs: 0 },
  goal: { id: 'goal', priority: 4, delayMs: 0 },
  red: { id: 'card-red', priority: 3, delayMs: 0 },
  secondYellow: { id: 'card-red', priority: 3, delayMs: 0 },
  yellow: { id: 'card-yellow', priority: 2, delayMs: 0 },
  kickoff: { id: 'whistle-start', priority: 1, delayMs: KICKOFF_DELAY_MS },
};

export interface Cue {
  id: SoundId;
  delayMs: number;
}

/**
 * Sounds for a batch of beats the clock uncovered together. Live play uncovers
 * one or two at a time, so this is usually a single cue. A bigger batch means the
 * screen jumped ahead (skip to the end, a hidden tab): then only the final whistle
 * is worth hearing, and only if the match actually ended in it.
 */
export function cuesForBatch(beats: readonly BeatKind[]): Cue[] {
  if (beats.includes('final') && beats.length > 1) return [{ id: 'whistle-end', delayMs: 0 }];
  if (beats.length >= BULK_BEATS) return [];

  const best = new Map<SoundId, BeatCue>();
  for (const beat of beats) {
    const cue = BEAT_CUES[beat];
    if (!cue) continue;
    const current = best.get(cue.id);
    if (!current || cue.priority > current.priority) best.set(cue.id, cue);
  }
  return [...best.values()]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
    .map((cue, i) => ({ id: cue.id, delayMs: cue.delayMs + i * STAGGER_MS }));
}

/** How the human side fared in a match, or null if they are not in it. */
export function humanResult(
  match: MatchResult | null | undefined,
  humanTeamId: string | undefined,
): 'win' | 'draw' | 'loss' | null {
  if (!match || !humanTeamId) return null;
  const home = match.homeId === humanTeamId;
  const away = match.awayId === humanTeamId;
  if (!home && !away) return null;
  const mine = home ? match.homeGoals : match.awayGoals;
  const theirs = home ? match.awayGoals : match.homeGoals;
  return mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
}

// ───────────────────────────────────────────── the director

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;

/** Stand-in "minute" for the end of the match, past any real one. */
const FINAL_MINUTE = 1000;

const isLive = (s: DirectorState): boolean => s.screen === 'match' && s.viewingMatch !== null;

/** Start directing the game's sound. Returns the function that stops it. */
export function startAudioDirector({ player, store, doc = document }: DirectorOptions): () => void {
  type Timers = Set<ReturnType<typeof setTimeout>>;
  const timers: Timers = new Set();
  /** Cues of the live match still waiting to fire; dropped when the match jumps to its end or is left. */
  const liveTimers: Timers = new Set();
  const later = (fn: () => void, ms: number, bucket: Timers = timers): void => {
    if (ms <= 0) {
      fn();
      return;
    }
    const id = setTimeout(() => {
      bucket.delete(id);
      fn();
    }, ms);
    bucket.add(id);
  };
  const cancelLive = (): void => {
    for (const id of liveTimers) clearTimeout(id);
    liveTimers.clear();
  };

  // ── first gesture: wake the audio engine (browsers refuse before one) ──
  const onGesture = (): void => {
    if (player.isUnlocked()) {
      removeGestureListeners();
      return;
    }
    void player.unlock().then(() => {
      if (player.isUnlocked()) removeGestureListeners();
    });
  };
  const removeGestureListeners = (): void => {
    for (const type of GESTURES) doc.removeEventListener(type, onGesture, true);
  };
  for (const type of GESTURES) doc.addEventListener(type, onGesture, { capture: true, passive: true });

  // ── clicks: registered after the gesture listeners so the engine is awake first ──
  const onClick = (event: Event): void => {
    const id = soundForClick(event.target);
    if (id) player.play(id);
  };
  doc.addEventListener('click', onClick, true);

  // ── live match: follow the scoreboard clock while the match screen is up ──
  let observer: MutationObserver | null = null;
  let live = false;
  /** The clock as last read on this match screen (null before the first reading). */
  let seen: { minute: number; final: boolean } | null = null;

  const onFinal = (match: MatchResult, humanTeamId: string | undefined): void => {
    player.stopLoop('crowd', CROWD_FINAL_OUT_MS);
    if (humanResult(match, humanTeamId) === 'win') {
      later(() => player.play('cheer'), CHEER_DELAY_MS, liveTimers);
    }
  };

  const readClock = (): void => {
    const clock = parseScoreboardClock(doc.querySelector(CLOCK_SELECTOR)?.textContent);
    const { viewingMatch, career } = store.getState();
    if (!clock || !viewingMatch) return;

    const final = clock.kind === 'final';
    const minute = clock.kind === 'final' ? FINAL_MINUTE : clock.minute;
    if (seen && seen.final === final && seen.minute === minute) return; // paused, or just re-rendered

    // The clock went back (the screen replays the match): start over, crowd included.
    const replay = seen !== null && (seen.final || minute < seen.minute);
    const from = seen === null || replay ? -1 : seen.minute;
    seen = { minute, final };
    if (replay) player.startLoop('crowd', CROWD_IN_MS);

    // Reaching the end swallows cues still waiting (the kick-off whistle of a screen
    // that opened straight on "Final", for one): the match is over, say only that.
    if (final) cancelLive();
    for (const cue of cuesForBatch(beatsBetween(viewingMatch.events, from, clock))) {
      later(() => player.play(cue.id), cue.delayMs, liveTimers);
    }
    if (final) onFinal(viewingMatch, career?.humanTeamId);
  };

  const enterLive = (): void => {
    live = true;
    seen = null;
    player.startLoop('crowd', CROWD_IN_MS);
    const Observer = doc.defaultView?.MutationObserver;
    if (Observer && !observer) {
      observer = new Observer(readClock);
      observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
    }
  };
  const leaveLive = (): void => {
    live = false;
    cancelLive();
    player.stopLoop('crowd', CROWD_OUT_MS);
    observer?.disconnect();
    observer = null;
  };

  // ── matchday simulated without watching: the final whistle ──
  const onResults = (state: DirectorState): void => {
    // The live view announces its own whistles; only the quick sim needs one here.
    if (state.screen === 'match' || state.lastResults.length === 0) return;
    later(() => player.play('whistle-end'), MATCHDAY_END_DELAY_MS);
    const human = state.career?.humanTeamId;
    const mine = human
      ? state.lastResults.find((r) => r.homeId === human || r.awayId === human)
      : undefined;
    if (humanResult(mine, human) === 'win') {
      later(() => player.play('cheer'), MATCHDAY_END_DELAY_MS + CHEER_DELAY_MS);
    }
  };

  const unsubscribe = store.subscribe((state, prev) => {
    const nowLive = isLive(state);
    const wasLive = isLive(prev);
    if (nowLive && !wasLive) enterLive();
    else if (!nowLive && wasLive) leaveLive();
    if (state.lastResults !== prev.lastResults) onResults(state);
  });
  if (isLive(store.getState())) enterLive();

  return () => {
    unsubscribe();
    removeGestureListeners();
    doc.removeEventListener('click', onClick, true);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    cancelLive();
    if (live) leaveLive();
  };
}
