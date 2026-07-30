import { narrateMatch, teamName } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Ticker } from '@ui/components/Ticker';

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
      <h1 className="scoreline">
        {home} <span className="score">{match.homeGoals}-{match.awayGoals}</span> {away}
      </h1>
      <Ticker lines={lines} />
      <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
    </main>
  );
}
