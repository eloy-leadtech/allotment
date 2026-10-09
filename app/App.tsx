import { useGameStore } from '@ui/store/gameStore';
import type { Screen } from '@app/navigation';
import { SectionOverlay } from '@ui/components/SectionOverlay';
import { TitleScreen } from '@ui/screens/TitleScreen';
import { NewGameScreen } from '@ui/screens/NewGameScreen';
import { DatabaseScreen } from '@ui/screens/DatabaseScreen';
import { TeamSelectScreen } from '@ui/screens/TeamSelectScreen';
import { SeasonScreen } from '@ui/screens/SeasonScreen';
import { Despacho } from '@ui/screens/Despacho';
import { PrematchScreen } from '@ui/screens/PrematchScreen';
import { SeasonEndScreen } from '@ui/screens/SeasonEndScreen';
import { MarketScreen } from '@ui/screens/MarketScreen';
import { WinterMarketScreen } from '@ui/screens/WinterMarketScreen';
import { SquadScreen } from '@ui/screens/SquadScreen';
import { ComparativaScreen } from '@ui/screens/ComparativaScreen';
import { PlayerCardScreen } from '@ui/screens/PlayerCardScreen';
import { YouthScreen } from '@ui/screens/YouthScreen';
import { OjeoScreen } from '@ui/screens/OjeoScreen';
import { ScoutingProspectsScreen } from '@ui/screens/ScoutingProspectsScreen';
import { TacticsScreen } from '@ui/screens/TacticsScreen';
import { DirectivaScreen } from '@ui/screens/DirectivaScreen';
import { TrainingScreen } from '@ui/screens/TrainingScreen';
import { StaffScreen } from '@ui/screens/StaffScreen';
import { StadiumScreen } from '@ui/screens/StadiumScreen';
import { SponsorsScreen } from '@ui/screens/SponsorsScreen';
import { TournamentScreen } from '@ui/screens/TournamentScreen';
import { CopaScreen } from '@ui/screens/CopaScreen';
import { EuropaScreen } from '@ui/screens/EuropaScreen';
import { PalmaresScreen } from '@ui/screens/PalmaresScreen';
import { HemerotecaScreen } from '@ui/screens/HemerotecaScreen';
import { StatsScreen } from '@ui/screens/StatsScreen';
import { PressScreen } from '@ui/screens/PressScreen';
import { MatchScreen } from '@ui/screens/MatchScreen';
import { SlotsScreen } from '@ui/screens/SlotsScreen';

/**
 * Despacho SECTIONS: screens reached from the office that open as a glassy panel
 * OVER the despacho (its stadium photo stays behind). Everything else (title,
 * new game, the match itself, season end…) is a full screen of its own.
 */
const SECTIONS: ReadonlySet<Screen> = new Set<Screen>([
  'standings',
  'market',
  'winterMarket',
  'squad',
  'comparativa',
  'playerCard',
  'youth',
  'ojeo',
  'prospects',
  'tactics',
  'directiva',
  'training',
  'staff',
  'stadium',
  'sponsors',
  'copa',
  'europa',
  'palmares',
  'hemeroteca',
  'stats',
  'press',
]);

/** The component for a given screen. */
function renderScreen(screen: Screen) {
  switch (screen) {
    case 'title':
      return <TitleScreen />;
    case 'newGame':
      return <NewGameScreen />;
    case 'database':
      return <DatabaseScreen />;
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
    case 'winterMarket':
      return <WinterMarketScreen />;
    case 'squad':
      return <SquadScreen />;
    case 'comparativa':
      return <ComparativaScreen />;
    case 'playerCard':
      return <PlayerCardScreen />;
    case 'youth':
      return <YouthScreen />;
    case 'ojeo':
      return <OjeoScreen />;
    case 'prospects':
      return <ScoutingProspectsScreen />;
    case 'tactics':
      return <TacticsScreen />;
    case 'directiva':
      return <DirectivaScreen />;
    case 'training':
      return <TrainingScreen />;
    case 'staff':
      return <StaffScreen />;
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
    case 'hemeroteca':
      return <HemerotecaScreen />;
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

/** Root shell: the despacho is the stage; sections open as glassy panels over it. */
export function App() {
  const screen = useGameStore((s) => s.screen);
  if (SECTIONS.has(screen)) {
    return (
      <>
        <Despacho />
        <SectionOverlay>{renderScreen(screen)}</SectionOverlay>
      </>
    );
  }
  return renderScreen(screen);
}
