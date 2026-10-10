import { useEffect } from 'react';

/**
 * The night-stadium backdrop drawn on a canvas: sky, three curved crowd tiers with
 * seeded speckle, distant floodlight towers and the pitch with mowing stripes,
 * veiled so it never competes with the panel on top. Ported verbatim from the lab
 * mockup (`script.js`): a seeded PRNG (fixed seed) so the same stadium renders on
 * every load, redrawn only on resize (no animation loop → no battery drain).
 */

/** mulberry32 — the mockup's fixed-seed PRNG, so the stadium is identical each load. */
function mulberry(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawStadium(cv: HTMLCanvasElement): void {
  // jsdom (tests) has no 2D canvas and throws here; the photo layer carries the look.
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = cv.getContext('2d');
  } catch {
    return;
  }
  if (!ctx) return;
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.max(1, Math.round(r.width));
  const H = Math.max(1, Math.round(r.height));
  cv.width = W * dpr;
  cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const rnd = mulberry(20481999);

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b1030');
  sky.addColorStop(0.55, '#101a45');
  sky.addColorStop(1, '#0a0d28');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const horizon = H * 0.86;

  const tiers = [
    { y: horizon - H * 0.26, h: H * 0.11, base: '#131b42', dots: 820, dim: 0.2 },
    { y: horizon - H * 0.16, h: H * 0.1, base: '#161f4c', dots: 640, dim: 0.28 },
    { y: horizon - H * 0.06, h: H * 0.08, base: '#1a2456', dots: 480, dim: 0.36 },
  ];
  for (const t of tiers) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-W * 0.1, t.y + t.h);
    ctx.quadraticCurveTo(W * 0.5, t.y - t.h * 0.65, W * 1.1, t.y + t.h);
    ctx.lineTo(W * 1.1, t.y + t.h * 1.9);
    ctx.quadraticCurveTo(W * 0.5, t.y + t.h * 0.55, -W * 0.1, t.y + t.h * 1.9);
    ctx.closePath();
    ctx.fillStyle = t.base;
    ctx.fill();
    ctx.clip();
    for (let i = 0; i < t.dots; i++) {
      const x = rnd() * W * 1.2 - W * 0.1;
      const y = t.y + rnd() * t.h * 1.7;
      const a = (0.1 + rnd() * 0.5) * t.dim;
      const warm = rnd();
      ctx.fillStyle =
        warm > 0.82
          ? `rgba(255,225,180,${a})`
          : warm > 0.55
            ? `rgba(190,215,255,${a})`
            : `rgba(120,150,220,${a})`;
      ctx.fillRect(x, y, 1.6, 1.3);
    }
    ctx.restore();
  }

  for (const tx of [W * 0.1, W * 0.9]) {
    const ty = horizon - H * 0.44;
    ctx.strokeStyle = 'rgba(110,135,190,.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty + H * 0.055);
    ctx.lineTo(tx, horizon - H * 0.14);
    ctx.stroke();
    ctx.fillStyle = 'rgba(125,150,200,.14)';
    ctx.fillRect(tx - 17, ty, 34, H * 0.055);
    for (let c = 0; c < 9; c++) {
      const lx = tx - 12 + (c % 3) * 12;
      const ly = ty + 6 + Math.floor(c / 3) * 10;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 8);
      g.addColorStop(0, 'rgba(220,236,255,.42)');
      g.addColorStop(1, 'rgba(220,236,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lx, ly, 8, 0, 6.2832);
      ctx.fill();
    }
    const cone = ctx.createLinearGradient(tx, ty, W * 0.5, horizon + H * 0.1);
    cone.addColorStop(0, 'rgba(180,208,255,.055)');
    cone.addColorStop(1, 'rgba(180,208,255,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(tx - 15, ty + H * 0.04);
    ctx.lineTo(tx + 15, ty + H * 0.04);
    ctx.lineTo(W * 0.5 + W * 0.26, horizon + H * 0.14);
    ctx.lineTo(W * 0.5 - W * 0.26, horizon + H * 0.14);
    ctx.closePath();
    ctx.fill();
  }

  const pitch = ctx.createLinearGradient(0, horizon - H * 0.02, 0, H);
  pitch.addColorStop(0, 'rgba(23,92,48,.26)');
  pitch.addColorStop(0.5, 'rgba(14,62,33,.16)');
  pitch.addColorStop(1, 'rgba(8,30,18,.05)');
  ctx.fillStyle = pitch;
  ctx.beginPath();
  ctx.moveTo(-W * 0.05, horizon + H * 0.02);
  ctx.quadraticCurveTo(W * 0.5, horizon - H * 0.045, W * 1.05, horizon + H * 0.02);
  ctx.lineTo(W * 1.05, H);
  ctx.lineTo(-W * 0.05, H);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.clip();
  for (let s = 0; s < 9; s++) {
    if (s % 2) continue;
    ctx.fillStyle = 'rgba(255,255,255,.030)';
    ctx.fillRect(-W * 0.05 + s * ((W * 1.1) / 9), horizon - H * 0.05, (W * 1.1) / 9, H);
  }
  ctx.restore();

  // Final veil: the stadium is atmosphere, never a rival to the panel above it.
  ctx.fillStyle = 'rgba(10,13,40,.42)';
  ctx.fillRect(0, 0, W, H);
}

/** Draw the stadium into `ref`'s canvas on mount and (debounced) on resize. */
export function useStadiumCanvas(ref: React.RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    drawStadium(cv);
    let t: ReturnType<typeof setTimeout> | null = null;
    const onResize = (): void => {
      if (t) clearTimeout(t);
      t = setTimeout(() => drawStadium(cv), 160);
    };
    window.addEventListener('resize', onResize);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, [ref]);
}
