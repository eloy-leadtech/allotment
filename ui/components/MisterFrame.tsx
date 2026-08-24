import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { StadiumCanvas } from './StadiumCanvas';

/* The console has a FIXED shape: whatever happens to the window, the board
   keeps its 1180×787 proportion (the mockup's contract). What does not fit
   scrolls inside; the frame never stretches. The whole board scales with ONE
   knob (CSS zoom), recomputed from the viewport. */

const FRAME_W = 1180;
const FRAME_H = 787;
/** Breathing room around the console so its drop shadow is not clipped. */
const MARGIN = 24;

interface MisterFrameProps {
  /** Persistent header (MisterHeader) rendered above the screen content. */
  header?: ReactNode;
  children: ReactNode;
}

/** The Mister console: fixed-proportion frame, stadium backdrop, grain. */
export function MisterFrame({ header, children }: MisterFrameProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const scale = Math.min(
        (window.innerWidth - MARGIN) / FRAME_W,
        (window.innerHeight - MARGIN) / FRAME_H,
        1.65,
      );
      el.style.setProperty('--mst-zoom', String(Math.max(scale, 0.4)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div className="mst-stage">
      <div ref={ref} className="mst-console">
        <StadiumCanvas />
        <div className="mst-console__grain" aria-hidden="true" />
        <div className="mst-screen">
          {header}
          <div className="mst-views">{children}</div>
        </div>
      </div>
    </div>
  );
}
