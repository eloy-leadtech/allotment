import { useEffect } from 'react';

/**
 * The lab mockup is calibrated for a 1920×1080 PC screen: it scales the whole
 * board with a single `--zoom` (1.15) and keeps the console measuring the exact
 * window via `--unzoom` (= 1/zoom). Hard-coded to 1920, it looks oversized
 * ("más bruto") on any narrower window. This makes the same single knob
 * RESPONSIVE: `zoom = 1.15 · min(w/1920, h/1080)`, so the board is a fixed 1920×1080
 * design scaled to CONTAIN the viewport — identical proportions to the original
 * at any size, never clipped. Updated on resize.
 */
const DESIGN_W = 1920;
const DESIGN_H = 1080;
const BASE_ZOOM = 1.15;

export function useBoardScale(ref: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (): void => {
      const fit = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
      const zoom = Math.max(BASE_ZOOM * fit, 0.3);
      el.style.setProperty('--zoom', String(zoom));
      el.style.setProperty('--unzoom', String(1 / zoom));
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [ref]);
}
