import {
  previewTransition,
  careerTeamName,
  careerOutcome,
  nextDivision,
  currentStandings,
  currentSeasonAwards,
  endOfSeasonEvaluation,
  economicDismissal,
  totalDebt,
  endOfSeasonConfianza,
  isManagerDismissed,
  titlesWonThisSeason,
  palmaresCompetitionLabel,
  palmaresCompetitionIcon,
  formatEuros,
} from '@game';
import { nextSeasonByTemporada, getSegundaByTemporada, catalogEntry, catalogFor } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Crest } from '@ui/components/Crest';
import { Pcf7Console } from '@ui/components/Pcf7Frame';
import { ConfianzaMeters } from '@ui/components/ConfianzaMeters';
import { RenewalsPanel } from '@ui/components/RenewalsPanel';
import { objectiveLabel, satisfactionLabel, satisfactionIcon } from './objectiveText';

const divisionName = (d: 'primera' | 'segunda'): string =>
  d === 'primera' ? 'Primera División' : 'Segunda División';

/** Flow (non-absolute) paragraph inside the PCF7 console body. */
const FLOW = { position: 'static', margin: 0, whiteSpace: 'normal' } as const;

export function SeasonEndScreen() {
  const career = useGameStore((s) => s.career);
  const retainIds = useGameStore((s) => s.retainIds);
  const toggleRetain = useGameStore((s) => s.toggleRetain);
  const continueCareer = useGameStore((s) => s.continueCareer);
  const isCatalogCareer = useGameStore((s) => s.isCatalogCareer);
  const continueCatalogCareer = useGameStore((s) => s.continueCatalogCareer);
  const goTo = useGameStore((s) => s.goTo);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const name = (id: string): string => careerTeamName(career, id);
  const champion = currentStandings(career.season)[0]?.teamId ?? career.humanTeamId;

  // Catalogue careers chain by the catalogue (same country/division), without the
  // Spain-only cup/Europe/promotion machinery. Kept separate so the classic path
  // below is untouched.
  if (isCatalogCareer) {
    const cur = catalogEntry(career.leagueId);
    const chain = cur
      ? catalogFor(cur.country, cur.division)
          .slice()
          .sort((a, b) => a.season.localeCompare(b.season))
      : [];
    const i = chain.findIndex((e) => e.id === career.leagueId);
    const nextCat = i >= 0 ? chain[i + 1] : undefined;
    const footer = nextCat ? (
      <>
        <button type="button" className="pcf7flatbtn pcf7flatbtn--primary" onClick={continueCatalogCareer}>
          Continuar a {nextCat.temporada} →
        </button>
        <button type="button" className="pcf7flatbtn" onClick={() => goTo('season')}>Atrás</button>
      </>
    ) : (
      <>
        <button type="button" className="pcf7flatbtn" onClick={() => goTo('slots')}>Guardar / Cargar</button>
        <button type="button" className="pcf7flatbtn" onClick={() => goTo('title')}>Menú</button>
      </>
    );
    return (
      <Pcf7Console title={`Fin de temporada ${career.temporada}`} status={cur?.nombre ?? ''} footer={footer}>
        <p className="pcf7ovl pcf7title-ovl" style={{ ...FLOW, justifyContent: 'flex-start' }}>
          🏆 Campeón: {name(champion)}
        </p>
        {career.history.length > 0 ? (
          <section className="pcf7card">
            <div className="pcf7card__head">Palmarés</div>
            <ul className="pcf7list">
              {career.history.map((h) => (
                <li key={h.seasonNumber}>
                  <span className="pcf7list__grow">{h.temporada}</span>
                  <strong>{name(h.championId)}</strong>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <span className="team-cell" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4em' }}>
          <Crest teamId={career.humanTeamId} size={20} />
          <span className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)' }}>
            {nextCat ? 'Continúas con tu equipo la próxima temporada.' : 'Fin del catálogo para esta liga.'}
          </span>
        </span>
      </Pcf7Console>
    );
  }

  const awards = currentSeasonAwards(career);
  // Titles the human just won this season (not yet committed to `palmares`, which
  // is appended at the transition). Computed live so the banner is immediate.
  const titlesThisSeason = titlesWonThisSeason(career, champion);

  const outcome = careerOutcome(career);
  const evaluation = endOfSeasonEvaluation(career);
  const economicallySacked = economicDismissal(career);
  const confianza = endOfSeasonConfianza(career);
  const debt = totalDebt(career);
  // The tenure ends here if the board sacks by objective miss OR the directiva
  // confianza meter collapses (both in isManagerDismissed) OR ruinous debt.
  const dismissed = isManagerDismissed(career) || economicallySacked;
  const objective = career.board.objective;
  const toDivision = nextDivision(career.division, outcome);
  const changing = toDivision !== career.division;

  const nextPrimera = nextSeasonByTemporada(career.temporada);
  const targetEntry = nextPrimera
    ? toDivision === 'primera'
      ? nextPrimera
      : getSegundaByTemporada(nextPrimera.temporada)
    : undefined;
  // Same-division advance keeps the historical KEEP/RELEASE flow.
  const sameLeague = targetEntry && !changing ? targetEntry.load() : null;
  const preview = sameLeague ? previewTransition(career, sameLeague) : null;

  const footer =
    targetEntry && !dismissed ? (
      <>
        <button type="button" className="pcf7flatbtn pcf7flatbtn--primary" onClick={continueCareer}>
          Continuar a {targetEntry.temporada} ({divisionName(toDivision)}) →
        </button>
        <button type="button" className="pcf7flatbtn" onClick={() => goTo('season')}>Atrás</button>
      </>
    ) : (
      <>
        <button type="button" className="pcf7flatbtn" onClick={() => goTo('slots')}>Guardar / Cargar</button>
        <button type="button" className="pcf7flatbtn" onClick={() => goTo('title')}>Menú</button>
      </>
    );

  return (
    <Pcf7Console title={`Fin de temporada ${career.temporada}`} status={divisionName(career.division)} footer={footer}>
      <p className="pcf7ovl pcf7title-ovl" style={{ ...FLOW, justifyContent: 'flex-start' }}>
        🏆 Campeón: {name(champion)}
      </p>

      <section className="pcf7card">
        <div className="pcf7card__head">Trofeos individuales</div>
        {awards.pichichi ? (
          <p className="trophy trophy--pichichi" style={FLOW}>
            ⚽ Pichichi: <strong>{awards.pichichi.playerName}</strong> ({name(awards.pichichi.teamId)}){' '}
            — {awards.pichichi.goals} {awards.pichichi.goals === 1 ? 'gol' : 'goles'}
          </p>
        ) : (
          <p className="hint" style={FLOW}>Aún no hay goleadores registrados.</p>
        )}
        {awards.zamora ? (
          <p className="trophy trophy--zamora" style={FLOW}>
            🧤 Zamora: <strong>{awards.zamora.playerName}</strong> ({name(awards.zamora.teamId)}){' '}
            — {awards.zamora.goalsConceded} encajados en {awards.zamora.matches}{' '}
            {awards.zamora.matches === 1 ? 'partido' : 'partidos'}
          </p>
        ) : null}
      </section>

      {titlesThisSeason.length > 0 ? (
        <section className="pcf7card">
          <div className="pcf7card__head">¡Títulos de esta temporada!</div>
          <ul className="pcf7list">
            {titlesThisSeason.map((t) => (
              <li key={t.competition}>
                <span className="pcf7list__grow">
                  {palmaresCompetitionIcon(t.competition)}{' '}
                  <strong>{palmaresCompetitionLabel(t.competition, t.division)}</strong>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="pcf7card">
        <div className="pcf7card__head">Balance de la directiva</div>
        <p className="board-objective" style={FLOW}>
          🎯 Objetivo: {objectiveLabel(objective.type)}{' '}
          <span className="hint">(no peor que el puesto {objective.targetPosition})</span>
        </p>
        <p className={`board-mood board-mood--${evaluation.satisfaction}`} style={FLOW}>
          {satisfactionIcon(evaluation.satisfaction)} {satisfactionLabel(evaluation.satisfaction)}
        </p>
        {debt > 0 ? (
          <p className={`fate ${economicallySacked ? 'fate--down' : ''}`} style={FLOW}>
            🔴 Deuda del club: <strong>−{formatEuros(debt)}</strong>
            {economicallySacked ? '' : '. Sanéala o la directiva perderá la paciencia.'}
          </p>
        ) : null}
        <ConfianzaMeters confianza={confianza} showWarning={!dismissed} />
        {dismissed ? (
          <p className="fate fate--down" style={FLOW}>
            ⛔ La directiva te DESTITUYE. Aquí termina tu etapa en el club.
          </p>
        ) : null}
        {economicallySacked ? (
          <p className="fate fate--down" style={FLOW}>
            ⛔ La directiva te DESTITUYE por la pésima gestión económica. Aquí termina tu etapa.
          </p>
        ) : null}
      </section>

      {outcome === 'relegated' ? (
        <p className="pcf7data-ovl" style={{ ...FLOW, color: '#ff8a8a' }}>
          ⬇️ Desciendes a Segunda División. Tu equipo baja contigo.
        </p>
      ) : null}
      {outcome === 'promoted' ? (
        <p className="pcf7data-ovl" style={{ ...FLOW, color: '#8affa0' }}>
          ⬆️ ¡Asciendes a Primera División! Subes con tu equipo.
        </p>
      ) : null}

      {career.history.length > 0 ? (
        <section className="pcf7card">
          <div className="pcf7card__head">Campeones de Liga</div>
          <ul className="pcf7list">
            {career.history.map((h) => (
              <li key={h.seasonNumber}>
                <span className="pcf7list__grow">{h.temporada}</span>
                <strong>{name(h.championId)}</strong>
                {h.pichichi ? (
                  <span className="pcf7list__dim">
                    {' '}
                    · ⚽ {h.pichichi.playerName} ({h.pichichi.goals})
                  </span>
                ) : null}
                {h.zamora ? (
                  <span className="pcf7list__dim">
                    {' '}
                    · 🧤 {h.zamora.playerName} ({h.zamora.goalsConceded})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {career.palmares.length > 0 || titlesThisSeason.length > 0 ? (
        <button type="button" className="pcf7flatbtn" onClick={() => goTo('palmares')}>
          Ver palmarés del club 🏅
        </button>
      ) : null}

      {targetEntry && !dismissed ? <RenewalsPanel /> : null}

      {preview && targetEntry ? (
        preview.departures.length > 0 ? (
          <section className="pcf7card">
            <div className="pcf7card__head">
              La historia se llevaría a estos jugadores ({targetEntry.temporada})
            </div>
            <p className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)', padding: '0.4em 0.7em', margin: 0 }}>
              Marca a quién quieres RETENER en tu equipo.
            </p>
            <ul className="pcf7list">
              {preview.departures.map((p) => (
                <li key={p.id}>
                  <label className="pcf7list__grow" style={{ display: 'flex', alignItems: 'center', gap: '0.4em' }}>
                    <input type="checkbox" checked={retainIds.includes(p.id)} onChange={() => toggleRetain(p.id)} />
                    <span>{p.nombre}</span>
                  </label>
                  <span className="pcf7list__dim">
                    {p.posicion} · media {p.media}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)', margin: 0 }}>
            La historia no se lleva a ningún jugador de tu plantilla.
          </p>
        )
      ) : null}

      {!targetEntry || dismissed ? (
        <p className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)', margin: 0 }}>
          {dismissed
            ? 'Fin de tu carrera en el club: la directiva ha prescindido de ti.'
            : 'No hay datos de la temporada siguiente: fin de la carrera disponible.'}
        </p>
      ) : (
        <span className="team-cell" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4em' }}>
          <Crest teamId={career.humanTeamId} size={20} />
          <span className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)' }}>
            Continúas con tu equipo.
          </span>
        </span>
      )}
    </Pcf7Console>
  );
}
