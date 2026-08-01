import { nextHumanFixture, teamName, availabilityStatus } from '@game';
import { fatigueTier, FRESH_FATIGUE } from '@engine';
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
  const career = useGameStore((s) => s.career);
  const formation = useGameStore((s) => s.career?.tactics?.formation ?? null);
  const watchNextMatchday = useGameStore((s) => s.watchNextMatchday);
  const playNextMatchday = useGameStore((s) => s.playNextMatchday);
  const goTo = useGameStore((s) => s.goTo);

  const fixture = season ? nextHumanFixture(season) : null;

  // Who from our squad is out this matchday (injured or suspended).
  const myPlayers = career?.teams.find((t) => t.id === career.humanTeamId)?.players ?? [];
  const unavailable = season
    ? myPlayers
        .map((p) => ({ p, st: availabilityStatus(season.availability[p.id], season.currentMatchday) }))
        .filter(({ st }) => st.status !== 'fit')
    : [];

  // Tired players (fatigue tier 2+): the pre-match nudge to rotate before kickoff.
  const seasonPlayers = season?.teams.find((t) => t.id === season.humanTeamId)?.players ?? [];
  const tired = seasonPlayers
    .map((p) => ({ nombre: p.nombre, fatigue: p.fatigue ?? FRESH_FATIGUE }))
    .filter((p) => fatigueTier(p.fatigue) >= 2)
    .sort((a, b) => b.fatigue - a.fatigue);
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
        <h1 className="scoreboard">
          <span className="scoreboard__side">
            <Crest teamId={fixture.homeId} size={36} />
            <span className="scoreboard__team">{name(fixture.homeId)}</span>
          </span>
          <span className="scoreboard__score scoreboard__score--vs">vs</span>
          <span className="scoreboard__side scoreboard__side--away">
            <span className="scoreboard__team">{name(fixture.awayId)}</span>
            <Crest teamId={fixture.awayId} size={36} />
          </span>
        </h1>
        <p className="champion">
          Rival: <strong>{name(rivalId)}</strong> · Tu formación:{' '}
          <strong>{formation ?? '4-4-2 (por defecto)'}</strong>
        </p>
      </RetroPanel>

      <RetroPanel title="Bajas">
        {unavailable.length === 0 ? (
          <p className="hint">Sin bajas: toda la plantilla disponible.</p>
        ) : (
          <ul className="ticker">
            {unavailable.map(({ p, st }) => (
              <li key={p.id} className="ticker__line">
                {st.status === 'injured' ? 'Lesionado' : 'Sancionado'}: {p.nombre} ({st.matchesOut})
              </li>
            ))}
          </ul>
        )}
      </RetroPanel>

      <RetroPanel title="Estado físico">
        {tired.length === 0 ? (
          <p className="hint">Plantilla en forma: nadie acusa el desgaste.</p>
        ) : (
          <ul className="ticker">
            {tired.map((p) => (
              <li key={p.nombre} className="ticker__line">
                {fatigueTier(p.fatigue) >= 3 ? 'Reventado' : 'Cansado'}: {p.nombre} (fatiga {p.fatigue})
              </li>
            ))}
          </ul>
        )}
        {tired.length > 0 ? (
          <p className="hint">Rota a los más cargados: forzarlos les baja el rendimiento.</p>
        ) : null}
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
