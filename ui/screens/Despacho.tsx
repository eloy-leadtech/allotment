import {
  availabilityStatus,
  isSeasonOver,
  isWinterWindowOpen,
  nextHumanFixture,
  currentStandings,
  selectPressQuestion,
  stadiumAforo,
  teamName,
  TRAINING_FOCI,
} from '@game';
import { useGameStore } from '@ui/store/gameStore';
import type { Screen } from '@app/navigation';
import type { ReactNode } from 'react';
import { MisterFrame } from '@ui/components/MisterFrame';
import { MisterHeader } from '@ui/components/MisterHeader';
import { MisterIcon } from '@ui/components/MisterSprite';
import { TowerButton } from '@ui/components/TowerButton';
import { Crest } from '@ui/components/Crest';
import { RetroButton } from '@ui/components/RetroButton';

/**
 * The DESPACHO hub, rebuilt with the Mister skin: two towers of metal-plate
 * section buttons with live data (navigation happens through them — no tab
 * strip), competition cards and the play zone in the centre. The old PCF7
 * bitmap (`scr_032.png`) is gone.
 */

interface SectionDef {
  name: string;
  icon?: string;
  hint?: ReactNode;
  hintTone?: 'alert' | 'good';
  pip?: 'alert' | 'pending';
  pipLabel?: string;
  to?: Screen;
  onClick?: () => void;
}

interface GroupDef {
  title: string;
  sections: SectionDef[];
}

export function Despacho() {
  const season = useGameStore((s) => s.season);
  const career = useGameStore((s) => s.career);
  const playNextMatchday = useGameStore((s) => s.playNextMatchday);
  const openWinterMarket = useGameStore((s) => s.openWinterMarket);
  const lastCallUp = useGameStore((s) => s.lastCallUp);
  const goTo = useGameStore((s) => s.goTo);

  if (!season || !career) {
    return (
      <main className="screen">
        <p>No hay temporada en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const clubId = career.humanTeamId;
  const over = isSeasonOver(season);
  const fixture = over ? null : nextHumanFixture(season);
  const rivalId = fixture ? (fixture.homeId === clubId ? fixture.awayId : fixture.homeId) : null;
  const enCasa = fixture ? fixture.homeId === clubId : false;

  const rows = currentStandings(season);
  const posIdx = rows.findIndex((r) => r.teamId === clubId);
  const myRow = posIdx >= 0 ? rows[posIdx] : undefined;

  const humanTeam = career.teams.find((t) => t.id === clubId);
  const plantilla = humanTeam?.players ?? [];
  const bajas = plantilla.filter(
    (p) => availabilityStatus(season.availability[p.id], season.currentMatchday).status !== 'fit',
  ).length;

  const winterOpen = isWinterWindowOpen(career);
  const pressPending = selectPressQuestion(career) != null;
  const formation = career.tactics?.formation ?? '4-4-2';
  const trainingLabel =
    TRAINING_FOCI.find((f) => f.focus === career.training?.focus)?.label ?? 'Equilibrado';
  const aforo = stadiumAforo(career.stadium);
  const confianza = career.confianza?.directiva;

  const left: GroupDef[] = [
    {
      title: 'Terreno de juego',
      sections: [
        {
          name: 'Plantilla',
          icon: 'ic-alineacion',
          to: 'squad',
          hint:
            bajas > 0 ? (
              <>
                <em>{bajas}</em> {bajas === 1 ? 'baja' : 'bajas'}
              </>
            ) : (
              `${plantilla.length} fichas`
            ),
          hintTone: bajas > 0 ? 'alert' : undefined,
          pip: bajas > 0 ? 'pending' : undefined,
          pipLabel: 'Hay bajas en la plantilla',
        },
        { name: 'Táctica', icon: 'ic-tactica', to: 'tactics', hint: formation },
        { name: 'Entrenamiento', icon: 'ic-entrenamiento', to: 'training', hint: trainingLabel },
      ],
    },
    {
      title: 'Cantera y ojeo',
      sections: [
        {
          name: 'Cantera',
          icon: 'ic-cantera',
          to: 'youth',
          hint: `${career.youthProspects.length} juveniles`,
        },
        {
          name: 'Promesas',
          icon: 'ic-moral',
          to: 'prospects',
          hint: `${Object.keys(career.prospectTracking).length} seguidas`,
        },
        {
          name: 'Ojeador',
          icon: 'ic-leyendas',
          to: 'ojeo',
          hint: `${Object.keys(career.scouting).length} informes`,
        },
      ],
    },
    {
      title: 'La temporada',
      sections: [
        {
          name: 'Clasificación',
          icon: 'ic-clasificacion',
          to: 'standings',
          hint: myRow ? (
            <>
              {posIdx + 1}.º · <em>{myRow.points} pts</em>
            </>
          ) : undefined,
        },
        { name: 'Estadísticas', icon: 'ic-resultados', to: 'stats' },
        { name: 'Comparativa', icon: 'ic-lesiones', to: 'comparativa' },
      ],
    },
  ];

  const right: GroupDef[] = [
    {
      title: 'Club',
      sections: [
        {
          name: 'Directiva',
          icon: 'ic-directiva',
          to: 'directiva',
          hint:
            confianza !== undefined ? (
              <>
                Confianza <em>{confianza}</em>
              </>
            ) : undefined,
          hintTone: confianza !== undefined && confianza < 30 ? 'alert' : undefined,
        },
        { name: 'Cuerpo técnico', icon: 'ic-prensa', to: 'staff' },
        {
          name: 'Estadio',
          icon: 'ic-clasificacion',
          to: 'stadium',
          hint: (
            <>
              Aforo <em>{aforo.toLocaleString('es-ES')}</em>
            </>
          ),
        },
      ],
    },
    {
      title: 'Despacho',
      sections: [
        {
          name: 'Fichajes',
          icon: 'ic-fichajes',
          hint: winterOpen ? <em>¡Ventana abierta!</em> : undefined,
          hintTone: winterOpen ? 'alert' : undefined,
          pip: winterOpen ? 'alert' : undefined,
          pipLabel: 'Ventana de invierno abierta',
          onClick: winterOpen ? openWinterMarket : () => goTo('market'),
        },
        { name: 'Patrocinio', icon: 'ic-finanzas', to: 'sponsors' },
        {
          name: 'Prensa',
          icon: 'ic-prensa',
          to: 'press',
          hint: pressPending ? <em>Te esperan</em> : undefined,
          hintTone: pressPending ? 'alert' : undefined,
          pip: pressPending ? 'alert' : undefined,
          pipLabel: 'La prensa espera tus declaraciones',
        },
      ],
    },
    {
      title: 'Historia',
      sections: [
        {
          name: 'Palmarés',
          icon: 'ic-leyendas',
          to: 'palmares',
          hint: `${career.palmares.length} títulos`,
        },
        { name: 'Hemeroteca', icon: 'ic-calendario', to: 'hemeroteca' },
        { name: 'Guardar', to: 'slots' },
        { name: 'Menú', to: 'title' },
      ],
    },
  ];

  const renderTower = (groups: GroupDef[]) => (
    <div className="mst-tower">
      {groups.map((g) => (
        <div key={g.title} className="mst-grp">
          <p className="mst-grp__h">{g.title}</p>
          {g.sections.map((s) => (
            <TowerButton
              key={s.name}
              name={s.name}
              icon={s.icon ? <MisterIcon id={s.icon} /> : undefined}
              hint={s.hint}
              hintTone={s.hintTone}
              pip={s.pip}
              pipLabel={s.pipLabel}
              onClick={s.onClick ?? (() => goTo(s.to as Screen))}
            />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <MisterFrame header={<MisterHeader />}>
      <div className="mst-despacho">
        {/* Una tarjeta por competición en juego. */}
        <div className="mst-fixtures">
          <button type="button" className="mst-fx" onClick={() => goTo('standings')}>
            {rivalId && (
              <span className="mst-fx__crest">
                <Crest teamId={rivalId} size={40} />
              </span>
            )}
            <span className="mst-fx__main">
              <span className="mst-fx__rival">
                {over ? 'Temporada terminada' : rivalId ? teamName(season, rivalId) : 'Liga'}
              </span>
              <span className="mst-fx__meta">
                {over ? (
                  'Ver clasificación'
                ) : (
                  <>
                    <b>Jornada {fixture?.round}</b>
                    <i>·</i>
                    <em>{enCasa ? 'Casa' : 'Fuera'}</em>
                  </>
                )}
              </span>
            </span>
          </button>
          {career.copa && (
            <button type="button" className="mst-fx" onClick={() => goTo('copa')}>
              <span className="mst-fx__main">
                <span className="mst-fx__rival">Copa</span>
                <span className="mst-fx__meta">Ver eliminatorias</span>
              </span>
            </button>
          )}
          {career.europa && (
            <button type="button" className="mst-fx" onClick={() => goTo('europa')}>
              <span className="mst-fx__main">
                <span className="mst-fx__rival">Europa</span>
                <span className="mst-fx__meta">Ver la competición</span>
              </span>
            </button>
          )}
        </div>

        <div className="mst-despacho__body">
          {renderTower(left)}

          <div className="mst-core">
            <button
              type="button"
              className="mst-play"
              onClick={() => goTo(over ? 'seasonEnd' : 'prematch')}
            >
              <span className="mst-play__n">{over ? 'Fin de temporada' : 'Jugar jornada'}</span>
              {!over && (
                <span className="mst-play__d">
                  Jornada {season.currentMatchday} de {season.totalMatchdays}
                </span>
              )}
            </button>
            {!over && (
              <button type="button" className="mst-sim" onClick={playNextMatchday}>
                Simular jornada
              </button>
            )}

            {winterOpen && (
              <p className="mst-notice">
                ❄️ Ventana de fichajes de invierno abierta.{' '}
                <button type="button" className="mst-notice__btn" onClick={openWinterMarket}>
                  Ir al mercado de invierno →
                </button>
              </p>
            )}
            {pressPending && (
              <p className="mst-notice">
                🎙️ La prensa espera tus declaraciones.{' '}
                <button type="button" className="mst-notice__btn" onClick={() => goTo('press')}>
                  Comparecer →
                </button>
              </p>
            )}
            {lastCallUp && lastCallUp.players.length > 0 && (
              <p className="mst-notice">
                ✈️ {lastCallUp.players.length}{' '}
                {lastCallUp.players.length === 1 ? 'jugador vuelve' : 'jugadores vuelven'} del parón
                de selecciones con fatiga extra.
              </p>
            )}
          </div>

          {renderTower(right)}
        </div>
      </div>
    </MisterFrame>
  );
}
