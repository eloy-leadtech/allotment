import type { StandingRow } from '@engine';
import { currentStandings, isSeasonOver, teamName } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Pcf7Frame, place, type Rect } from '@ui/components/Pcf7Frame';

/**
 * CLASIFICACIÓN — calco de `scr_026`: píldora de título centrada arriba + dos
 * columnas de filas-cápsula (≈10+10) con la tabla de liga en vivo superpuesta,
 * y un recuadro de previsualización abajo con los resultados de la última
 * jornada. Coordenadas sobre el lienzo 640×480 (findings/13 §4.2) — el humano
 * afina estas constantes sobre el bitmap real.
 */

// Zonas sobre scr_026 (640×480). Ajustables por el humano.
const TITLE: Rect = { x: 150, y: 56, w: 340, h: 28 };
const SUBTITLE: Rect = { x: 150, y: 84, w: 340, h: 16 };
const COL_LEFT: Rect = { x: 18, y: 104, w: 300, h: 168 };
const COL_RIGHT: Rect = { x: 322, y: 104, w: 300, h: 168 };
const PREVIEW: Rect = { x: 150, y: 286, w: 340, h: 92 };
const BTN_PLAY: Rect = { x: 150, y: 392, w: 108, h: 30 };
const BTN_SIM: Rect = { x: 266, y: 392, w: 108, h: 30 };
const BTN_BACK: Rect = { x: 382, y: 392, w: 108, h: 30 };

function StandingsColumn({ rows, rect, name, meId, offset }: {
  rows: StandingRow[];
  rect: Rect;
  name: (id: string) => string;
  meId: string;
  offset: number;
}) {
  return (
    <div className="pcf7standcol" style={place(rect)}>
      {rows.map((row, i) => (
        <div
          key={row.teamId}
          className={`pcf7standrow${row.teamId === meId ? ' pcf7standrow--me' : ''}`}
        >
          <span className="pcf7standrow__pos">{offset + i + 1}</span>
          <span className="pcf7standrow__team">{name(row.teamId)}</span>
          <span className="pcf7standrow__num">{row.played}</span>
          <span className="pcf7standrow__num">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</span>
          <span className="pcf7standrow__pts">{row.points}</span>
        </div>
      ))}
    </div>
  );
}

export function SeasonScreen() {
  const season = useGameStore((s) => s.season);
  const division = useGameStore((s) => s.career?.division ?? 'primera');
  const lastResults = useGameStore((s) => s.lastResults);
  const playNextMatchday = useGameStore((s) => s.playNextMatchday);
  const openMatch = useGameStore((s) => s.openMatch);
  const goTo = useGameStore((s) => s.goTo);

  if (!season) {
    return (
      <main className="screen">
        <p>No hay temporada en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const name = (id: string): string => teamName(season, id);
  const table = currentStandings(season);
  const over = isSeasonOver(season);
  const champion = over ? table[0] : undefined;
  const half = Math.ceil(table.length / 2);
  const left = table.slice(0, half);
  const right = table.slice(half);

  return (
    <Pcf7Frame bitmap="scr_026.png">
      <div className="pcf7ovl pcf7title-ovl" style={place(TITLE)}>
        {division === 'segunda' ? 'Segunda' : 'Primera'} · {season.temporada}
      </div>
      <div className="pcf7ovl pcf7data-ovl" style={{ ...place(SUBTITLE), justifyContent: 'center' }}>
        {over ? 'Temporada terminada' : `Jornada ${season.currentMatchday} / ${season.totalMatchdays}`}
      </div>

      <StandingsColumn rows={left} rect={COL_LEFT} name={name} meId={season.humanTeamId} offset={0} />
      <StandingsColumn rows={right} rect={COL_RIGHT} name={name} meId={season.humanTeamId} offset={half} />

      {/* Recuadro de previsualización: campeón o últimos resultados. */}
      <div className="pcf7steel" style={place(PREVIEW)}>
        <div className="pcf7steel__scroll">
          {champion ? (
            <p className="pcf7ovl pcf7title-ovl" style={{ position: 'static', padding: '0.5em', whiteSpace: 'normal' }}>
              🏆 Campeón: {name(champion.teamId)}
            </p>
          ) : lastResults.length > 0 ? (
            <ul className="pcf7list">
              {lastResults.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="pcf7pick pcf7list__grow"
                    style={{ borderBottom: 0 }}
                    onClick={() => openMatch(r)}
                  >
                    {name(r.homeId)} {r.homeGoals}-{r.awayGoals} {name(r.awayId)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pcf7data-ovl" style={{ padding: '0.6em', color: 'var(--c-ink-dim)' }}>
              Aún no se ha jugado ninguna jornada.
            </p>
          )}
        </div>
      </div>

      {/* Acciones. */}
      {over ? (
        <button type="button" className="pcf7btn" style={place({ ...BTN_PLAY, w: 224 })} onClick={() => goTo('seasonEnd')}>
          Fin de temporada →
        </button>
      ) : (
        <>
          <button type="button" className="pcf7btn" style={place(BTN_PLAY)} onClick={() => goTo('prematch')}>
            Jugar
          </button>
          <button type="button" className="pcf7btn" style={place(BTN_SIM)} onClick={playNextMatchday}>
            Simular
          </button>
        </>
      )}
      <button type="button" className="pcf7btn" style={place(BTN_BACK)} onClick={() => goTo('season')}>
        Despacho
      </button>
    </Pcf7Frame>
  );
}
