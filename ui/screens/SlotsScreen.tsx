import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

export function SlotsScreen() {
  const slots = useGameStore((s) => s.slots);
  const season = useGameStore((s) => s.season);
  const saveToSlot = useGameStore((s) => s.saveToSlot);
  const loadFromSlot = useGameStore((s) => s.loadFromSlot);
  const deleteSlotAt = useGameStore((s) => s.deleteSlotAt);
  const goTo = useGameStore((s) => s.goTo);

  return (
    <main className="screen">
      <h1>Partidas guardadas</h1>
      {slots.map((info, i) => {
        const slot = i + 1;
        return (
          <RetroPanel key={slot} title={`Ranura ${slot}`}>
            {info ? (
              <div className="slot-row">
                <span className="slot-info">
                  {info.save.temporada} · {info.save.humanTeamId} · Jornada {info.save.currentMatchday}
                  <br />
                  <span className="hint">{formatDate(info.savedAt)}</span>
                </span>
                <span className="slot-actions">
                  <RetroButton variant="primary" onClick={() => loadFromSlot(slot)}>
                    Cargar
                  </RetroButton>
                  {season ? <RetroButton onClick={() => saveToSlot(slot)}>Sobrescribir</RetroButton> : null}
                  <RetroButton onClick={() => deleteSlotAt(slot)}>Borrar</RetroButton>
                </span>
              </div>
            ) : (
              <div className="slot-row">
                <span className="slot-info hint">Vacía</span>
                {season ? (
                  <RetroButton variant="primary" onClick={() => saveToSlot(slot)}>
                    Guardar aquí
                  </RetroButton>
                ) : null}
              </div>
            )}
          </RetroPanel>
        );
      })}
      <RetroButton onClick={() => goTo(season ? 'season' : 'title')}>Atrás</RetroButton>
    </main>
  );
}
