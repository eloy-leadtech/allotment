import {
  previewTransition,
  careerTeamName,
  careerOutcome,
  nextDivision,
  currentStandings,
  currentSeasonAwards,
  endOfSeasonEvaluation,
} from '@game';
import { nextSeasonByTemporada, getSegundaByTemporada } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';
import { objectiveLabel, satisfactionLabel, satisfactionIcon } from './objectiveText';

const divisionName = (d: 'primera' | 'segunda'): string =>
  d === 'primera' ? 'Primera División' : 'Segunda División';

export function SeasonEndScreen() {
  const career = useGameStore((s) => s.career);
  const retainIds = useGameStore((s) => s.retainIds);
  const toggleRetain = useGameStore((s) => s.toggleRetain);
  const continueCareer = useGameStore((s) => s.continueCareer);
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
  const awards = currentSeasonAwards(career);

  const outcome = careerOutcome(career);
  const evaluation = endOfSeasonEvaluation(career);
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

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Fin de temporada {career.temporada}</h1>
        <span className="matchday">{divisionName(career.division)}</span>
      </header>

      <p className="champion">🏆 Campeón: {name(champion)}</p>

      <RetroPanel title="Trofeos individuales">
        {awards.pichichi ? (
          <p className="trophy trophy--pichichi">
            ⚽ Pichichi: <strong>{awards.pichichi.playerName}</strong> ({name(awards.pichichi.teamId)}){' '}
            — {awards.pichichi.goals}{' '}
            {awards.pichichi.goals === 1 ? 'gol' : 'goles'}
          </p>
        ) : (
          <p className="hint">Aún no hay goleadores registrados.</p>
        )}
        {awards.zamora ? (
          <p className="trophy trophy--zamora">
            🧤 Zamora: <strong>{awards.zamora.playerName}</strong> ({name(awards.zamora.teamId)}){' '}
            — {awards.zamora.goalsConceded} encajados en {awards.zamora.matches}{' '}
            {awards.zamora.matches === 1 ? 'partido' : 'partidos'}
          </p>
        ) : null}
      </RetroPanel>

      <RetroPanel title="Balance de la directiva">
        <p className="board-objective">
          🎯 Objetivo: {objectiveLabel(objective.type)}{' '}
          <span className="hint">(no peor que el puesto {objective.targetPosition})</span>
        </p>
        <p className={`board-mood board-mood--${evaluation.satisfaction}`}>
          {satisfactionIcon(evaluation.satisfaction)} {satisfactionLabel(evaluation.satisfaction)}
        </p>
        {evaluation.dismissed ? (
          <p className="fate fate--down">
            ⛔ La directiva te DESTITUYE. Aquí termina tu etapa en el club.
          </p>
        ) : null}
      </RetroPanel>

      {outcome === 'relegated' ? (
        <p className="fate fate--down">⬇️ Desciendes a Segunda División. Tu equipo baja contigo.</p>
      ) : null}
      {outcome === 'promoted' ? (
        <p className="fate fate--up">⬆️ ¡Asciendes a Primera División! Subes con tu equipo.</p>
      ) : null}

      {career.history.length > 0 ? (
        <RetroPanel title="Palmarés">
          <ul className="palmares">
            {career.history.map((h) => (
              <li key={h.seasonNumber}>
                {h.temporada}: <strong>{name(h.championId)}</strong>
                {h.pichichi ? (
                  <span className="palmares-trophy"> · ⚽ {h.pichichi.playerName} ({h.pichichi.goals})</span>
                ) : null}
                {h.zamora ? (
                  <span className="palmares-trophy"> · 🧤 {h.zamora.playerName} ({h.zamora.goalsConceded})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </RetroPanel>
      ) : null}

      {preview && targetEntry ? (
        preview.departures.length > 0 ? (
          <RetroPanel title={`La historia se llevaría a estos jugadores (${targetEntry.temporada})`}>
            <p className="hint">Marca a quién quieres RETENER en tu equipo.</p>
            <ul className="retain-list">
              {preview.departures.map((p) => (
                <li key={p.id} className="retain-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={retainIds.includes(p.id)}
                      onChange={() => toggleRetain(p.id)}
                    />
                    <span className="retain-name">{p.nombre}</span>
                    <span className="hint">
                      {p.posicion} · media {p.media}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </RetroPanel>
        ) : (
          <p className="hint">La historia no se lleva a ningún jugador de tu plantilla.</p>
        )
      ) : null}

      {targetEntry && !evaluation.dismissed ? (
        <div className="season-actions">
          <RetroButton variant="primary" onClick={continueCareer}>
            <span className="team-cell">
              <Crest teamId={career.humanTeamId} size={20} />
              Continuar a {targetEntry.temporada} ({divisionName(toDivision)}) →
            </span>
          </RetroButton>
          <RetroButton onClick={() => goTo('season')}>Atrás</RetroButton>
        </div>
      ) : (
        <>
          <p className="hint">
            {evaluation.dismissed
              ? 'Fin de tu carrera en el club: la directiva ha prescindido de ti.'
              : 'No hay datos de la temporada siguiente: fin de la carrera disponible.'}
          </p>
          <div className="season-actions">
            <RetroButton onClick={() => goTo('slots')}>Guardar / Cargar</RetroButton>
            <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
          </div>
        </>
      )}
    </main>
  );
}
