import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';

export function TitleScreen() {
  const goTo = useGameStore((s) => s.goTo);
  return (
    <main className="screen screen--title">
      <h1>PCFutbol Ultimate</h1>
      <p className="tagline">Manager retro · Liga española 96/97</p>
      <RetroButton variant="primary" onClick={() => goTo('teamSelect')}>
        Nueva Liga
      </RetroButton>
    </main>
  );
}
