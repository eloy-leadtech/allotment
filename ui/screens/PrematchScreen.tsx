import { nextHumanFixture, teamName, availabilityStatus } from '@game';
import { fatigueTier, FRESH_FATIGUE, derbyName } from '@engine';
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
  const derby = derbyName(fixture.homeId, fixture.awayId);

  return (
    <main className="screen">
      <header className="match-head">
        <h1>Jornada {season.currentMatchday}</h1>
        <span className={`match-venue match-venue--${atHome ? 'home' : 'away'}`}>
          {atHome ? 'En casa' : 'Fuera'}
        </span>
      </header>

      {derby ? (
        <p className="match-derby" role="note">
          <span className="match-derby__spark" aria-hidden>
            ▲
          </span>
          Derbi · {derby}
          <span className="match-derby__spark" aria-hidden>
            ▲
          </span>
        </p>
      ) : null}

      <section className="sb" aria-label={`${name(fixture.homeId)} contra ${name(fixture.awayId)}`}>
        <div className="sb__side">
          <span className="crest-frame sb__crest">
            <Crest teamId={fixture.homeId} size={42} />
          </span>
          <span className="sb__id">
            <span className="sb__name">{name(fixture.homeId)}</span>
            <span className="sb__role">Local</span>
          </span>
        </div>
        <div className="sb__center">
          <span className="sb__score sb__score--vs">VS</span>
          <span className="sb__status">{atHome ? 'Casa' : 'Fuera'}</span>
        </div>
        <div className="sb__side sb__side--away">
          <span className="crest-frame sb__crest">
            <Crest teamId={fixture.awayId} size={42} />
          </span>
          <span className="sb__id">
            <span className="sb__name">{name(fixture.awayId)}</span>
            <span className="sb__role">Visitante</span>
          </span>
        </div>
      </section>

      <p className="match-brief">
        <span className="match-brief__label">Tu formación</span>
        <span className="match-formation">{formation ?? '4-4-2'}</span>
        <span className="match-brief__label">Rival</span>
        <strong style={{ color: 'var(--c-ink)' }}>{name(rivalId)}</strong>
      </p>

      <RetroPanel title="Bajas">
        {unavailable.length === 0 ? (
          <p className="hint">Sin bajas: toda la plantilla disponible.</p>
        ) : (
          <ul className="match-list">
            {unavailable.map(({ p, st }) => (
              <li key={p.id} className="match-list__row">
                <span
                  className={`match-list__tag match-list__tag--${
                    st.status === 'injured' ? 'injured' : 'suspended'
                  }`}
                >
                  {st.status === 'injured' ? 'Lesionado' : 'Sancionado'}
                </span>
                <span className="match-list__name">{p.nombre}</span>
                <span className="match-list__meta">
                  {st.matchesOut} {st.matchesOut === 1 ? 'jornada' : 'jornadas'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RetroPanel>

      <RetroPanel title="Estado físico">
        {tired.length === 0 ? (
          <p className="hint">Plantilla en forma: nadie acusa el desgaste.</p>
        ) : (
          <ul className="match-list">
            {tired.map((p) => (
              <li key={p.nombre} className="match-list__row">
                <span
                  className={`match-list__tag match-list__tag--${
                    fatigueTier(p.fatigue) >= 3 ? 'spent' : 'tired'
                  }`}
                >
                  {fatigueTier(p.fatigue) >= 3 ? 'Reventado' : 'Cansado'}
                </span>
                <span className="match-list__name">{p.nombre}</span>
                <span className="match-list__meta">fatiga {p.fatigue}</span>
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
