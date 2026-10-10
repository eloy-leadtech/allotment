import { useRef, useState } from 'react';
import {
  teamName,
  currentStandings,
  selectPressQuestion,
  stadiumAforo,
  formatEuros,
  isSeasonOver,
  isWinterWindowOpen,
} from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { Crest } from '@ui/components/Crest';
import { MisterSprite, MisterIcon } from '@ui/mister/MisterSprite';
import { RivalTicker } from '@ui/mister/RivalTicker';
import { useStadiumCanvas } from '@ui/mister/useStadiumCanvas';
import { usePhotoCarousel } from '@ui/mister/usePhotoCarousel';
import { useRivalFacts } from '@ui/mister/facts';
import { buildFixtures, type FxEntry } from '@ui/mister/fixtures';
import { TOWER } from '@ui/mister/sections';

/**
 * El DESPACHO: port 1:1 de la maqueta "Mister" (`ui-ref/despacho-local.html`),
 * alimentado por el store en vez de los datos de muestra. Este Slice 1 arma el
 * SHELL: consola (fondo de estadio + fotos que rotan + grano), cabecera (club,
 * puesto/pts/saldo, rival y jornada), barra de próximos partidos, teletipo del
 * rival y la torre de secciones a la izquierda. Cada sección navega a su pantalla
 * existente; su contenido se mudará dentro del despacho en slices posteriores.
 */
export function Despacho() {
  const season = useGameStore((s) => s.season);
  const career = useGameStore((s) => s.career);
  const goTo = useGameStore((s) => s.goTo);
  const hasEuropa = useGameStore((s) => s.career?.europa != null);
  const openWinterMarket = useGameStore((s) => s.openWinterMarket);
  const lastCallUp = useGameStore((s) => s.lastCallUp);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoARef = useRef<HTMLImageElement>(null);
  const photoBRef = useRef<HTMLImageElement>(null);
  useStadiumCanvas(canvasRef);
  const credit = usePhotoCarousel(photoARef, photoBRef);
  const facts = useRivalFacts();

  const human = season?.humanTeamId ?? '';
  const fixtures = season ? buildFixtures(season, career) : [];
  const [selectedComp, setSelectedComp] = useState<FxEntry['key']>('liga');

  if (!season) {
    return (
      <main className="mister mister--empty">
        <p>No hay temporada en curso.</p>
        <button type="button" className="sec" onClick={() => goTo('title')}>
          Menú
        </button>
      </main>
    );
  }

  const base = import.meta.env.BASE_URL;
  const logoUrl = (slug: string): string => `${base}ui/mister/logos/${slug}.png`;
  const crestUrl = (teamId: string): string => `${base}crests/${teamId}.png`;
  const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>): void => {
    e.currentTarget.style.visibility = 'hidden';
  };

  const clubName = teamName(season, human);
  const standings = currentStandings(season);
  const humanRow = standings.find((r) => r.teamId === human);
  const pos = humanRow ? standings.indexOf(humanRow) + 1 : 0;
  const pts = humanRow?.points ?? 0;
  const saldo = career ? formatEuros(career.budget) : '—';
  const total = season.totalMatchdays;
  const played = Math.min(Math.max(season.currentMatchday - 1, 0), total);
  const aforo = career ? stadiumAforo(career.stadium) : 0;
  const squadSize = season.teams.find((t) => t.id === human)?.players.length ?? 0;
  const formation = career?.tactics?.formation ?? '4-4-2';
  const pressPending = career ? selectPressQuestion(career) != null : false;
  const over = isSeasonOver(season);
  const winterOpen = career ? isWinterWindowOpen(career) : false;
  const callUpCount = lastCallUp?.players.length ?? 0;

  const liga = fixtures.find((e) => e.key === 'liga');
  const selected = fixtures.find((e) => e.key === selectedComp) ?? fixtures[0];
  const tickerSlug = selected?.rivalId ?? '';
  const tickerName = selected?.rivalName ?? '';

  /** Real sublabel + pip for a tower section (honest values only; others blank). */
  const towerDetail = (label: string): { text: string; pip?: 'q' } | null => {
    switch (label) {
      case 'Clasificación':
        return pos > 0 ? { text: `${pos}.º · ${pts} pts` } : null;
      case 'Táctica':
        return { text: formation };
      case 'Finanzas':
        return { text: saldo };
      case 'Estadio':
        return { text: `Aforo ${aforo.toLocaleString('es-ES')}` };
      case 'Alineación':
        return { text: `${squadSize} fichas` };
      case 'Prensa':
        return pressPending ? { text: 'Declaraciones', pip: 'q' } : null;
      default:
        return null;
    }
  };

  return (
    <main className="mister">
      <MisterSprite />
      <div className="wrap">
        <div className="console">
          <canvas className="bg" ref={canvasRef} aria-hidden="true" />
          <div className="photos" aria-hidden="true">
            <img className="photo" ref={photoARef} alt="" />
            <img className="photo" ref={photoBRef} alt="" />
          </div>
          <div className="grain" aria-hidden="true" />

          <div className="screen">
            {/* ── cabecera ── */}
            <header className="head">
              <div className="head-barra">
                <div className="hb-lado">
                  <span className="hb-esc">
                    <Crest teamId={human} size={81} />
                  </span>
                  <span className="tc-txt">
                    <span className="tc-name">{clubName}</span>
                    <span className="tc-sub">
                      <b>{pos > 0 ? `${pos}.º` : '—'}</b> en Liga<i>·</i>
                      <b>{pts} pts</b>
                      <i>·</i>Saldo <b>{saldo}</b>
                    </span>
                  </span>
                </div>

                <div className="hb-lado rival">
                  <span className="tc-txt">
                    <span className="tc-lbl">Próximo partido</span>
                    <span className="tc-name">{liga?.rivalName || '—'}</span>
                    <span className="tc-sub">
                      {liga?.status ? (
                        <em>{liga.status}</em>
                      ) : (
                        <>
                          Liga · {liga?.roundLabel}
                          <i>·</i>
                          <em>{liga?.detail}</em>
                        </>
                      )}
                    </span>
                  </span>
                  <span className="hb-esc">
                    {liga?.rivalId ? <Crest teamId={liga.rivalId} size={81} /> : null}
                  </span>
                </div>
              </div>

              <div className="head-comp">
                <img className="nm-comp" src={logoUrl('lfp_1993')} alt="Liga" onError={hideOnError} />
                <span className="today-date">{season.temporada}</span>
                <span className="today-week">
                  Jugadas {played} de {total}
                </span>
              </div>
            </header>

            {/* ── teletipo del rival ── */}
            <RivalTicker slug={tickerSlug} name={tickerName} facts={facts} />

            {/* ── vistas conmutables (Slice 1: solo el despacho) ── */}
            <div className="views">
              <section className="view is-active" data-view="despacho">
                {/* próximos partidos = selector de competición */}
                <div
                  className="fixtures"
                  role="tablist"
                  aria-label="Próximo partido en cada competición"
                  style={{ gridTemplateColumns: `repeat(${Math.max(fixtures.length, 1)}, 1fr)` }}
                >
                  {fixtures.map((e) => (
                    <button
                      key={e.key}
                      type="button"
                      className="fx"
                      role="tab"
                      aria-selected={e.key === selectedComp}
                      onClick={() => setSelectedComp(e.key)}
                    >
                      <span className="fx-main">
                        <span className="fx-body">
                          {e.rivalId ? (
                            <img className="fx-crest" src={crestUrl(e.rivalId)} alt="" onError={hideOnError} />
                          ) : null}
                          <span className="fx-rival">{e.rivalName || 'Liga'}</span>
                        </span>
                        <span className="fx-meta">
                          <span className="fx-round">{e.roundLabel}</span>
                          {e.status ? (
                            <>
                              <i>·</i>
                              <b>{e.status}</b>
                            </>
                          ) : null}
                          {e.detail ? (
                            <>
                              <i>·</i>
                              <em>{e.detail}</em>
                            </>
                          ) : null}
                        </span>
                      </span>
                      <span className="fx-side">
                        <img className="fx-logo" src={logoUrl(e.logo)} alt="" onError={hideOnError} />
                      </span>
                    </button>
                  ))}
                </div>

                {/* cuerpo del despacho: torre de secciones + centro (foto) */}
                <div className="body">
                  <div className="tower" id="towerL">
                    {TOWER.map((group) => (
                      <div className="grp" key={group.heading}>
                        <p className="grp-h">{group.heading}</p>
                        {group.items.map((item) => {
                          const detail = towerDetail(item.label);
                          return (
                            <button
                              key={item.label}
                              type="button"
                              className="sec"
                              onClick={() => goTo(item.to)}
                            >
                              <span className="thumb">
                                <MisterIcon name={item.icon} />
                              </span>
                              <span className="txt">
                                <span className="n">{item.label}</span>
                                {detail ? <span className="d">{detail.text}</span> : null}
                              </span>
                              {detail?.pip ? <span className="pip q" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="core" />
                </div>

                {/* Controles de partida: dock pequeño a un lado (provisional; la
                    maqueta no los tenía y el centro debe lucir la foto). */}
                <div className="office-dock">
                  {pressPending || callUpCount > 0 ? (
                    <div className="office-notes">
                      {pressPending ? <span className="office-note">🎙️ La prensa espera</span> : null}
                      {callUpCount > 0 ? (
                        <span className="office-note good">✈️ {callUpCount} del parón</span>
                      ) : null}
                    </div>
                  ) : null}
                  {winterOpen ? (
                    <button type="button" className="office-go" onClick={openWinterMarket}>
                      ❄ Mercado de invierno
                    </button>
                  ) : over ? (
                    <button type="button" className="office-go" onClick={() => goTo('seasonEnd')}>
                      Fin de temporada ▸
                    </button>
                  ) : (
                    <button type="button" className="office-go" onClick={() => goTo('prematch')}>
                      ▶ Jugar jornada
                    </button>
                  )}
                  <div className="office-links">
                    <button type="button" className="office-link" onClick={() => goTo('slots')}>
                      Guardar
                    </button>
                    {career?.copa ? (
                      <button type="button" className="office-link" onClick={() => goTo('copa')}>
                        Copa
                      </button>
                    ) : null}
                    {hasEuropa ? (
                      <button type="button" className="office-link" onClick={() => goTo('europa')}>
                        Europa
                      </button>
                    ) : null}
                    <button type="button" className="office-link" onClick={() => goTo('title')}>
                      Menú
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* pie "La historia" del fondo actual */}
            <p className="pcredit">
              {credit ? (
                <>
                  <span className="pc-tag">La historia</span>
                  <span className="pc-titulo">{credit.cap}</span>
                  {credit.autor ? <span className="pc-src">{credit.autor}</span> : null}
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
