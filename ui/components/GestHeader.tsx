import type { ReactNode } from 'react';
import { Crest } from './Crest';

/** A data chip shown on the right of a management header (budget, matchday…). */
export interface HeadChip {
  label: string;
  value: ReactNode;
  /** Colour of the value: default (accent), danger (red), good (green). */
  tone?: 'danger' | 'good';
}

interface GestHeaderProps {
  /** Big title (rendered in the brand's oblique caps h1). */
  title: ReactNode;
  /** Condensed subtitle under the title. */
  subtitle?: ReactNode;
  /** Show a framed HD crest as the header icon. */
  crestTeamId?: string;
  /** Or an emoji glyph in a framed steel tile when there's no crest. */
  icon?: string;
  /** Optional data chips (matchday, budget, wages…). */
  chips?: HeadChip[];
}

/**
 * Uniform management-screen header: a bevelled steel plate carrying an optional
 * framed crest/icon, the screen title + subtitle, and a row of inset data chips.
 * Gives every gestión screen (mercado, ojeo, estadio, patrocinio, estadísticas,
 * palmarés, plantilla, cantera) the same PCF7 "consola de acero" look at a glance.
 */
export function GestHeader({ title, subtitle, crestTeamId, icon, chips }: GestHeaderProps) {
  return (
    <header className="gest-head">
      {crestTeamId ? (
        <div className="gest-head__crest crest-frame">
          <Crest teamId={crestTeamId} size={60} />
        </div>
      ) : icon ? (
        <div className="gest-head__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div className="gest-head__identity">
        <h1>{title}</h1>
        {subtitle ? <span className="gest-head__sub">{subtitle}</span> : null}
      </div>
      {chips && chips.length > 0 ? (
        <div className="gest-head__chips">
          {chips.map((chip) => (
            <div
              key={typeof chip.label === 'string' ? chip.label : undefined}
              className={`gest-chip${chip.tone ? ` gest-chip--${chip.tone}` : ''}`}
            >
              <span className="gest-chip__label">{chip.label}</span>
              <span className="gest-chip__value">{chip.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}
