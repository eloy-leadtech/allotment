import spriteRaw from './sprite.svg?raw';

/**
 * Inlines the Mister icon sprite (12 original section icons) once, hidden, so the
 * `<use href="#ic-…">` references in the office resolve. Offline-safe: the SVG is
 * bundled, not fetched. Render it once near the root of the despacho.
 */
export function MisterSprite() {
  return <div className="mister-sprite" aria-hidden="true" dangerouslySetInnerHTML={{ __html: spriteRaw }} />;
}

/** A section icon from the inlined sprite (e.g. name="alineacion" → #ic-alineacion). */
export function MisterIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <use href={`#ic-${name}`} />
    </svg>
  );
}
