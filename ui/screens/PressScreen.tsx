import { selectPressQuestion, pressStanding, pressBoardSatisfaction } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { satisfactionLabel, satisfactionIcon } from './objectiveText';

/** A short cue for what an option will do to morale and the board. */
function effectHint(effect: { morale: number; board: number }): string {
  const parts: string[] = [];
  const sign = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
  if (effect.morale !== 0) parts.push(`Moral ${sign(effect.morale)}`);
  if (effect.board !== 0) parts.push(`Directiva ${sign(effect.board)}`);
  return parts.length > 0 ? parts.join(' · ') : 'Sin efecto';
}

/**
 * Rueda de prensa: the interactive press conference. Shows the question the press
 * has put to the manager and the possible answers; each answer nudges the
 * dressing-room morale and the board's satisfaction.
 */
export function PressScreen() {
  const career = useGameStore((s) => s.career);
  const answerPress = useGameStore((s) => s.answerPress);
  const goTo = useGameStore((s) => s.goTo);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const pending = selectPressQuestion(career);
  const standing = pressStanding(career);
  const mood = pressBoardSatisfaction(career);

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Rueda de prensa</h1>
        <span className="matchday">Jornada {career.season.currentMatchday}</span>
      </header>

      {pending ? (
        <RetroPanel title="La prensa te pregunta">
          <p className="press-question">🎙️ {pending.question.prompt}</p>
          <div className="press-options">
            {pending.question.options.map((o) => (
              <RetroButton key={o.id} variant="primary" onClick={() => answerPress(o.id)}>
                <span className="press-option__text">{o.text}</span>
                <span className="hint press-option__hint">{effectHint(o.effect)}</span>
              </RetroButton>
            ))}
          </div>
        </RetroPanel>
      ) : (
        <RetroPanel title="Sin comparecencia">
          <p>Hoy no hay rueda de prensa. Vuelve tras la próxima jornada.</p>
        </RetroPanel>
      )}

      <RetroPanel title="Estado tras tus declaraciones">
        <p className={`board-mood board-mood--${mood}`}>
          {satisfactionIcon(mood)} {satisfactionLabel(mood)} <span className="hint">(por tu trato con la prensa)</span>
        </p>
        <p className="hint">
          Efecto acumulado esta temporada — vestuario:{' '}
          {standing.morale > 0 ? `+${standing.morale}` : standing.morale} · directiva:{' '}
          {standing.board > 0 ? `+${standing.board}` : standing.board}
        </p>
      </RetroPanel>

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}
