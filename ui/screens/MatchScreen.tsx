import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { teamName } from '@game';
import { buildMatchFrames, derbyName } from '@engine';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Ticker, buildMatchBeats } from '@ui/components/Ticker';
import { Match2D } from '@ui/components/Match2D';
import { Crest } from '@ui/components/Crest';

/** Beats revealed per real second at 1x (matches the old ~650ms teletipo cadence). */
const BEATS_PER_SEC = 1.6;
const SPEEDS = [1, 2, 4] as const;
type ViewMode = 'pitch' | 'ticker';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function MatchScreen() {
  const season = useGameStore((s) => s.season);
  const match = useGameStore((s) => s.viewingMatch);
  const goTo = useGameStore((s) => s.goTo);

  const home = season && match ? teamName(season, match.homeId) : '';
  const away = season && match ? teamName(season, match.awayId) : '';
  const derby = (match?.derby ?? false) && match ? derbyName(match.homeId, match.awayId) : null;

  const beats = useMemo(
    () => (match ? buildMatchBeats(match, home, away, derby !== null) : []),
    [match, home, away, derby],
  );
  const frames = useMemo(() => (match ? buildMatchFrames(match) : []), [match]);
  const total = beats.length; // kickoff + events + final (same length as `frames`)

  const [reduced] = useState(prefersReducedMotion);
  const [mode, setMode] = useState<ViewMode>('pitch');
  const [playing, setPlaying] = useState(!reduced);
  const [speedIdx, setSpeedIdx] = useState(0);
  // Float playback position in [0, total-1]. Lives in a ref so the canvas can
  // read it at 60fps without re-rendering the screen; `index` mirrors the
  // integer beat for the scoreboard/teletipo (bumps only when it changes).
  const clockRef = useRef(0);
  const [index, setIndex] = useState(0);

  const speed = SPEEDS[speedIdx] ?? 1;
  const getProgress = useCallback(() => clockRef.current, []);

  // Reduced motion: reveal everything at once, no animation.
  useEffect(() => {
    if (reduced && total > 0) {
      clockRef.current = total - 1;
      setIndex(total - 1);
    }
  }, [reduced, total]);

  // Reset the clock whenever a new match is opened.
  useEffect(() => {
    if (reduced) return;
    clockRef.current = 0;
    setIndex(0);
    setPlaying(true);
  }, [frames, reduced]);

  // The single playback clock: advances the float position while playing.
  useEffect(() => {
    if (reduced || !playing || total === 0) return;
    if (typeof requestAnimationFrame !== 'function') return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const dt = (now - last) / 1000;
      last = now;
      let pos = clockRef.current + dt * BEATS_PER_SEC * speed;
      if (pos >= total - 1) {
        pos = total - 1;
        clockRef.current = pos;
        setIndex(total - 1);
        setPlaying(false);
        return;
      }
      clockRef.current = pos;
      const floor = Math.floor(pos);
      setIndex((prev) => (prev === floor ? prev : floor));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, reduced, total]);

  if (!season || !match) {
    return (
      <main className="screen">
        <p>No hay partido seleccionado.</p>
        <RetroButton onClick={() => goTo('season')}>Volver</RetroButton>
      </main>
    );
  }

  const idx = Math.min(index, total - 1);
  const current = beats[idx];
  const finished = index >= total - 1;
  const live = !finished;
  const isFinal = current?.kind === 'final';
  const hs = current?.home ?? 0;
  const as = current?.away ?? 0;
  const statusLabel = isFinal ? 'Final' : current?.min != null ? `${current.min}'` : "0'";
  const visible = beats.slice(0, idx + 1);

  const restart = (): void => {
    clockRef.current = 0;
    setIndex(0);
    setPlaying(true);
  };
  const skipToEnd = (): void => {
    clockRef.current = total - 1;
    setIndex(total - 1);
    setPlaying(false);
  };
  const togglePlay = (): void => {
    if (finished) restart();
    else setPlaying((p) => !p);
  };
  const cycleSpeed = (): void => setSpeedIdx((i) => (i + 1) % SPEEDS.length);

  return (
    <main className="screen">
      {derby ? (
        <p className="match-derby" role="note">
          <span className="match-derby__spark" aria-hidden>
            ▲
          </span>
          Derbi · {derby}
          <span className="match-derby__spark" aria-hidden>
            ▲
          </span>
        </p>
      ) : null}

      <section className="sb" aria-label={`Marcador ${home} ${hs} - ${as} ${away}`}>
        <div className="sb__side">
          <span className="crest-frame sb__crest">
            <Crest teamId={match.homeId} size={42} />
          </span>
          <span className="sb__id">
            <span className="sb__name">{home}</span>
            <span className="sb__role">Local</span>
          </span>
        </div>
        <div className="sb__center">
          <span className="sb__score">
            <span key={`h${hs}`} className="sb__num sb__num--bump">
              {hs}
            </span>
            <span className="sb__sep">-</span>
            <span key={`a${as}`} className="sb__num sb__num--bump">
              {as}
            </span>
          </span>
          <span className={`sb__status${live ? ' sb__status--live' : ''}`}>
            {live ? <span className="sb__live-dot" aria-hidden /> : null}
            {statusLabel}
          </span>
        </div>
        <div className="sb__side sb__side--away">
          <span className="crest-frame sb__crest">
            <Crest teamId={match.awayId} size={42} />
          </span>
          <span className="sb__id">
            <span className="sb__name">{away}</span>
            <span className="sb__role">Visitante</span>
          </span>
        </div>
      </section>

      <div className="match-view">
        <div className="match-seg" role="group" aria-label="Modo de vista del partido">
          <button
            type="button"
            className={`match-seg__btn${mode === 'pitch' ? ' match-seg__btn--active' : ''}`}
            aria-pressed={mode === 'pitch'}
            onClick={() => setMode('pitch')}
          >
            Visor 2D
          </button>
          <button
            type="button"
            className={`match-seg__btn${mode === 'ticker' ? ' match-seg__btn--active' : ''}`}
            aria-pressed={mode === 'ticker'}
            onClick={() => setMode('ticker')}
          >
            Teletipo
          </button>
        </div>

        {!reduced ? (
          <div className="match-view__controls">
            <button
              type="button"
              className="match-ctl match-ctl--primary"
              onClick={togglePlay}
              aria-label={finished ? 'Repetir' : playing ? 'Pausar' : 'Reanudar'}
            >
              {finished ? (
                <RestartIcon />
              ) : playing ? (
                <PauseIcon />
              ) : (
                <PlayIcon />
              )}
            </button>
            <button
              type="button"
              className="match-ctl match-ctl--speed"
              onClick={cycleSpeed}
              aria-label={`Velocidad x${speed}`}
            >
              x{speed}
            </button>
            {!finished ? (
              <button type="button" className="match-ctl" onClick={skipToEnd}>
                Final
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {mode === 'pitch' ? (
        <Match2D frames={frames} getProgress={getProgress} homeName={home} awayName={away} reduced={reduced} />
      ) : (
        <Ticker items={visible} live={live} />
      )}

      <div className="match-actions">
        <RetroButton variant="primary" onClick={() => goTo('season')}>
          Volver a la liga
        </RetroButton>
      </div>
    </main>
  );
}

function PlayIcon() {
  return (
    <svg className="match-ctl__icon" viewBox="0 0 16 16" aria-hidden>
      <path d="M4 2.5 13 8l-9 5.5z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg className="match-ctl__icon" viewBox="0 0 16 16" aria-hidden>
      <rect x="3.5" y="2.5" width="3.5" height="11" rx="0.8" />
      <rect x="9" y="2.5" width="3.5" height="11" rx="0.8" />
    </svg>
  );
}
function RestartIcon() {
  return (
    <svg className="match-ctl__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M13 8a5 5 0 1 1-1.8-3.8" strokeLinecap="round" />
      <path d="M12.6 2.2v2.6h-2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
