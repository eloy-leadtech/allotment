import { useGameStore } from '@ui/store/gameStore';
import { TitleScreen } from '@ui/screens/TitleScreen';
import { NewGameScreen } from '@ui/screens/NewGameScreen';
import { TeamSelectScreen } from '@ui/screens/TeamSelectScreen';
import { SeasonScreen } from '@ui/screens/SeasonScreen';
import { SeasonEndScreen } from '@ui/screens/SeasonEndScreen';
import { SquadScreen } from '@ui/screens/SquadScreen';
import { MatchScreen } from '@ui/screens/MatchScreen';
import { SlotsScreen } from '@ui/screens/SlotsScreen';

/** Root shell: renders the current screen from the store. */
export function App() {
  const screen = useGameStore((s) => s.screen);
  switch (screen) {
    case 'title':
      return <TitleScreen />;
    case 'newGame':
      return <NewGameScreen />;
    case 'teamSelect':
      return <TeamSelectScreen />;
    case 'season':
      return <SeasonScreen />;
    case 'seasonEnd':
      return <SeasonEndScreen />;
    case 'squad':
      return <SquadScreen />;
    case 'match':
      return <MatchScreen />;
    case 'slots':
      return <SlotsScreen />;
  }
}
