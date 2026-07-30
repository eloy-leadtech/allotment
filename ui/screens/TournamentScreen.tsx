import { useMemo, useState } from 'react';
import { loadSeleccionEuro2000, loadSeleccionMundial98 } from '@data';
import { TOURNAMENTS, teamProgress } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { StandingsTable } from '@ui/components/StandingsTable';

type Def = (typeof TOURNAMENTS)[number];

const loadDb = (dbId: string) =>
  dbId === 'seleccion-mundial98' ? loadSeleccionMundial98() : loadSeleccionEuro2000();

export function TournamentScreen() {
  const tournament = useGameStore((s) => s.tournament);
  const nationId = useGameStore((s) => s.tournamentNationId);
  const tournamentId = useGameStore((s) => s.tournamentId);
  const startTournament = useGameStore((s) => s.startTournament);
  const goTo = useGameStore((s) => s.goTo);

  // Picker flow: 'tournament' -> 'nation' -> null (show the played result).
  const [phase, setPhase] = useState<'tournament' | 'nation' | null>(null);
  const [chosenDef, setChosenDef] = useState<Def | null>(null);

  const activeDef: Def =
    chosenDef ?? TOURNAMENTS.find((t) => t.id === tournamentId) ?? TOURNAMENTS[0]!;

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of loadDb(activeDef.dbId).equipos) map.set(t.id, t.nombre);
    return map;
  }, [activeDef]);
  const name = (id: string): string => nameById.get(id) ?? id;

  const finalists = useMemo(
    () => [...activeDef.finalistIds].sort((a, b) => (nameById.get(a) ?? a).localeCompare(nameById.get(b) ?? b)),
    [activeDef, nameById],
  );

  const showResult = tournament !== null && phase === null;

  // Step 1: choose the tournament.
  if (!showResult && phase !== 'nation') {
    return (
      <main className="screen">
        <header className="season-head">
          <h1>Torneos de selecciones</h1>
          <span className="matchday">Elige competición</span>
        </header>
        <div className="team-grid">
          {TOURNAMENTS.map((def) => (
            <RetroButton key={def.id} variant="primary" onClick={() => { setChosenDef(def); setPhase('nation'); }}>
              {def.nombre}
            </RetroButton>
          ))}
        </div>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  // Step 2: choose your nation.
  if (!showResult) {
    return (
      <main className="screen">
        <header className="season-head">
          <h1>{activeDef.nombre}</h1>
          <span className="matchday">Elige tu selección</span>
        </header>
        <div className="team-grid">
          {finalists.map((id) => (
            <RetroButton key={id} onClick={() => { startTournament(activeDef.id, id); setChosenDef(null); setPhase(null); }}>
              {name(id)}
            </RetroButton>
          ))}
        </div>
        <RetroButton onClick={() => setPhase('tournament')}>Atrás</RetroButton>
      </main>
    );
  }

  // Result view.
  const played = tournament!;
  const yourRun = nationId ? teamProgress(played, nationId) : null;

  return (
    <main className="screen">
      <header className="season-head">
        <h1>{activeDef.nombre}</h1>
        <span className="matchday">🏆 {name(played.championId)}</span>
      </header>

      {nationId ? (
        <p className="champion">
          {name(nationId)} — <strong>{yourRun}</strong>
        </p>
      ) : null}

      <RetroPanel title="Fase de grupos">
        <div className="groups-grid">
          {played.groups.map((g, i) => (
            <div key={i} className="group">
              <h3>Grupo {String.fromCharCode(65 + i)}</h3>
              <StandingsTable rows={g.standings} teamName={name} highlightTeamId={nationId ?? undefined} />
            </div>
          ))}
        </div>
      </RetroPanel>

      <RetroPanel title="Eliminatorias">
        {played.knockout.map((round) => (
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
        <RetroButton variant="primary" onClick={() => setPhase('tournament')}>
          Jugar otro
        </RetroButton>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </div>
    </main>
  );
}
