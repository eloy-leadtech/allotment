import { useEffect, useRef } from 'react';
import { narrateEvent } from '@game';
import type { EventType, MatchEvent, MatchResult } from '@engine';

/** Kind of on-pitch beat; drives the icon + colour of each teletipo row. */
export type EventKind =
  | 'goal'
  | 'chance'
  | 'save'
  | 'offtarget'
  | 'post'
  | 'corner'
  | 'yellow'
  | 'secondyellow'
  | 'red'
  | 'injury'
  | 'foul'
  | 'kickoff'
  | 'final';

export interface TickerItem {
  key: string;
  /** Minute badge; null hides the casquillo (kickoff / final banners). */
  min: number | null;
  kind: EventKind;
  text: string;
}

/** A beat plus the running score/minute at that point, for a live scoreboard. */
export interface MatchBeat extends TickerItem {
  home: number;
  away: number;
}

interface TickerProps {
  items: TickerItem[];
  /** True while the match is still revealing beats (shows the LIVE pulse). */
  live?: boolean;
}

/** Map an engine event type to a presentation kind (icon + colour). */
const KIND: Record<EventType, EventKind> = {
  goal: 'goal',
  chance: 'chance',
  yellow: 'yellow',
  secondYellow: 'secondyellow',
  red: 'red',
  injury: 'injury',
  saved: 'save',
  offTarget: 'offtarget',
  post: 'post',
  corner: 'corner',
  foul: 'foul',
};

/** Strip the leading "23' " minute prefix — the minute lives in its own badge. */
function stripMin(line: string): string {
  return line.replace(/^\s*\d+'\s*/, '');
}

/**
 * Turn a played match into ordered beats (kickoff → events → final), each
 * carrying the running score. Presentation only: the phrasing comes from the
 * game layer's `narrateEvent`; nothing here changes the result.
 */
export function buildMatchBeats(
  match: MatchResult,
  home: string,
  away: string,
  derby: boolean,
): MatchBeat[] {
  const beats: MatchBeat[] = [
    { key: 'kickoff', min: null, kind: 'kickoff', text: 'Rueda el balon, comienza el partido', home: 0, away: 0 },
  ];
  let h = 0;
  let a = 0;
  match.events.forEach((ev: MatchEvent, i) => {
    if (ev.type === 'goal') {
      if (ev.team === 'home') h += 1;
      else a += 1;
    }
    beats.push({
      key: `e${i}`,
      min: ev.min,
      kind: KIND[ev.type],
      text: stripMin(narrateEvent(ev, home, away, derby)),
      home: h,
      away: a,
    });
  });
  beats.push({
    key: 'final',
    min: null,
    kind: 'final',
    text: 'Final del partido',
    home: match.homeGoals,
    away: match.awayGoals,
  });
  return beats;
}

/** Crisp monoline SVG per beat — HD/vectorial, tinted via CSS currentColor. */
function EventIcon({ kind }: { kind: EventKind }) {
  const common = {
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (kind) {
    case 'goal':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.4 10.7 6.4 9.7 9.6 6.3 9.6 5.3 6.4Z" />
        </svg>
      );
    case 'save':
      return (
        <svg {...common}>
          <path d="M5 14V8.2a3 3 0 0 1 6 0V14" />
          <path d="M5 10.3H3.6a1.2 1.2 0 0 0 0 2.4H5" />
          <path d="M7 8V6.2M9 8V6.2" />
        </svg>
      );
    case 'chance':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
          <path d="M8 1.2V3M8 13v1.8M1.2 8H3M13 8h1.8" />
        </svg>
      );
    case 'offtarget':
      return (
        <svg {...common}>
          <circle cx="6" cy="10.4" r="2.6" />
          <path d="M9 8 13 4M13 4h-2.6M13 4v2.6" />
        </svg>
      );
    case 'post':
      return (
        <svg {...common}>
          <path d="M4 14V4.5h8V14" />
          <circle cx="10.4" cy="6.6" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'corner':
      return (
        <svg {...common}>
          <path d="M6 14V2.6" />
          <path d="M6 3h6L9.3 5.2 12 7.4H6" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'yellow':
      return (
        <svg viewBox="0 0 16 16" aria-hidden>
          <rect x="5" y="2.6" width="6" height="11" rx="1.2" fill="currentColor" transform="rotate(9 8 8)" />
        </svg>
      );
    case 'red':
      return (
        <svg viewBox="0 0 16 16" aria-hidden>
          <rect x="5" y="2.6" width="6" height="11" rx="1.2" fill="currentColor" transform="rotate(9 8 8)" />
        </svg>
      );
    case 'secondyellow':
      return (
        <svg viewBox="0 0 16 16" aria-hidden>
          <rect x="3.4" y="3" width="5.4" height="10" rx="1.1" fill="#f2c14e" transform="rotate(9 6 8)" />
          <rect x="7.2" y="3" width="5.4" height="10" rx="1.1" fill="currentColor" transform="rotate(9 10 8)" />
        </svg>
      );
    case 'injury':
      return (
        <svg viewBox="0 0 16 16" aria-hidden fill="currentColor">
          <path d="M6.6 3h2.8v3.2h3.2v2.8H9.4v3.2H6.6V9H3.4V6.2h3.2Z" />
        </svg>
      );
    case 'foul':
      return (
        <svg {...common}>
          <rect x="2.6" y="6.4" width="6.4" height="4.2" rx="1.6" />
          <circle cx="11" cy="8.5" r="2.3" />
          <circle cx="11" cy="8.5" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'kickoff':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.2" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
          <path d="M8 2.8v10.4" />
        </svg>
      );
    case 'final':
      return (
        <svg {...common}>
          <path d="M4.5 14V2.4" />
          <path d="M4.5 3h7v5h-7z" />
          <path
            d="M4.5 3h2.3v1.7H4.5zM9.2 3h2.3v1.7H9.2zM6.8 4.7h2.4v1.6H6.8zM4.5 6.3h2.3v1.7H4.5zM9.2 6.3h2.3v1.7H9.2z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      );
  }
}

/** Split trailing "(Equipo)" so the team reads bold without touching the text. */
function renderText(text: string) {
  const m = /^(.*?)(\s*\([^)]+\))\s*$/.exec(text);
  if (!m) return text;
  return (
    <>
      {m[1]}
      <b>{m[2]}</b>
    </>
  );
}

/**
 * Teletipo en directo: styled beats (minute casquillo + kind icon + chronicle),
 * goals highlighted, and a feed that auto-follows the latest line. Presentation
 * only — the beats are pre-computed by the caller from the match events.
 */
export function Ticker({ items, live = false }: TickerProps) {
  const feedRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  return (
    <div className="match-ticker">
      <div className="match-ticker__head">
        <h2 className="match-ticker__title">Teletipo</h2>
        {live ? (
          <span className="match-ticker__live">
            <span className="match-ticker__live-dot" aria-hidden />
            En directo
          </span>
        ) : null}
      </div>
      <ul className="match-ticker__feed" ref={feedRef} aria-live="polite">
        {items.map((it) => (
          <li key={it.key} className={`match-ev match-ev--${it.kind}`}>
            {it.min !== null ? (
              <span className="match-ev__min">{it.min}&apos;</span>
            ) : (
              <span className="match-ev__min" aria-hidden>
                ·
              </span>
            )}
            <span className="match-ev__icon">
              <EventIcon kind={it.kind} />
            </span>
            <span className="match-ev__text">{renderText(it.text)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
