import type { ReactNode } from 'react';

interface TowerButtonProps {
  /** Section name, already in Spanish ("Alineación", "Finanzas"…). */
  name: string;
  /** Live data line under the name; wrap highlights in <em> for accent color. */
  hint?: ReactNode;
  /** Tints the <em> inside the hint: red for problems, green for good news. */
  hintTone?: 'alert' | 'good';
  /** Warning dot: 'alert' (red, needs an answer) or 'pending' (amber). */
  pip?: 'alert' | 'pending';
  /** Accessible label for the pip, e.g. "Alineación incompleta". */
  pipLabel?: string;
  /** Icon rendered inside the metal thumb well (an inline <svg>). */
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Tower section button of the Mister skin: metal plate with an icon thumb,
 * the section name and a live-data hint. Navigation in the Despacho happens
 * through these (no tab strip).
 */
export function TowerButton({
  name,
  hint,
  hintTone,
  pip,
  pipLabel,
  icon,
  onClick,
  disabled = false,
}: TowerButtonProps) {
  const hintClass = hintTone ? `mst-sec__d mst-sec__d--${hintTone}` : 'mst-sec__d';
  return (
    <button type="button" className="mst-sec" onClick={onClick} disabled={disabled}>
      <span className="mst-sec__thumb" aria-hidden="true">
        {icon}
      </span>
      <span className="mst-sec__txt">
        <span className="mst-sec__n">{name}</span>
        {hint !== undefined && <span className={hintClass}>{hint}</span>}
      </span>
      {pip !== undefined && (
        <span
          className={pip === 'pending' ? 'mst-pip mst-pip--q' : 'mst-pip'}
          role="status"
          aria-label={pipLabel ?? 'Aviso'}
        />
      )}
    </button>
  );
}
