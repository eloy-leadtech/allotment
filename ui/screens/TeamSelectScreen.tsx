import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';

export function TeamSelectScreen() {
  const league = useGameStore((s) => s.league);
  const startSeason = useGameStore((s) => s.startSeason);
  const goTo = useGameStore((s) => s.goTo);
  const teams = [...league.equipos].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <main className="screen">
      <h1>Elige tu equipo</h1>
      <div className="team-grid">
        {teams.map((team) => (
          <RetroButton key={team.id} onClick={() => startSeason(team.id)}>
            {team.nombre}
          </RetroButton>
        ))}
      </div>
      <RetroButton onClick={() => goTo('title')}>Atrás</RetroButton>
    </main>
  );
}
