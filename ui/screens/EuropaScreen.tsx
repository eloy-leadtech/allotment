import { useMemo, useState } from 'react';
import { getEuropaByTemporada } from '@data';
import { teamProgress } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { StandingsTable } from '@ui/components/StandingsTable';

export function EuropaScreen() {
  const career = useGameStore((s) => s.career);
  const goTo = useGameStore((s) => s.goTo);
  const [tab, setTab] = useState<'champions' | 'uefa'>('champions');

  // Team id -> name: the continental clubs plus the human's own club.
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    if (career) {
      const entry = getEuropaByTemporada(career.temporada);
      if (entry) for (const t of entry.load().equipos) map.set(t.id, t.nombre);
      for (const t of career.season.teams) map.set(t.id, t.nombre);
    }
    return map;
  }, [career]);

  if (!career || !career.europa) {
    return (
      <main className="screen">
        <p>No hay competición europea esta temporada.</p>
        <RetroButton onClick={() => goTo(career ? 'season' : 'title')}>Volver</RetroButton>
      </main>
    );
  }

  const europa = career.europa;
  const me = career.humanTeamId;
  const name = (id: string): string => nameById.get(id) ?? id;
  const highlight = (comp: 'champions' | 'uefa'): string | undefined =>
    europa.humanComp === comp ? me : undefined;

  const compLabel =
    europa.humanComp === 'champions'
      ? 'Juegas la Champions'
      : europa.humanComp === 'uefa'
        ? 'Juegas la UEFA'
        : 'No te clasificaste para Europa esta temporada';

  const champions = europa.champions;
  const uefa = europa.uefa;
  const meComp = highlight(tab);

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Europa · {career.temporada}</h1>
        <span className="matchday">{compLabel}</span>
      </header>

      <div className="team-grid">
        <RetroButton variant={tab === 'champions' ? 'primary' : undefined} onClick={() => setTab('champions')}>
          Champions 🏆 {name(champions.championId)}
        </RetroButton>
        <RetroButton variant={tab === 'uefa' ? 'primary' : undefined} onClick={() => setTab('uefa')}>
          UEFA 🏆 {name(uefa.championId)}
        </RetroButton>
      </div>

      {meComp ? (
        <p className="champion">
          {name(me)} —{' '}
          <strong>{teamProgress(tab === 'champions' ? champions : uefa, me)}</strong>
        </p>
      ) : null}

      {tab === 'champions' ? (
        <>
          <RetroPanel title="Fase de grupos">
            <div className="groups-grid">
              {champions.groups.map((g, i) => (
                <div key={i} className="group">
                  <h3>Grupo {String.fromCharCode(65 + i)}</h3>
                  <StandingsTable rows={g.standings} teamName={name} highlightTeamId={meComp} />
                </div>
              ))}
            </div>
          </RetroPanel>
          <RetroPanel title="Eliminatorias">
            {champions.knockout.map((round) => (
              <KnockoutList key={round.nombre} round={round} name={name} me={meComp} />
            ))}
          </RetroPanel>
        </>
      ) : (
        <RetroPanel title="Eliminatorias">
          {uefa.knockout.map((round) => (
            <KnockoutList key={round.nombre} round={round} name={name} me={meComp} />
          ))}
        </RetroPanel>
      )}

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}

interface Round {
  nombre: string;
  ties: ReadonlyArray<{
    homeId: string;
    awayId: string;
    homeGoals: number;
    awayGoals: number;
    winnerId: string;
    onPenalties: boolean;
  }>;
}

function KnockoutList({ round, name, me }: { round: Round; name: (id: string) => string; me?: string }) {
  const cls = (id: string, winnerId: string): string =>
    `${id === me ? 'copa-me' : ''} ${winnerId === id ? 'ko-win' : ''}`.trim();
  return (
    <div className="ko-round">
      <h3>{round.nombre}</h3>
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
    </div>
  );
}
