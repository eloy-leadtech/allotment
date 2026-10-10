import { useEffect, useState } from 'react';

/** One rotating backdrop photo plus its curated caption and vertical framing. */
export interface Fondo {
  file: string;
  cap: string;
  autor: string;
  pos: string;
}

/** The credit shown under the console for the photo currently on screen. */
export interface PhotoCredit {
  cap: string;
  autor: string;
}

/** Deterministic shuffle (the mockup's seeded LCG) so the tour is identical each load. */
function shuffledOrder(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  let seed = 20481999;
  for (let i = n - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    const a = order[i];
    const b = order[j];
    if (a !== undefined && b !== undefined) {
      order[i] = b;
      order[j] = a;
    }
  }
  return order;
}

/**
 * Drive the two-layer photo backdrop of the despacho: a carousel of historical
 * football photos (already darkened/blue-tinted in the asset) that cross-fades
 * every 30 s with Ken Burns from CSS. Ported from the lab mockup: two <img>
 * layers, the entering one preloads the next source and fades in via the `.on`
 * class while the leaving one fades out, so the change never flickers. Returns
 * the current photo's credit for the "La historia" caption line.
 */
export function usePhotoCarousel(
  aRef: React.RefObject<HTMLImageElement | null>,
  bRef: React.RefObject<HTMLImageElement | null>,
): PhotoCredit | null {
  const [credit, setCredit] = useState<PhotoCredit | null>(null);

  useEffect(() => {
    if (typeof fetch !== 'function') return; // non-browser (tests): canvas-only backdrop
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    let creditTimer: ReturnType<typeof setTimeout> | null = null;

    const base = `${import.meta.env.BASE_URL}ui/mister/`;
    fetch(`${base}fondos.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!alive || !Array.isArray(data) || data.length === 0) return;
        const photos = data as Fondo[];
        const layers = [aRef.current, bRef.current];
        if (!layers[0] || !layers[1]) return;
        const order = shuffledOrder(photos.length);
        let active = 0;
        let cursor = 0;

        const paintCredit = (photo: Fondo): void => {
          setCredit(null);
          if (creditTimer) clearTimeout(creditTimer);
          creditTimer = setTimeout(() => {
            if (alive) setCredit({ cap: photo.cap, autor: photo.autor });
          }, 500);
        };

        const next = (first: boolean): void => {
          const idx = order[cursor % order.length];
          cursor++;
          if (idx === undefined) return;
          const photo = photos[idx];
          const entering = layers[(active + 1) % 2];
          const leaving = layers[active];
          if (!photo || !entering || !leaving) return;
          const onLoad = (): void => {
            entering.style.objectPosition = `center ${photo.pos || 'center'}`;
            entering.classList.add('on');
            leaving.classList.remove('on');
            active = (active + 1) % 2;
            paintCredit(photo);
          };
          entering.onload = onLoad;
          entering.src = `${base}fondos/${photo.file}`;
          if (first && entering.complete) onLoad();
        };

        next(true);
        if (photos.length > 1) timer = setInterval(() => next(false), 30000);
      })
      .catch(() => {
        /* offline/test: no photos, the canvas backdrop still shows */
      });

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      if (creditTimer) clearTimeout(creditTimer);
    };
  }, [aRef, bRef]);

  return credit;
}
