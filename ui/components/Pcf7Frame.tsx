import type { CSSProperties, ReactNode } from 'react';

/**
 * Shared PC Fútbol 7 "calco" frame. Mirrors exactly the pattern used by the
 * Despacho (`ui/screens/Despacho.tsx`): a full-viewport dark backdrop with a
 * 4:3 canvas that shows a real 640×480 PCF7 bitmap scaled as large as it fits,
 * over which live data is overlaid at coordinates expressed against the
 * original 640×480 canvas (so it scales while keeping its proportion).
 *
 * Use `place()` to position any overlay by its 640×480-space rectangle.
 */

export const CANVAS_W = 640;
export const CANVAS_H = 480;

/** A rectangle on the original 640×480 canvas. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Turn a canvas-space rectangle into a percentage-based absolute style. */
export function place({ x, y, w, h }: Rect): CSSProperties {
  return {
    left: `${(x / CANVAS_W) * 100}%`,
    top: `${(y / CANVAS_H) * 100}%`,
    width: `${(w / CANVAS_W) * 100}%`,
    height: `${(h / CANVAS_H) * 100}%`,
  };
}

interface Pcf7FrameProps {
  /** File under `public/ui/pcf7/`, e.g. `'scr_026.png'`. */
  bitmap: string;
  children: ReactNode;
}

export function Pcf7Frame({ bitmap, children }: Pcf7FrameProps) {
  const bg = `${import.meta.env.BASE_URL}ui/pcf7/${bitmap}`;
  return (
    <main className="screen pcf7screen">
      <div
        className="pcf7canvas"
        style={{ backgroundImage: `url(${bg})`, aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      >
        {children}
      </div>
    </main>
  );
}

interface Pcf7ConsoleProps {
  /** Left side of the title bar (Futura/Jost oblique heading). */
  title: ReactNode;
  /** Optional right side of the title bar (status/live data). */
  status?: ReactNode;
  /** Optional footer row (action buttons). */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Steel-console layout for screens with NO dedicated PCF7 bitmap (plantilla,
 * ficha, mercado, directiva, palmarés — composed at runtime in the original,
 * findings/09 §6). Full-viewport blue backdrop with a centred bevelled steel
 * panel: a title bar on top, a scrollable body, and an optional footer.
 */
export function Pcf7Console({ title, status, footer, children }: Pcf7ConsoleProps) {
  return (
    <main className="screen pcf7screen">
      <section className="pcf7console">
        <header className="pcf7console__bar">
          <h1 className="pcf7console__title">{title}</h1>
          {status != null ? <span className="pcf7console__status">{status}</span> : null}
        </header>
        <div className="pcf7console__body">{children}</div>
        {footer != null ? <div className="pcf7console__footer">{footer}</div> : null}
      </section>
    </main>
  );
}
