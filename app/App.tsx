import { useGameStore } from '@ui/store/gameStore';
import { TitleScreen } from '@ui/screens/TitleScreen';
import { NewGameScreen } from '@ui/screens/NewGameScreen';
import { TeamSelectScreen } from '@ui/screens/TeamSelectScreen';
import { SeasonScreen } from '@ui/screens/SeasonScreen';
import { Despacho } from '@ui/screens/Despacho';
import { PrematchScreen } from '@ui/screens/PrematchScreen';
import { SeasonEndScreen } from '@ui/screens/SeasonEndScreen';
import { MarketScreen } from '@ui/screens/MarketScreen';
import { SquadScreen } from '@ui/screens/SquadScreen';
import { TacticsScreen } from '@ui/screens/TacticsScreen';
import { TournamentScreen } from '@ui/screens/TournamentScreen';
import { CopaScreen } from '@ui/screens/CopaScreen';
import { EuropaScreen } from '@ui/screens/EuropaScreen';
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
      return <Despacho />;
    case 'standings':
      return <SeasonScreen />;
    case 'prematch':
      return <PrematchScreen />;
    case 'seasonEnd':
      return <SeasonEndScreen />;
    case 'market':
      return <MarketScreen />;
    case 'squad':
      return <SquadScreen />;
    case 'tactics':
      return <TacticsScreen />;
    case 'tournament':
      return <TournamentScreen />;
    case 'copa':
      return <CopaScreen />;
    case 'europa':
      return <EuropaScreen />;
    case 'match':
      return <MatchScreen />;
    case 'slots':
      return <SlotsScreen />;
  }
}
