import { useState } from 'react';
import { getEstadio } from '@data';

interface StadiumProps {
  teamId: string;
}

const formatAforo = (aforo: number | null): string =>
  aforo === null ? '' : `${aforo.toLocaleString('es-ES')} espectadores`;

/**
 * Club stadium banner: the stadium photo (from `/stadiums/<teamId>.png`) with its
 * name and capacity. Degrades gracefully — hides the image if it is missing and
 * shows nothing at all when we have no stadium data for the club.
 */
export function Stadium({ teamId }: StadiumProps) {
  const [failed, setFailed] = useState(false);
  const info = getEstadio(teamId);
  if (!info) return null;

  const src = `${import.meta.env.BASE_URL}stadiums/${teamId}.png`;
  return (
    <figure className="stadium">
      {failed ? null : (
        <img className="stadium-img" src={src} alt={info.nombre} onError={() => setFailed(true)} />
      )}
      <figcaption className="stadium-caption">
        <span className="stadium-name">{info.nombre}</span>
        {info.aforo !== null ? <span className="hint">{formatAforo(info.aforo)}</span> : null}
      </figcaption>
    </figure>
  );
}
