import type { Line } from '@engine';
import { Flag } from './Flag';

interface PlayerTagProps {
  nombre: string;
  /** Line (POR/DEF/MED/DEL) — colours the position badge. */
  posicion: Line;
  /** Finer demarcation label (LATD, MCO…) when the data has one; defaults to the line. */
  posLabel?: string;
  /** Shirt number; null renders a quiet "·" (pre-1995 seasons have no fixed dorsal). */
  dorsal?: number | null;
  nacionalidad?: string | null;
  /** When provided, the media is shown right-aligned. */
  media?: number;
  /** Hide the dorsal circle entirely (e.g. market lists). */
  sinDorsal?: boolean;
  className?: string;
}

/**
 * HOW A PLAYER IS PRESENTED EVERYWHERE IN THE GAME.
 * Dorsal, little flag, name and demarcation coloured by line. Every list must
 * render players through this component: change it here, it changes everywhere.
 * (Port of MisterUtil.jugadorHTML from the lab mockup.)
 */
export function PlayerTag({
  nombre,
  posicion,
  posLabel,
  dorsal,
  nacionalidad,
  media,
  sinDorsal = false,
  className,
}: PlayerTagProps) {
  return (
    <span className={className ? `mst-jg ${className}` : 'mst-jg'}>
      {!sinDorsal && <span className="mst-jg__d">{dorsal ?? '·'}</span>}
      <span className="mst-jg__b">
        <Flag country={nacionalidad} />
      </span>
      <span className="mst-jg__n">{nombre}</span>
      <span className={`pos-badge pos-badge--${posicion}`}>{posLabel ?? posicion}</span>
      {media !== undefined && <span className="mst-jg__m">{media}</span>}
    </span>
  );
}
