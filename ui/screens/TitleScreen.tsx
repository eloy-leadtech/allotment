import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Trophy } from '@ui/components/Trophy';

export function TitleScreen() {
  const goTo = useGameStore((s) => s.goTo);
  return (
    <main className="screen screen--title">
      <div className="title-plate">
        <h1>PCFutbol Ultimate</h1>
      </div>
      <p className="tagline">Manager retro · Liga española 96/97</p>
      <Trophy />
      <div className="title-menu">
        <RetroButton variant="primary" onClick={() => goTo('newGame')}>
          Nueva partida
        </RetroButton>
        <RetroButton onClick={() => goTo('tournament')}>Torneo · Euro 2000</RetroButton>
        <RetroButton onClick={() => goTo('slots')}>Partidas guardadas</RetroButton>
      </div>
    </main>
  );
}
