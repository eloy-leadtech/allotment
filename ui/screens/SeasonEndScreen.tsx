import { previewTransition, careerTeamName } from '@game';
import { useGameStore, nextSeasonEntry } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';

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

  const nextEntry = nextSeasonEntry(career.leagueId);
  const nextWorld = nextEntry?.load() ?? null;
  const preview = nextWorld ? previewTransition(career, nextWorld) : null;
  const name = (id: string): string => careerTeamName(career, id);
  const champion = preview?.championId ?? career.season.humanTeamId;

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Fin de temporada {career.temporada}</h1>
      </header>

      <p className="champion">🏆 Campeón: {name(champion)}</p>

      {career.history.length > 0 ? (
        <RetroPanel title="Palmarés">
          <ul className="palmares">
            {career.history.map((h) => (
              <li key={h.seasonNumber}>
                {h.temporada}: <strong>{name(h.championId)}</strong>
              </li>
            ))}
          </ul>
        </RetroPanel>
      ) : null}

      {preview && nextEntry ? (
        <>
          {preview.departures.length > 0 ? (
            <RetroPanel title={`La historia se llevaría a estos jugadores (${nextEntry.temporada})`}>
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
          )}

          {preview.arrivals.length > 0 ? (
            <RetroPanel title={`Altas históricas en tu club (${nextEntry.temporada})`}>
              <ul className="results">
                {preview.arrivals.map((p) => (
                  <li key={p.id}>
                    {p.nombre} <span className="hint">· {p.posicion} · media {p.media}</span>
                  </li>
                ))}
              </ul>
            </RetroPanel>
          ) : null}

          <div className="season-actions">
            <RetroButton variant="primary" onClick={continueCareer}>
              <span className="team-cell">
                <Crest teamId={career.humanTeamId} size={20} />
                Continuar a {nextEntry.temporada} →
              </span>
            </RetroButton>
            <RetroButton onClick={() => goTo('season')}>Atrás</RetroButton>
          </div>
        </>
      ) : (
        <>
          <p className="hint">
            No hay datos de la temporada siguiente todavía: has llegado al final de la carrera disponible.
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
