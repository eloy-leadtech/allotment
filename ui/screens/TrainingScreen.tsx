import { useState } from 'react';
import { TRAINING_FOCI, DEFAULT_TRAINING_FOCUS, type TrainingFocus } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';

/**
 * Choose the season's TRAINING FOCUS. The pick shapes how your squad's attributes
 * develop at the next season transition (a moderate, deterministic layer over the
 * aging curve); it never touches the matches already played.
 */
export function TrainingScreen() {
  const career = useGameStore((s) => s.career);
  const setTraining = useGameStore((s) => s.setTraining);
  const goTo = useGameStore((s) => s.goTo);

  const [focus, setFocus] = useState<TrainingFocus>(career?.training?.focus ?? DEFAULT_TRAINING_FOCUS);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const save = (): void => {
    setTraining({ focus });
    goTo('season');
  };

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Entrenamiento</h1>
        <span className="matchday">Temporada {career.temporada}</span>
      </header>

      <RetroPanel title="Foco de entrenamiento">
        <p className="hint">
          Elige en qué se centra la pretemporada. El foco acelera unos atributos a costa de otros
          y da efecto la próxima temporada. Los jóvenes progresan algo más.
        </p>
        <ul className="market-list">
          {TRAINING_FOCI.map((f) => {
            const on = f.focus === focus;
            return (
              <li key={f.focus} className="market-row">
                <label className="team-cell">
                  <input
                    type="radio"
                    name="training-focus"
                    checked={on}
                    onChange={() => setFocus(f.focus)}
                  />
                  <span className="market-name">{f.label}</span>
                </label>
                <span className="hint">{f.hint}</span>
              </li>
            );
          })}
        </ul>
      </RetroPanel>

      <div className="season-actions">
        <RetroButton variant="primary" onClick={save}>
          Guardar entrenamiento
        </RetroButton>
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}
