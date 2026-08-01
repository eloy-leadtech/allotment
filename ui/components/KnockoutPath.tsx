import { useState } from 'react';
import { narrateMatch, type HumanKnockoutStep } from '@game';
import { RetroPanel } from './RetroPanel';
import { RetroButton } from './RetroButton';
import { Ticker } from './Ticker';

interface KnockoutPathProps {
  /** The human's knockout run, round by round (empty when they didn't play). */
  steps: readonly HumanKnockoutStep[];
  /** The human's team id (to tell which side they were and if they went through). */
  me: string;
  /** Resolve a team id to its display name. */
  name: (id: string) => string;
  /** Panel heading (defaults to "Tu recorrido"). */
  title?: string;
}

/**
 * The human's cup run made VISIBLE: one row per round played, each expandable to
 * replay that tie's teletipo live (the very same deterministic match the bracket
 * simulated with your persisted tactics). Renders nothing when there is no run.
 */
export function KnockoutPath({ steps, me, name, title = 'Tu recorrido' }: KnockoutPathProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (steps.length === 0) return null;

  return (
    <RetroPanel title={title}>
      <ul className="market-list ko-path">
        {steps.map((step, i) => {
          const m = step.match;
          const advanced = step.winnerId === me;
          const open = openIdx === i;
          const home = name(m.homeId);
          const away = name(m.awayId);
          return (
            <li key={i} className="ko-path-step">
              <div className="ko-path-row">
                <span className="ko-path-round">{step.ronda}</span>
                <span className="ko-path-score">
                  {home} {m.homeGoals}-{m.awayGoals} {away}
                  {step.onPenalties ? ' (pen)' : ''}
                </span>
                <span className={advanced ? 'ko-win' : 'ko-out'}>
                  {advanced ? 'Clasificado ✓' : 'Eliminado ✗'}
                </span>
                <RetroButton onClick={() => setOpenIdx(open ? null : i)}>
                  {open ? 'Ocultar' : 'Ver'}
                </RetroButton>
              </div>
              {open ? (
                <div className="ko-path-live">
                  <p className="scoreboard scoreboard--mini">
                    <span className="scoreboard__team">{home}</span>
                    <span className="scoreboard__score">
                      {m.homeGoals}-{m.awayGoals}
                    </span>
                    <span className="scoreboard__team">{away}</span>
                  </p>
                  <Ticker lines={narrateMatch(m, home, away)} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </RetroPanel>
  );
}
