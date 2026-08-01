import { useMemo } from 'react';
import { teamName, seasonStats, careerRecords, type FormMatch } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';

/** A row of colour-coded V/E/D pills for the human's recent form (oldest→newest). */
function FormStreak({ form }: { form: FormMatch[] }) {
  if (form.length === 0) {
    return <p className="hint">Aún no has jugado ningún partido.</p>;
  }
  return (
    <ul className="form-streak" aria-label="Racha de resultados">
      {form.map((m, i) => (
        <li
          key={i}
          className={`form-badge form-badge--${m.outcome}`}
          title={`${m.home ? 'Casa' : 'Fuera'} ${m.goalsFor}-${m.goalsAgainst}`}
        >
          {m.outcome}
        </li>
      ))}
    </ul>
  );
}

export function StatsScreen() {
  const season = useGameStore((s) => s.season);
  const career = useGameStore((s) => s.career);
  const goTo = useGameStore((s) => s.goTo);

  const stats = useMemo(() => (season ? seasonStats(season) : null), [season]);
  const records = useMemo(
    () => (career ? careerRecords(career.history, career.palmares, career.humanTeamId) : null),
    [career],
  );

  if (!season || !stats) {
    return (
      <main className="screen">
        <p>No hay temporada en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const name = (id: string): string => teamName(season, id);
  const { topScorers, topKeepers, team, form } = stats;

  return (
    <main className="screen">
      <header className="season-head">
        <h1>📊 Estadísticas {season.temporada}</h1>
        <span className="matchday">
          {`Jornada ${Math.min(season.currentMatchday, season.totalMatchdays)} / ${season.totalMatchdays}`}
        </span>
      </header>

      {team ? (
        <RetroPanel title="Tu equipo">
          <div className="stat-grid">
            <div className="stat-cell">
              <span className="stat-cell__value">{team.position}º</span>
              <span className="stat-cell__label">Posición</span>
            </div>
            <div className="stat-cell">
              <span className="stat-cell__value">{team.points}</span>
              <span className="stat-cell__label">Puntos</span>
            </div>
            <div className="stat-cell">
              <span className="stat-cell__value">{team.goalsFor}</span>
              <span className="stat-cell__label">GF</span>
            </div>
            <div className="stat-cell">
              <span className="stat-cell__value">{team.goalsAgainst}</span>
              <span className="stat-cell__label">GC</span>
            </div>
            <div className="stat-cell">
              <span className="stat-cell__value">
                {team.won}-{team.drawn}-{team.lost}
              </span>
              <span className="stat-cell__label">G-E-P</span>
            </div>
          </div>
          <p className="stat-form-label">Forma reciente</p>
          <FormStreak form={form} />
        </RetroPanel>
      ) : null}

      <RetroPanel title="Máximos goleadores (Pichichi)">
        {topScorers.length === 0 ? (
          <p className="hint">Todavía no se han marcado goles esta temporada.</p>
        ) : (
          <div className="standings-scroll">
            <table className="standings stat-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="standings__team">Jugador</th>
                  <th className="standings__team">Equipo</th>
                  <th>Goles</th>
                </tr>
              </thead>
              <tbody>
                {topScorers.map((p, i) => (
                  <tr key={p.playerId} className={p.teamId === season.humanTeamId ? 'standings__row--me' : ''}>
                    <td className="standings__pos-cell">
                      <span className="standings__pos">{i + 1}</span>
                    </td>
                    <td className="standings__team">{p.playerName}</td>
                    <td className="standings__team">
                      <span className="team-cell">
                        <Crest teamId={p.teamId} size={18} />
                        {name(p.teamId)}
                      </span>
                    </td>
                    <td className="standings__pts">{p.goals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </RetroPanel>

      <RetroPanel title="Porteros menos batidos (Zamora)">
        {topKeepers.length === 0 ? (
          <p className="hint">Aún no hay partidos disputados.</p>
        ) : (
          <div className="standings-scroll">
            <table className="standings stat-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="standings__team">Portero</th>
                  <th className="standings__team">Equipo</th>
                  <th>GC</th>
                  <th>PJ</th>
                </tr>
              </thead>
              <tbody>
                {topKeepers.map((k, i) => (
                  <tr key={k.playerId} className={k.teamId === season.humanTeamId ? 'standings__row--me' : ''}>
                    <td className="standings__pos-cell">
                      <span className="standings__pos">{i + 1}</span>
                    </td>
                    <td className="standings__team">{k.playerName}</td>
                    <td className="standings__team">
                      <span className="team-cell">
                        <Crest teamId={k.teamId} size={18} />
                        {name(k.teamId)}
                      </span>
                    </td>
                    <td className="standings__pts">{k.goalsConceded}</td>
                    <td>{k.matches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </RetroPanel>

      {records && records.seasonsPlayed > 0 ? (
        <RetroPanel title="Récords históricos">
          <div className="stat-grid">
            <div className="stat-cell">
              <span className="stat-cell__value">{records.seasonsPlayed}</span>
              <span className="stat-cell__label">Temporadas</span>
            </div>
            <div className="stat-cell">
              <span className="stat-cell__value">
                {records.bestPosition != null ? `${records.bestPosition}º` : '—'}
              </span>
              <span className="stat-cell__label">Mejor puesto</span>
            </div>
            <div className="stat-cell">
              <span className="stat-cell__value">{records.titles}</span>
              <span className="stat-cell__label">Títulos</span>
            </div>
          </div>
          {records.ownPichichis.length > 0 ? (
            <>
              <p className="stat-form-label">Pichichis de tu equipo</p>
              <ul className="palmares">
                {records.ownPichichis.map((p) => (
                  <li key={`${p.seasonNumber}-${p.playerName}`}>
                    {p.temporada} · {p.playerName} ({p.goals})
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </RetroPanel>
      ) : null}

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}
