import { useState } from 'react';

interface CrestProps {
  teamId: string;
  size?: number;
}

/**
 * Team crest. Loads `/crests/<teamId>.png` (respecting the deploy base path) and
 * degrades to a neutral placeholder if the image is missing, so the UI works with
 * or without the committed crest assets.
 */
export function Crest({ teamId, size = 20 }: CrestProps) {
  const [failed, setFailed] = useState(false);
  const src = `${import.meta.env.BASE_URL}crests/${teamId}.png`;

  if (failed) {
    return <span className="crest crest--fallback" style={{ width: size, height: size }} aria-hidden="true" />;
  }
  return (
    <img
      className="crest"
      src={src}
      width={size}
      height={size}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
