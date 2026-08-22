import {
  CONFIANZA_SACK,
  CONFIANZA_WARNING,
  directivaEnAviso,
  confianzaProvocaCese,
  type ConfianzaState,
} from '@game';

/** Colour band for a 0-100 meter: green when healthy, amber when shaky, red when critical. */
function bandClass(value: number): string {
  if (value <= CONFIANZA_SACK) return 'confianza-meter--critical';
  if (value <= CONFIANZA_WARNING) return 'confianza-meter--warning';
  return 'confianza-meter--ok';
}

interface MeterProps {
  label: string;
  icon: string;
  value: number;
}

function Meter({ label, icon, value }: MeterProps) {
  return (
    <div className={`confianza-meter ${bandClass(value)}`}>
      <span className="confianza-meter__label">
        {icon} {label}
      </span>
      <span className="confianza-bar" aria-hidden="true">
        <span className="confianza-bar__fill" style={{ width: `${value}%` }} />
      </span>
      <span className="confianza-meter__value">{value}</span>
    </div>
  );
}

interface ConfianzaMetersProps {
  confianza: ConfianzaState;
  /** When true, show the "estudia tu continuidad" warning if the directiva is in the warning band. */
  showWarning?: boolean;
}

/**
 * The two institutional confidence meters (directiva + afición) as 0-100 bars,
 * with the previous-warning notice when the directiva is worried but has not yet
 * acted, and the destitución notice when the meter has collapsed.
 */
export function ConfianzaMeters({ confianza, showWarning = true }: ConfianzaMetersProps) {
  return (
    <div className="confianza-meters">
      <Meter label="Confianza de la directiva" icon="🏛️" value={confianza.directiva} />
      <Meter label="Ánimo de la afición" icon="📣" value={confianza.aficion} />
      {showWarning && confianzaProvocaCese(confianza) ? (
        <p className="confianza-alert confianza-alert--sack">
          ⛔ La directiva ha perdido la confianza en ti.
        </p>
      ) : showWarning && directivaEnAviso(confianza) ? (
        <p className="confianza-alert confianza-alert--warning">
          ⚠️ La directiva estudia tu continuidad. Espera una reacción inmediata.
        </p>
      ) : null}
    </div>
  );
}
