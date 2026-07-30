import { nextHumanFixture, teamName } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';

/**
 * Pre-match: before playing your matchday, see who you face, where, and with
 * which shape. From here you play your match live (teletype) or quick-sim the
 * whole round.
 */
export function PrematchScreen() {
  const season = useGameStore((s) => s.season);
  const formation = useGameStore((s) => s.career?.tactics?.formation ?? null);
  const watchNextMatchday = useGameStore((s) => s.watchNextMatchday);
  const playNextMatchday = useGameStore((s) => s.playNextMatchday);
  const goTo = useGameStore((s) => s.goTo);

  const fixture = season ? nextHumanFixture(season) : null;
  if (!season || !fixture) {
    return (
      <main className="screen">
        <p>No hay partido por jugar.</p>
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </main>
    );
  }

  const me = season.humanTeamId;
  const atHome = fixture.homeId === me;
  const rivalId = atHome ? fixture.awayId : fixture.homeId;
  const name = (id: string): string => teamName(season, id);

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Jornada {season.currentMatchday}</h1>
        <span className="matchday">{atHome ? 'En casa' : 'Fuera'}</span>
      </header>

      <RetroPanel title="Tu partido">
        <h1 className="scoreline">
          <Crest teamId={fixture.homeId} size={28} /> {name(fixture.homeId)}
          <span className="score"> vs </span>
          {name(fixture.awayId)} <Crest teamId={fixture.awayId} size={28} />
        </h1>
        <p className="champion">
          Rival: <strong>{name(rivalId)}</strong> · Tu formación:{' '}
          <strong>{formation ?? '4-4-2 (por defecto)'}</strong>
        </p>
      </RetroPanel>

      <div className="season-actions">
        <RetroButton variant="primary" onClick={() => watchNextMatchday()}>
          Jugar partido
        </RetroButton>
        <RetroButton onClick={() => goTo('tactics')}>Cambiar táctica</RetroButton>
        <RetroButton
          onClick={() => {
            playNextMatchday();
            goTo('season');
          }}
        >
          Simular jornada
        </RetroButton>
        <RetroButton onClick={() => goTo('season')}>Volver</RetroButton>
      </div>
    </main>
  );
}
