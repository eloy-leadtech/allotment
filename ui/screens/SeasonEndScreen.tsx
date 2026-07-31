import { previewTransition, careerTeamName, careerOutcome, nextDivision, currentStandings } from '@game';
import { nextSeasonByTemporada, getSegundaByTemporada } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Crest } from '@ui/components/Crest';
import { Pcf7Console } from '@ui/components/Pcf7Frame';

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

  const outcome = careerOutcome(career);
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

  const footer = targetEntry ? (
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
      <p className="pcf7ovl pcf7title-ovl" style={{ position: 'static', justifyContent: 'flex-start', whiteSpace: 'normal', margin: 0 }}>
        🏆 Campeón: {name(champion)}
      </p>

      {outcome === 'relegated' ? (
        <p className="pcf7data-ovl" style={{ position: 'static', color: '#ff8a8a', margin: 0 }}>⬇️ Desciendes a Segunda División. Tu equipo baja contigo.</p>
      ) : null}
      {outcome === 'promoted' ? (
        <p className="pcf7data-ovl" style={{ position: 'static', color: '#8affa0', margin: 0 }}>⬆️ ¡Asciendes a Primera División! Subes con tu equipo.</p>
      ) : null}

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

      {preview && targetEntry ? (
        preview.departures.length > 0 ? (
          <section className="pcf7card">
            <div className="pcf7card__head">La historia se llevaría a estos jugadores ({targetEntry.temporada})</div>
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
                  <span className="pcf7list__dim">{p.posicion} · media {p.media}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)', margin: 0 }}>La historia no se lleva a ningún jugador de tu plantilla.</p>
        )
      ) : null}

      {!targetEntry ? (
        <p className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)', margin: 0 }}>
          No hay datos de la temporada siguiente: fin de la carrera disponible.
        </p>
      ) : (
        <span className="team-cell" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4em' }}>
          <Crest teamId={career.humanTeamId} size={20} />
          <span className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)' }}>Continúas con tu equipo.</span>
        </span>
      )}
    </Pcf7Console>
  );
}
