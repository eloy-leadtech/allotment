import { useEffect, useRef } from 'react';
import type { MatchFrame, PitchPos, PlayAction } from '@engine';
import './Match2D.css';

interface Match2DProps {
  /** Positioned beats from the engine (see `buildMatchFrames`). */
  frames: MatchFrame[];
  /** Reads the live float playback position (0 .. frames.length - 1). */
  getProgress: () => number;
  homeName: string;
  awayName: string;
  /** When true, render a single static frame at the end (reduced motion). */
  reduced?: boolean;
}

/** Colours sampled from the theme, with the token hexes as a safe fallback. */
interface Palette {
  grassA: string;
  grassB: string;
  line: string;
  home: string;
  away: string;
  gold: string;
  yellow: string;
  red: string;
  injury: string;
  ink: string;
}

/** Darken a #rrggbb colour by `f` (0..1); non-hex inputs are returned as-is. */
function shade(hex: string, f: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * (1 - f));
  const g = Math.round(((n >> 8) & 0xff) * (1 - f));
  const b = Math.round((n & 0xff) * (1 - f));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string): string => cs.getPropertyValue(name).trim() || fallback;
  const green = v('--c-accent-2', '#2a9d4a');
  return {
    grassA: green,
    grassB: shade(green, 0.14),
    line: 'rgba(255,255,255,0.78)',
    home: v('--c-edge-light', '#7f9fff'),
    away: v('--c-danger-hi', '#e24b4b'),
    gold: v('--c-gold', '#f2c94c'),
    yellow: '#f2c14e',
    red: v('--c-danger', '#c81e1e'),
    injury: '#ff6b6b',
    ink: '#ffffff',
  };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Base 4-4-2 block in a side's own coordinates (0 = own goal, ~0.5 = halfway). */
const BASE_X = { gk: 0.05, def: 0.2, med: 0.37, del: 0.47 };
const ROWS: Array<{ x: number; ys: number[] }> = [
  { x: BASE_X.gk, ys: [0.5] },
  { x: BASE_X.def, ys: [0.2, 0.4, 0.6, 0.8] },
  { x: BASE_X.med, ys: [0.2, 0.4, 0.6, 0.8] },
  { x: BASE_X.del, ys: [0.38, 0.62] },
];

/** The 11 dots for a side, shifted as a block toward the ball + a light chase. */
function teamDots(side: 'home' | 'away', ball: PitchPos): PitchPos[] {
  const dots: PitchPos[] = [];
  const blockShift = (ball.x - 0.5) * 0.18;
  for (const row of ROWS) {
    for (const y of row.ys) {
      const ownX = side === 'home' ? row.x : 1 - row.x;
      const chase = row.x === BASE_X.gk ? 0 : 0.1;
      const x = clamp(ownX + blockShift + (ball.x - ownX) * chase, 0.02, 0.98);
      const yy = clamp(y + (ball.y - y) * (chase * 1.2), 0.04, 0.96);
      dots.push({ x, y: yy });
    }
  }
  return dots;
}

/** Signed sine arc so the ball curves instead of sliding in a dead straight line. */
function arcOffset(i: number, f: number): number {
  const sign = i % 2 === 0 ? 1 : -1;
  return Math.sin(f * Math.PI) * 0.05 * sign;
}

interface DrawState {
  frames: MatchFrame[];
  progress: number;
  pal: Palette;
}

/** Paint one frame of the viewer. Pure w.r.t. the canvas; never mutates state. */
function draw(ctx: CanvasRenderingContext2D, w: number, h: number, s: DrawState): void {
  const { frames, pal } = s;
  const n = frames.length;
  const i = clamp(Math.floor(s.progress), 0, n - 1);
  const j = Math.min(i + 1, n - 1);
  const f = clamp(s.progress - i, 0, 1);
  const cur = frames[i]!;
  const nxt = frames[j]!;
  const e = smooth(f);
  const ball: PitchPos = {
    x: clamp(lerp(cur.ball.x, nxt.ball.x, e), 0.02, 0.98),
    y: clamp(lerp(cur.ball.y, nxt.ball.y, e) + arcOffset(i, f), 0.03, 0.97),
  };

  const pad = Math.round(Math.min(w, h) * 0.05);
  const pw = w - pad * 2;
  const ph = h - pad * 2;
  const mx = (nx: number): number => pad + nx * pw;
  const my = (ny: number): number => pad + ny * ph;

  // --- Grass: vertical mowing stripes ---
  const stripes = 9;
  for (let k = 0; k < stripes; k += 1) {
    ctx.fillStyle = k % 2 === 0 ? pal.grassA : pal.grassB;
    ctx.fillRect(pad + (pw * k) / stripes, pad, pw / stripes + 1, ph);
  }

  // --- White markings ---
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.006);
  ctx.strokeRect(pad, pad, pw, ph);
  ctx.beginPath();
  ctx.moveTo(mx(0.5), pad);
  ctx.lineTo(mx(0.5), pad + ph);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx(0.5), my(0.5), ph * 0.13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx(0.5), my(0.5), Math.max(2, ph * 0.012), 0, Math.PI * 2);
  ctx.fillStyle = pal.line;
  ctx.fill();
  // Penalty + goal areas on both ends.
  const boxW = pw * 0.14;
  const boxH = ph * 0.56;
  const sixW = pw * 0.05;
  const sixH = ph * 0.3;
  ctx.strokeRect(pad, my(0.5) - boxH / 2, boxW, boxH);
  ctx.strokeRect(pad + pw - boxW, my(0.5) - boxH / 2, boxW, boxH);
  ctx.strokeRect(pad, my(0.5) - sixH / 2, sixW, sixH);
  ctx.strokeRect(pad + pw - sixW, my(0.5) - sixH / 2, sixW, sixH);
  // Goals (small posts outside the line).
  const goalH = ph * 0.2;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(pad - sixW * 0.3, my(0.5) - goalH / 2, sixW * 0.3, goalH);
  ctx.fillRect(pad + pw, my(0.5) - goalH / 2, sixW * 0.3, goalH);

  // --- Minute, big and faint, as an immersive backdrop ---
  const minLabel = cur.action === 'final' ? 'FINAL' : `${cur.min}'`;
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = pal.ink;
  ctx.font = `700 ${Math.round(ph * 0.22)}px var(--font-data), sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(minLabel, mx(0.5), my(0.3));
  ctx.restore();

  // --- Players ---
  const dotR = Math.max(3.5, Math.min(w, h) * 0.018);
  const drawTeam = (side: 'home' | 'away', color: string): void => {
    for (const d of teamDots(side, ball)) {
      ctx.beginPath();
      ctx.arc(mx(d.x), my(d.y), dotR, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.stroke();
    }
  };
  drawTeam('away', pal.away);
  drawTeam('home', pal.home);

  // --- Event flash: strongest right after arriving at the current beat ---
  const flash = 1 - smooth(clamp(f / 0.42, 0, 1));
  drawEvent(ctx, mx, my, ball, cur, flash, pal, h, dotR);

  // --- Ball ---
  const bx = mx(ball.x);
  const by = my(ball.y);
  const br = Math.max(2.5, Math.min(w, h) * 0.011);
  ctx.beginPath();
  ctx.arc(bx, by + br * 0.6, br * 1.1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.fillStyle = cur.action === 'goal' ? pal.gold : '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#0a0a28';
  ctx.stroke();
}

/** Overlay for the current beat: goal banner, cards, injury cross, labels. */
function drawEvent(
  ctx: CanvasRenderingContext2D,
  mx: (n: number) => number,
  my: (n: number) => number,
  ball: PitchPos,
  cur: MatchFrame,
  flash: number,
  pal: Palette,
  h: number,
  dotR: number,
): void {
  const bx = mx(ball.x);
  const by = my(ball.y);
  const label = ACTION_LABEL[cur.action];

  if (cur.action === 'goal') {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * flash;
    ctx.strokeStyle = pal.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, by, dotR * (2 + flash * 4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.2 + 0.8 * flash;
    ctx.fillStyle = pal.gold;
    ctx.font = `800 ${Math.round(h * 0.11)}px var(--font-ui), sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('¡GOL!', mx(0.5), my(0.52));
    ctx.restore();
    return;
  }

  if (cur.action === 'yellow' || cur.action === 'red' || cur.action === 'secondYellow') {
    const cw = dotR * 0.9;
    const chh = dotR * 1.3;
    const top = by - dotR * 2.4;
    const colors = cur.action === 'secondYellow' ? [pal.yellow, pal.red] : [cur.action === 'red' ? pal.red : pal.yellow];
    colors.forEach((c, k) => {
      ctx.fillStyle = c;
      ctx.fillRect(bx - cw / 2 + (k - (colors.length - 1) / 2) * (cw + 2), top, cw, chh);
    });
  } else if (cur.action === 'injury') {
    ctx.strokeStyle = pal.injury;
    ctx.lineWidth = 2.5;
    const r = dotR * 1.2;
    ctx.beginPath();
    ctx.moveTo(bx - r, by - dotR * 2);
    ctx.lineTo(bx + r, by - dotR * 2);
    ctx.moveTo(bx, by - dotR * 2 - r);
    ctx.lineTo(bx, by - dotR * 2 + r);
    ctx.stroke();
  }

  if (label) {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * flash;
    ctx.fillStyle = cur.possession === 'home' ? pal.home : pal.away;
    ctx.font = `700 ${Math.round(h * 0.045)}px var(--font-data), sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, bx, by - dotR * 1.4);
    ctx.restore();
  }
}

const ACTION_LABEL: Record<PlayAction, string> = {
  kickoff: 'Saque inicial',
  goal: '',
  chance: 'Ocasión',
  save: 'Paradón',
  offTarget: 'Fuera',
  post: 'Al palo',
  corner: 'Córner',
  foul: 'Falta',
  yellow: 'Amarilla',
  secondYellow: 'Doble amarilla',
  red: 'Roja',
  injury: 'Lesión',
  final: '',
};

/**
 * Canvas visor 2D cenital: draws the pitch, both teams and a ball/focus that
 * moves through the engine's positioned beats, staging goals, cards and
 * injuries. Pure theatre — it only visualizes what the engine already decided.
 */
export function Match2D({ frames, getProgress, homeName, awayName, reduced = false }: Match2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom / unsupported: render nothing, never crash.

    const pal = readPalette(wrap);
    let w = 0;
    let h = 0;

    const resize = (): void => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(w / 1.5));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (): void => {
      draw(ctx, w, h, { frames, progress: getProgress(), pal });
    };

    resize();
    render();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        resize();
        render();
      });
      ro.observe(wrap);
    }

    if (!reduced && typeof requestAnimationFrame === 'function') {
      const loop = (): void => {
        render();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (rafRef.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafRef.current);
      }
      if (ro) ro.disconnect();
    };
  }, [frames, getProgress, reduced]);

  return (
    <div className="match2d" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="match2d__canvas"
        role="img"
        aria-label={`Visor 2D del partido ${homeName} contra ${awayName}`}
      />
    </div>
  );
}
