import { useEffect, useRef } from 'react';

/* Night-stadium backdrop drawn on canvas, ported verbatim from the lab mockup
   (script.js). Seeded PRNG → the same stadium on every load and every club.
   Drawn once per size (no animation loop) to save battery. */

function mulberry(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function draw(cv: HTMLCanvasElement): void {
  const ctx = cv.getContext('2d');
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

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b1030');
  sky.addColorStop(0.55, '#101a45');
  sky.addColorStop(1, '#0a0d28');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const horizon = H * 0.86;

  // stands: three curved tiers speckled with crowd dots
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

  // floodlight towers — distant and faint: atmosphere, not protagonists
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
    // light cone toward the pitch
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

  // pitch
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

  // mowing stripes
  ctx.save();
  ctx.clip();
  for (let s = 0; s < 9; s++) {
    if (s % 2) continue;
    ctx.fillStyle = 'rgba(255,255,255,.030)';
    ctx.fillRect(-W * 0.05 + s * ((W * 1.1) / 9), horizon - H * 0.05, (W * 1.1) / 9, H);
  }
  ctx.restore();

  // Final veil: the stadium is atmosphere and must never compete with the
  // panel above, so it is dimmed as a block before the UI is drawn.
  ctx.fillStyle = 'rgba(10,13,40,.42)';
  ctx.fillRect(0, 0, W, H);
}

/** The stadium backdrop of the Mister console. Redraws (debounced) on resize. */
export function StadiumCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    draw(cv);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => draw(cv), 160);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} className="mst-console__bg" aria-hidden="true" />;
}
