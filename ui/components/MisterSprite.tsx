import spriteRaw from './misterSprite.svg?raw';

/**
 * Inline SVG icon sprite of the Mister skin (ported from the lab mockup's
 * `sprite.svg`). Rendered once and hidden; the tower icons reference its
 * `<symbol>`s via `<use href="#ic-…">`. It is INLINED (not an external `<use>`)
 * so each symbol's internal gradient fills resolve within the same document.
 */
export function MisterSprite() {
  return (
    <div
      aria-hidden="true"
      className="mst-sprite"
      // Static, trusted asset bundled at build time (no user input).
      dangerouslySetInnerHTML={{ __html: spriteRaw }}
    />
  );
}
