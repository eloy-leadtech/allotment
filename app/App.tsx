import { useGameStore } from '@ui/store/gameStore';
import { TitleScreen } from '@ui/screens/TitleScreen';
import { NewGameScreen } from '@ui/screens/NewGameScreen';
import { TeamSelectScreen } from '@ui/screens/TeamSelectScreen';
import { SeasonScreen } from '@ui/screens/SeasonScreen';
import { PrematchScreen } from '@ui/screens/PrematchScreen';
import { SeasonEndScreen } from '@ui/screens/SeasonEndScreen';
import { MarketScreen } from '@ui/screens/MarketScreen';
import { SquadScreen } from '@ui/screens/SquadScreen';
import { PlayerCardScreen } from '@ui/screens/PlayerCardScreen';
import { YouthScreen } from '@ui/screens/YouthScreen';
import { OjeoScreen } from '@ui/screens/OjeoScreen';
import { TacticsScreen } from '@ui/screens/TacticsScreen';
import { TrainingScreen } from '@ui/screens/TrainingScreen';
import { StadiumScreen } from '@ui/screens/StadiumScreen';
import { SponsorsScreen } from '@ui/screens/SponsorsScreen';
import { TournamentScreen } from '@ui/screens/TournamentScreen';
import { CopaScreen } from '@ui/screens/CopaScreen';
import { EuropaScreen } from '@ui/screens/EuropaScreen';
import { PalmaresScreen } from '@ui/screens/PalmaresScreen';
import { StatsScreen } from '@ui/screens/StatsScreen';
import { PressScreen } from '@ui/screens/PressScreen';
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
    case 'prematch':
      return <PrematchScreen />;
    case 'seasonEnd':
      return <SeasonEndScreen />;
    case 'market':
      return <MarketScreen />;
    case 'squad':
      return <SquadScreen />;
    case 'playerCard':
      return <PlayerCardScreen />;
    case 'youth':
      return <YouthScreen />;
    case 'ojeo':
      return <OjeoScreen />;
    case 'tactics':
      return <TacticsScreen />;
    case 'training':
      return <TrainingScreen />;
    case 'stadium':
      return <StadiumScreen />;
    case 'sponsors':
      return <SponsorsScreen />;
    case 'tournament':
      return <TournamentScreen />;
    case 'copa':
      return <CopaScreen />;
    case 'europa':
      return <EuropaScreen />;
    case 'palmares':
      return <PalmaresScreen />;
    case 'stats':
      return <StatsScreen />;
    case 'press':
      return <PressScreen />;
    case 'match':
      return <MatchScreen />;
    case 'slots':
      return <SlotsScreen />;
  }
}
