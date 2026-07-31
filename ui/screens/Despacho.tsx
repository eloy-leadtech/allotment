import { isSeasonOver, teamName } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import type { Screen } from '@app/navigation';
import { RetroButton } from '@ui/components/RetroButton';

/**
 * The DESPACHO (office) hub, rebuilt as a faithful replica of PC Fútbol 7's main
 * menu: the real 640×480 screen bitmap (`scr_032.png`) is shown as the background
 * and we overlay (a) 12 clickable hotspots over the pre-drawn icons and (b) our
 * live data (club, competition, matchday) on the empty plates, plus the 9 bottom
 * tabs. Coordinates are expressed against the original 640×480 canvas so the whole
 * thing scales while keeping its 4:3 proportion.
 */

/** A rectangle on the original 640×480 canvas. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CANVAS_W = 640;
const CANVAS_H = 480;

/** Turn a canvas-space rectangle into a percentage-based absolute style. */
function place({ x, y, w, h }: Rect): React.CSSProperties {
  return {
    left: `${(x / CANVAS_W) * 100}%`,
    top: `${(y / CANVAS_H) * 100}%`,
    width: `${(w / CANVAS_W) * 100}%`,
    height: `${(h / CANVAS_H) * 100}%`,
  };
}

interface Hotspot {
  rect: Rect;
  label: string;
  /** Destination screen, or null for sections not yet built as their own screen. */
  to: Screen | null;
}

// The two icon columns of scr_032: left = management (blue/warm), right = sporting
// (green). Each icon is ~55×30 px, grouped 3+3 with a vertical gap in the middle.
// These are read off scr_032 by eye and are the values most worth a human's review.
const ICON_W = 55;
const ROW_H = 30;
const LEFT_X = 123;
const RIGHT_X = 551;
const GROUP_A = [136, 168, 199]; // top three rows (y)
const GROUP_B = [260, 292, 323]; // bottom three rows (y)
const ICON_ROWS = [...GROUP_A, ...GROUP_B];

const LEFT_ICONS: Array<{ label: string; to: Screen | null }> = [
  { label: 'Resultados', to: 'standings' },
  { label: 'Calendario', to: 'standings' },
  { label: 'Finanzas', to: 'market' },
  { label: 'Prensa', to: null },
  { label: 'Directiva', to: null },
  { label: 'Fichajes', to: 'market' },
];

const RIGHT_ICONS: Array<{ label: string; to: Screen | null }> = [
  { label: 'Alineación', to: 'squad' },
  { label: 'Táctica', to: 'tactics' },
  { label: 'Ojeador', to: 'market' },
  { label: 'Vídeo', to: null },
  { label: 'Entrenamiento', to: 'tactics' },
  { label: 'Estadio', to: null },
];

function buildIconHotspots(x: number, defs: Array<{ label: string; to: Screen | null }>): Hotspot[] {
  return defs.map((def, i) => ({
    rect: { x, y: ICON_ROWS[i] ?? 0, w: ICON_W, h: ROW_H },
    label: def.label,
    to: def.to,
  }));
}

export function Despacho() {
  const season = useGameStore((s) => s.season);
  const hasEuropa = useGameStore((s) => s.career?.europa != null);
  const playNextMatchday = useGameStore((s) => s.playNextMatchday);
  const goTo = useGameStore((s) => s.goTo);

  if (!season) {
    return (
      <main className="screen">
        <p>No hay temporada en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const clubName = teamName(season, season.humanTeamId);
  const over = isSeasonOver(season);
  const playedMatchday = Math.min(season.currentMatchday, season.totalMatchdays);
  const bg = `${import.meta.env.BASE_URL}ui/pcf7/scr_032.png`;

  const leftHotspots = buildIconHotspots(LEFT_X, LEFT_ICONS);
  const rightHotspots = buildIconHotspots(RIGHT_X, RIGHT_ICONS);

  // The nearest existing screen for a section not yet built stays on the office.
  const openSection = (to: Screen | null): void => {
    if (to) goTo(to);
  };

  // The 9 bottom tabs = the persistent global switcher. "Liga" is the active one.
  const tabs: Array<{ label: string; onClick: () => void; active?: boolean; disabled?: boolean }> = [
    { label: 'Liga', onClick: () => undefined, active: true },
    { label: 'Clasificación', onClick: () => goTo('standings') },
    { label: 'Copa', onClick: () => goTo('copa') },
    { label: 'Europa', onClick: () => goTo('europa'), disabled: !hasEuropa },
    { label: 'Mercado', onClick: () => goTo('market') },
    { label: 'Plantilla', onClick: () => goTo('squad') },
    { label: 'Táctica', onClick: () => goTo('tactics') },
    { label: 'Guardar', onClick: () => goTo('slots') },
    { label: 'Menú', onClick: () => goTo('title') },
  ];

  return (
    <main className="screen screen--despacho">
      <div
        className="despacho7"
        style={{ backgroundImage: `url(${bg})`, aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      >
        {/* Live data over the empty plates */}
        <div className="despacho7__plate despacho7__plate--club" style={place({ x: 155, y: 8, w: 148, h: 30 })}>
          {clubName}
        </div>
        <div className="despacho7__plate despacho7__plate--comp" style={place({ x: 382, y: 8, w: 154, h: 30 })}>
          LIGA · {season.temporada}
        </div>
        <div className="despacho7__plate despacho7__plate--data" style={place({ x: 382, y: 56, w: 154, h: 26 })}>
          {over ? 'Temporada terminada' : `Jornada ${playedMatchday}/${season.totalMatchdays}`}
        </div>

        {/* 12 icon hotspots */}
        {[...leftHotspots, ...rightHotspots].map((h) => (
          <button
            key={h.label}
            type="button"
            className={`despacho7__hotspot${h.to ? '' : ' despacho7__hotspot--soon'}`}
            style={place(h.rect)}
            title={h.to ? h.label : `${h.label} (próximamente)`}
            aria-label={h.label}
            onClick={() => openSection(h.to)}
          />
        ))}

        {/* Central trophy zone = play/continue the matchday */}
        <button
          type="button"
          className="despacho7__hotspot despacho7__hotspot--play"
          style={place({ x: 285, y: 150, w: 100, h: 95 })}
          title={over ? 'Fin de temporada' : 'Jugar jornada'}
          aria-label={over ? 'Fin de temporada' : 'Jugar jornada'}
          onClick={() => goTo(over ? 'seasonEnd' : 'prematch')}
        />
        {!over ? (
          <button
            type="button"
            className="despacho7__hotspot despacho7__sim"
            style={place({ x: 285, y: 250, w: 100, h: 22 })}
            title="Simular jornada"
            aria-label="Simular jornada"
            onClick={playNextMatchday}
          >
            Simular
          </button>
        ) : null}

        {/* 9 bottom tabs (regleta de solapas) */}
        <div className="despacho7__tabs" style={place({ x: 2, y: 404, w: 636, h: 70 })}>
          {tabs.map((t) => (
            <button
              key={t.label}
              type="button"
              className={`despacho7__tab${t.active ? ' despacho7__tab--active' : ''}`}
              onClick={t.onClick}
              disabled={t.disabled}
              aria-current={t.active ? 'page' : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
