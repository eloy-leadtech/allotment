import { useEffect, type ReactNode } from 'react';
import { useGameStore } from '@ui/store/gameStore';

/**
 * Glassy SECTION overlay of the Mister skin: a section opens as an opaque-glass
 * panel OVER the despacho — the club's stadium photo stays behind — animating in.
 * Closing (✕, ESC, or a click on the backdrop) returns to the despacho. This is
 * how the office navigates: everything opens "in the despacho", never a separate
 * full screen.
 */
export function SectionOverlay({ children }: { children: ReactNode }) {
  const goTo = useGameStore((s) => s.goTo);
  const close = (): void => goTo('season');

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') goTo('season');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [goTo]);

  return (
    <div
      className="mst-ov"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="mst-ov__panel" role="dialog" aria-modal="true">
        <button type="button" className="mst-ov__x" aria-label="Volver al despacho" onClick={close}>
          ✕
        </button>
        <div className="mst-ov__body">{children}</div>
      </div>
    </div>
  );
}
