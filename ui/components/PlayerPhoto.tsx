import { useEffect, useState } from 'react';

/** URL base for player portraits. `/fotos-bdf/` in dev (served from VITE_PHOTO_DIR). */
const PHOTO_BASE: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_PHOTO_BASE ?? '/fotos-bdf/';

/**
 * A player's BDFutbol portrait, resolved directly from their `bdfId`
 * (`<base>/<id>/<id>.jpg`). Falls back to a neutral placeholder when the id is
 * missing or the image fails to load, so the fiche never shows a broken image.
 */
export function PlayerPhoto({ bdfId, size = 96 }: { bdfId?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [bdfId]);

  const box = { width: size, height: Math.round(size * 1.25) };
  if (!bdfId || failed) {
    return (
      <span className="player-photo player-photo--empty" style={box} aria-hidden>
        👤
      </span>
    );
  }
  return (
    <img
      className="player-photo"
      style={box}
      src={`${PHOTO_BASE}${bdfId}/${bdfId}.jpg`}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
