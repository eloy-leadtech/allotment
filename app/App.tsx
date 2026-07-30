import { useGameStore } from '@ui/store/gameStore';
import { TitleScreen } from '@ui/screens/TitleScreen';
import { TeamSelectScreen } from '@ui/screens/TeamSelectScreen';
import { SeasonScreen } from '@ui/screens/SeasonScreen';
import { MatchScreen } from '@ui/screens/MatchScreen';

/** Root shell: renders the current screen from the store. */
export function App() {
  const screen = useGameStore((s) => s.screen);
  switch (screen) {
    case 'title':
      return <TitleScreen />;
    case 'teamSelect':
      return <TeamSelectScreen />;
    case 'season':
      return <SeasonScreen />;
    case 'match':
      return <MatchScreen />;
  }
}
