import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Crest } from '@ui/components/Crest';

export function TeamSelectScreen() {
  const league = useGameStore((s) => s.league);
  const startCareer = useGameStore((s) => s.startCareer);
  const goTo = useGameStore((s) => s.goTo);
  const teams = [...league.equipos].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <main className="screen">
      <h1>Elige tu equipo</h1>
      <div className="team-grid">
        {teams.map((team) => (
          <RetroButton key={team.id} onClick={() => startCareer(team.id)}>
            <span className="team-cell">
              <Crest teamId={team.id} size={22} />
              {team.nombre}
            </span>
          </RetroButton>
        ))}
      </div>
      <RetroButton onClick={() => goTo('title')}>Atrás</RetroButton>
    </main>
  );
}
