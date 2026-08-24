import sprite from '../theme/mister-sprite.svg?raw';

/* The hand-drawn icon sprite of the Mister skin (ported from the lab mockup).
   Inlined once, visually hidden, so <use href="#ic-..."> resolves offline.
   Not display:none — that would break the gradient defs some browsers refuse
   to resolve from hidden subtrees. */
const HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: 0,
  height: 0,
  overflow: 'hidden',
};

export function MisterSprite() {
  return <div style={HIDDEN} aria-hidden="true" dangerouslySetInnerHTML={{ __html: sprite }} />;
}

/** An icon from the sprite ("ic-tactica", "ic-fichajes"…), sized by its container. */
export function MisterIcon({ id }: { id: string }) {
  return (
    <svg aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}
