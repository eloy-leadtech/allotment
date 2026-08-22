import { useState } from 'react';
import { SEASONS, catalogCountries, catalogFor } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';

export function NewGameScreen() {
  const seasonId = useGameStore((s) => s.seasonId);
  const seed = useGameStore((s) => s.seed);
  const chooseSeason = useGameStore((s) => s.chooseSeason);
  const openCatalogLeague = useGameStore((s) => s.openCatalogLeague);
  const setSeed = useGameStore((s) => s.setSeed);
  const randomizeSeed = useGameStore((s) => s.randomizeSeed);
  const goTo = useGameStore((s) => s.goTo);

  const countries = catalogCountries();
  const [country, setCountry] = useState('ITA');
  const [division, setDivision] = useState('1');
  const [loading, setLoading] = useState('');

  // Newest season first for the catalogue grid.
  const catSeasons = catalogFor(country, division)
    .slice()
    .sort((a, b) => b.season.localeCompare(a.season));

  const openLeague = (id: string): void => {
    setLoading(id);
    void openCatalogLeague(id).finally(() => setLoading(''));
  };

  return (
    <main className="screen">
      <div className="head-center">
        <div className="title-plate">
          <h1>Nueva partida</h1>
        </div>
      </div>

      <RetroPanel title="Ligas destacadas (España)">
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
        <p className="hint">
          Estas conservan copa, Europa y carrera multitemporada. Debajo tienes el catálogo
          histórico completo (14 países, 692 temporadas).
        </p>
        <RetroButton variant="primary" onClick={() => goTo('teamSelect')}>
          Elegir equipo
        </RetroButton>
      </RetroPanel>

      <RetroPanel title="Catálogo histórico — 14 países">
        <div className="cat-controls">
          <label>
            País:{' '}
            <select
              className="seed-input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <span className="cat-divisions">
            <RetroButton
              variant={division === '1' ? 'primary' : 'default'}
              onClick={() => setDivision('1')}
            >
              Primera
            </RetroButton>
            <RetroButton
              variant={division === '2' ? 'primary' : 'default'}
              onClick={() => setDivision('2')}
            >
              Segunda
            </RetroButton>
          </span>
        </div>
        {catSeasons.length === 0 ? (
          <p className="hint">Sin Segunda División para este país en el catálogo.</p>
        ) : (
          <div className="team-grid cat-seasons">
            {catSeasons.map((e) => (
              <RetroButton
                key={e.id}
                variant={e.id === seasonId ? 'primary' : 'default'}
                onClick={() => openLeague(e.id)}
              >
                {loading === e.id ? 'Cargando…' : `${e.temporada} · ${e.equipos} eq`}
              </RetroButton>
            ))}
          </div>
        )}
        <p className="hint">
          Al elegir una temporada del catálogo pasarás directo a elegir equipo. (Carrera de una
          temporada completa; el encadenado entre temporadas del catálogo está en marcha.)
        </p>
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

      <RetroButton onClick={() => goTo('title')}>Atrás</RetroButton>
    </main>
  );
}
