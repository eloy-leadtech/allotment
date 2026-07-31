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
      <div className="head-center">
        <div className="title-plate">
          <h1>Elige tu equipo</h1>
        </div>
      </div>
      <div className="team-grid">
        {teams.map((team) => (
          <button key={team.id} type="button" className="team-tile" onClick={() => startCareer(team.id)}>
            <span className="team-tile__crest">
              <Crest teamId={team.id} size={44} />
            </span>
            <span className="team-tile__name">{team.nombre}</span>
          </button>
        ))}
      </div>
      <RetroButton onClick={() => goTo('title')}>Atrás</RetroButton>
    </main>
  );
}
