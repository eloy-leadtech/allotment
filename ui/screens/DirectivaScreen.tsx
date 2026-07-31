import { careerTeamName } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Pcf7Frame, place, type Rect } from '@ui/components/Pcf7Frame';

/**
 * DIRECTIVA / oficina — calco de `scr_030` (findings/13 §4.7): retrato del
 * mánager arriba-izq + dos columnas de retratos (presidente/directivos) + placas
 * centrales con datos de la relación con la directiva. Placeholder: superponemos
 * huecos de foto y placas de datos en vivo sobre el bitmap; el contenido real
 * (objetivos, confianza, presupuesto) se irá enganchando al store.
 */

// Zonas sobre scr_030 (640×480, findings/13 §4.7). Ajustables por el humano.
const MANAGER_PHOTO: Rect = { x: 8, y: 86, w: 68, h: 92 };
const MANAGER_PLATES: Rect = { x: 84, y: 86, w: 300, h: 92 };
const CENTER_PLATES: Rect = { x: 84, y: 192, w: 472, h: 210 };
const BTN_BACK: Rect = { x: 240, y: 430, w: 160, h: 32 };

// Left/right portrait columns (4 each), read off scr_030 by eye.
const LEFT_COL_X = 8;
const RIGHT_COL_X = 564;
const PORTRAIT_W = 68;
const PORTRAIT_H = 62;
const PORTRAIT_YS = [196, 262, 328, 394];

function portraitRects(x: number): Rect[] {
  return PORTRAIT_YS.map((y) => ({ x, y, w: PORTRAIT_W, h: PORTRAIT_H }));
}

const STAFF_LEFT = ['Presidente', 'Vicepresidente', 'Director deportivo', 'Secretario técnico'];
const STAFF_RIGHT = ['Consejero', 'Consejero', 'Médico', 'Delegado'];

export function DirectivaScreen() {
  const career = useGameStore((s) => s.career);
  const goTo = useGameStore((s) => s.goTo);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const clubName = careerTeamName(career, career.humanTeamId);

  return (
    <Pcf7Frame bitmap="scr_030.png">
      {/* Retrato del mánager + placas de identidad. */}
      <div className="pcf7photo" style={place(MANAGER_PHOTO)}>Mánager</div>
      <div className="pcf7steel" style={{ ...place(MANAGER_PLATES), padding: '0.4em 0.6em', justifyContent: 'center' }}>
        <div className="pcf7ovl pcf7title-ovl" style={{ position: 'static', justifyContent: 'flex-start' }}>{clubName}</div>
        <div className="pcf7ovl pcf7data-ovl" style={{ position: 'static', color: 'var(--c-ink-dim)' }}>
          Entrenador · Temporada {career.temporada}
        </div>
      </div>

      {/* Columnas de retratos de directivos/staff. */}
      {portraitRects(LEFT_COL_X).map((r, i) => (
        <div key={`l${i}`} className="pcf7photo" style={place(r)}>{STAFF_LEFT[i]}</div>
      ))}
      {portraitRects(RIGHT_COL_X).map((r, i) => (
        <div key={`r${i}`} className="pcf7photo" style={place(r)}>{STAFF_RIGHT[i]}</div>
      ))}

      {/* Placas centrales: datos de la relación con la directiva (placeholder). */}
      <div className="pcf7steel" style={place(CENTER_PLATES)}>
        <div className="pcf7steel__scroll">
          <ul className="pcf7list">
            <li><span className="pcf7list__grow">Presupuesto concedido</span><span className="pcf7list__dim">—</span></li>
            <li><span className="pcf7list__grow">Objetivo de la temporada</span><span className="pcf7list__dim">Permanencia</span></li>
            <li><span className="pcf7list__grow">Confianza de la directiva</span><span className="pcf7list__dim">—</span></li>
            <li><span className="pcf7list__grow">Confianza de la afición</span><span className="pcf7list__dim">—</span></li>
          </ul>
          <p className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)', padding: '0.5em 0.7em', margin: 0 }}>
            Panel de directiva (placeholder). Los datos reales se engancharán al store más adelante.
          </p>
        </div>
      </div>

      <button type="button" className="pcf7btn" style={place(BTN_BACK)} onClick={() => goTo('season')}>
        Volver al despacho
      </button>
    </Pcf7Frame>
  );
}
