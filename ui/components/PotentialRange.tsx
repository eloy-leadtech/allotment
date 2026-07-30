/**
 * A fallible scout's estimated potential, drawn as a band on a 0–99 track. The
 * band shows the [low, high] range only — never the true value — because the
 * estimate can be wrong (and looks more confident as it narrows).
 */
interface PotentialRangeProps {
  low: number;
  high: number;
}

const clamp = (v: number): number => Math.max(0, Math.min(99, v));

export function PotentialRange({ low, high }: PotentialRangeProps) {
  const lo = clamp(Math.min(low, high));
  const hi = clamp(Math.max(low, high));
  const leftPct = (lo / 99) * 100;
  const widthPct = Math.max(2, ((hi - lo) / 99) * 100);
  return (
    <span className="potrange" title={`Potencial estimado ${lo}–${hi}`}>
      <span className="potrange-track">
        <span className="potrange-band" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
      </span>
      <span className="potrange-label">
        {lo}–{hi}
      </span>
    </span>
  );
}
