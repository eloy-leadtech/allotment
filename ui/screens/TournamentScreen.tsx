import { useMemo, useState } from 'react';
import { loadSeleccionEuro2000 } from '@data';
import { EURO2000_FINALIST_IDS, teamProgress } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { StandingsTable } from '@ui/components/StandingsTable';

export function TournamentScreen() {
  const tournament = useGameStore((s) => s.tournament);
  const nationId = useGameStore((s) => s.tournamentNationId);
  const startTournament = useGameStore((s) => s.startTournament);
  const goTo = useGameStore((s) => s.goTo);
  const [picking, setPicking] = useState(false);

  // Nation id -> display name, from the committed Euro 2000 database.
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of loadSeleccionEuro2000().equipos) map.set(t.id, t.nombre);
    return map;
  }, []);
  const name = (id: string): string => nameById.get(id) ?? id;

  const finalists = useMemo(
    () => [...EURO2000_FINALIST_IDS].sort((a, b) => (nameById.get(a) ?? a).localeCompare(nameById.get(b) ?? b)),
    [nameById],
  );

  // Picker: no tournament yet, or the user asked to play another.
  if (!tournament || picking) {
    return (
      <main className="screen">
        <header className="season-head">
          <h1>Eurocopa 2000</h1>
          <span className="matchday">Elige tu selección</span>
        </header>
        <div className="team-grid">
          {finalists.map((id) => (
            <RetroButton key={id} onClick={() => { setPicking(false); startTournament(id); }}>
              {name(id)}
            </RetroButton>
          ))}
        </div>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const yourRun = nationId ? teamProgress(tournament, nationId) : null;

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Eurocopa 2000</h1>
        <span className="matchday">🏆 {name(tournament.championId)}</span>
      </header>

      {nationId ? (
        <p className="champion">
          {name(nationId)} — <strong>{yourRun}</strong>
        </p>
      ) : null}

      <RetroPanel title="Fase de grupos">
        <div className="groups-grid">
          {tournament.groups.map((g, i) => (
            <div key={i} className="group">
              <h3>Grupo {String.fromCharCode(65 + i)}</h3>
              <StandingsTable rows={g.standings} teamName={name} highlightTeamId={nationId ?? undefined} />
            </div>
          ))}
        </div>
      </RetroPanel>

      <RetroPanel title="Eliminatorias">
        {tournament.knockout.map((round) => (
          <div key={round.nombre} className="ko-round">
            <h3>{round.nombre}</h3>
            <ul className="market-list">
              {round.ties.map((tie, i) => (
                <li key={i} className="ko-tie">
                  <span className={tie.winnerId === tie.homeId ? 'ko-win' : ''}>{name(tie.homeId)}</span>
                  <span className="ko-score">
                    {tie.homeGoals}-{tie.awayGoals}
                    {tie.onPenalties ? ' (pen)' : ''}
                  </span>
                  <span className={tie.winnerId === tie.awayId ? 'ko-win' : ''}>{name(tie.awayId)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </RetroPanel>

      <div className="season-actions">
        <RetroButton variant="primary" onClick={() => setPicking(true)}>
          Jugar otro
        </RetroButton>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </div>
    </main>
  );
}
