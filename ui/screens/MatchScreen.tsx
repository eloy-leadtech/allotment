import { useEffect, useMemo, useState } from 'react';
import { teamName } from '@game';
import { derbyName } from '@engine';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Ticker, buildMatchBeats } from '@ui/components/Ticker';
import { Crest } from '@ui/components/Crest';

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

  // Live reveal: unveil beats one by one for a "watching it" feel. Purely visual
  // — the result is already decided; reduced-motion shows everything at once.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (beats.length === 0) return;
    if (prefersReducedMotion()) {
      setShown(beats.length);
      return;
    }
    setShown(1);
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n >= beats.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 650);
    return () => window.clearInterval(id);
  }, [beats]);

  if (!season || !match) {
    return (
      <main className="screen">
        <p>No hay partido seleccionado.</p>
        <RetroButton onClick={() => goTo('season')}>Volver</RetroButton>
      </main>
    );
  }

  const visible = beats.slice(0, shown);
  const current = visible[visible.length - 1];
  const live = shown < beats.length;
  const isFinal = current?.kind === 'final';
  const hs = current?.home ?? 0;
  const as = current?.away ?? 0;
  const statusLabel = isFinal ? 'Final' : current?.min != null ? `${current.min}'` : "0'";

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

      <Ticker items={visible} live={live} />

      <div className="match-actions">
        {live ? (
          <RetroButton onClick={() => setShown(beats.length)}>Ver resumen</RetroButton>
        ) : null}
        <RetroButton variant="primary" onClick={() => goTo('season')}>
          Volver a la liga
        </RetroButton>
      </div>
    </main>
  );
}
