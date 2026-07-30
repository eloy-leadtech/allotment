import { SEASONS } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';

export function NewGameScreen() {
  const seasonId = useGameStore((s) => s.seasonId);
  const seed = useGameStore((s) => s.seed);
  const chooseSeason = useGameStore((s) => s.chooseSeason);
  const setSeed = useGameStore((s) => s.setSeed);
  const randomizeSeed = useGameStore((s) => s.randomizeSeed);
  const goTo = useGameStore((s) => s.goTo);

  return (
    <main className="screen">
      <h1>Nueva partida</h1>

      <RetroPanel title="Temporada">
        <div className="team-grid">
          {SEASONS.map((s) => (
            <RetroButton
              key={s.id}
              variant={s.id === seasonId ? 'primary' : 'default'}
              onClick={() => chooseSeason(s.id)}
            >
              {s.nombre}
            </RetroButton>
          ))}
        </div>
      </RetroPanel>

      <RetroPanel title="Semilla">
        <p className="seed-row">
          <label htmlFor="seed">Semilla:</label>
          <input
            id="seed"
            className="seed-input"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
          />
          <RetroButton onClick={randomizeSeed}>Aleatoria</RetroButton>
        </p>
        <p className="hint">Con la misma semilla, la liga se juega igual (determinista).</p>
      </RetroPanel>

      <RetroButton variant="primary" onClick={() => goTo('teamSelect')}>
        Elegir equipo
      </RetroButton>
      <RetroButton onClick={() => goTo('title')}>Atrás</RetroButton>
    </main>
  );
}
