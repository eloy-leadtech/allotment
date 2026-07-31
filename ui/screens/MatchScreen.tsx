import { narrateMatch, teamName } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Ticker } from '@ui/components/Ticker';
import { Crest } from '@ui/components/Crest';

export function MatchScreen() {
  const season = useGameStore((s) => s.season);
  const match = useGameStore((s) => s.viewingMatch);
  const goTo = useGameStore((s) => s.goTo);

  if (!season || !match) {
    return (
      <main className="screen">
        <p>No hay partido seleccionado.</p>
        <RetroButton onClick={() => goTo('season')}>Volver</RetroButton>
      </main>
    );
  }

  const home = teamName(season, match.homeId);
  const away = teamName(season, match.awayId);
  const lines = narrateMatch(match, home, away);

  return (
    <main className="screen">
      <h1 className="scoreboard">
        <span className="scoreboard__side">
          <Crest teamId={match.homeId} size={36} />
          <span className="scoreboard__team">{home}</span>
        </span>
        <span className="scoreboard__score">
          {match.homeGoals}-{match.awayGoals}
        </span>
        <span className="scoreboard__side scoreboard__side--away">
          <span className="scoreboard__team">{away}</span>
          <Crest teamId={match.awayId} size={36} />
        </span>
      </h1>
      <Ticker lines={lines} />
      <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
    </main>
  );
}
