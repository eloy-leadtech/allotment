import { useMemo } from 'react';
import { getSeasonByTemporada, getSegundaByTemporada } from '@data';
import { teamProgress } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';

export function CopaScreen() {
  const career = useGameStore((s) => s.career);
  const goTo = useGameStore((s) => s.goTo);

  // Team id -> name across BOTH domestic divisions of the season.
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    if (career) {
      for (const t of career.season.teams) map.set(t.id, t.nombre);
      const pri = getSeasonByTemporada(career.temporada);
      if (pri) for (const t of pri.load().equipos) map.set(t.id, t.nombre);
      const seg = getSegundaByTemporada(career.temporada);
      if (seg) for (const t of seg.load().equipos) map.set(t.id, t.nombre);
    }
    return map;
  }, [career]);

  if (!career || !career.copa) {
    return (
      <main className="screen">
        <p>No hay Copa en curso.</p>
        <RetroButton onClick={() => goTo(career ? 'season' : 'title')}>Volver</RetroButton>
      </main>
    );
  }

  const copa = career.copa;
  const me = career.humanTeamId;
  const name = (id: string): string => nameById.get(id) ?? id;
  const cls = (id: string, winnerId: string): string =>
    `${id === me ? 'copa-me' : ''} ${winnerId === id ? 'ko-win' : ''}`.trim();

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Copa del Rey · {career.temporada}</h1>
        <span className="matchday">🏆 {name(copa.championId)}</span>
      </header>

      <p className="champion">
        {name(me)} — <strong>{teamProgress(copa, me)}</strong>
      </p>

      {copa.knockout.map((round) => (
        <RetroPanel key={round.nombre} title={round.nombre}>
          <ul className="market-list">
            {round.ties.map((tie, i) => (
              <li key={i} className="ko-tie">
                <span className={cls(tie.homeId, tie.winnerId)}>{name(tie.homeId)}</span>
                <span className="ko-score">
                  {tie.homeGoals}-{tie.awayGoals}
                  {tie.onPenalties ? ' (pen)' : ''}
                </span>
                <span className={cls(tie.awayId, tie.winnerId)}>{name(tie.awayId)}</span>
              </li>
            ))}
          </ul>
        </RetroPanel>
      ))}

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}
