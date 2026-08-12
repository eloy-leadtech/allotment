import { useState } from 'react';
import {
  catalogCountries,
  catalogFor,
  fetchLeague,
  type League,
  type Player,
} from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';
import { PlayerPhoto } from '@ui/components/PlayerPhoto';

const ATTR_LABELS: Array<[keyof Player['atributos'], string]> = [
  ['calidad', 'Calidad'],
  ['remate', 'Remate'],
  ['ofensivo', 'Ofensivo'],
  ['pase', 'Pase'],
  ['velocidad', 'Velocidad'],
  ['entrada', 'Entrada'],
  ['agresividad', 'Agresividad'],
  ['resistencia', 'Resistencia'],
  ['fisico', 'Físico'],
  ['porteria', 'Portería'],
];

/** Read-only browser over the whole historical catalogue (692 leagues). */
export function DatabaseScreen() {
  const goTo = useGameStore((s) => s.goTo);
  const countries = catalogCountries();
  const [country, setCountry] = useState('ESP');
  const [division, setDivision] = useState('1');
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);

  const seasons = catalogFor(country, division)
    .slice()
    .sort((a, b) => b.season.localeCompare(a.season));

  const openLeague = (id: string): void => {
    setLoading(id);
    setLeague(null);
    setTeamId(null);
    setPlayer(null);
    void fetchLeague(id)
      .then((lg) => setLeague(lg))
      .finally(() => setLoading(''));
  };

  const team = league?.equipos.find((t) => t.id === teamId) ?? null;

  return (
    <main className="screen">
      <div className="head-center">
        <div className="title-plate">
          <h1>Base de datos</h1>
        </div>
      </div>

      <RetroPanel title="Elige liga y temporada">
        <div className="cat-controls">
          <label>
            País:{' '}
            <select
              className="seed-input"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setLeague(null);
                setTeamId(null);
                setPlayer(null);
              }}
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
        {seasons.length === 0 ? (
          <p className="hint">Sin Segunda División para este país en el catálogo.</p>
        ) : (
          <div className="team-grid cat-seasons">
            {seasons.map((e) => (
              <RetroButton
                key={e.id}
                variant={league?.id === e.id ? 'primary' : 'default'}
                onClick={() => openLeague(e.id)}
              >
                {loading === e.id ? 'Cargando…' : e.temporada}
              </RetroButton>
            ))}
          </div>
        )}
      </RetroPanel>

      {league && (
        <RetroPanel title={`${league.nombre} · ${league.temporada}`}>
          <div className="team-grid">
            {[...league.equipos]
              .sort((a, b) => a.nombre.localeCompare(b.nombre))
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="team-tile"
                  onClick={() => {
                    setTeamId(t.id);
                    setPlayer(null);
                  }}
                >
                  <span className="team-tile__crest">
                    <Crest teamId={t.id} size={36} />
                  </span>
                  <span className="team-tile__name">{t.nombre}</span>
                </button>
              ))}
          </div>
        </RetroPanel>
      )}

      {team && (
        <RetroPanel title={`Plantilla · ${team.nombre}`}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Pos</th>
                <th>Media</th>
              </tr>
            </thead>
            <tbody>
              {[...team.jugadores]
                .sort((a, b) => b.media - a.media)
                .map((p) => (
                  <tr
                    key={p.id}
                    className={player?.id === p.id ? 'is-selected' : ''}
                    onClick={() => setPlayer(p)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{p.nombre}</td>
                    <td>{p.posicion}</td>
                    <td>{p.media}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </RetroPanel>
      )}

      {player && (
        <RetroPanel title={`Ficha · ${player.nombreCompleto}`}>
          <div className="ficha-head">
            <PlayerPhoto bdfId={player.bdfId} size={104} />
            <p className="hint" style={{ margin: 0 }}>
              {player.posicion}
              {player.nacionalidad ? ` · ${player.nacionalidad}` : ''}
              {player.fechaNacimiento ? ` · nac. ${player.fechaNacimiento}` : ''}
              {player.alturaCm ? ` · ${player.alturaCm} cm` : ''}
              {player.pesoKg ? ` · ${player.pesoKg} kg` : ''}
            </p>
          </div>
          <div className="attr-grid">
            {ATTR_LABELS.map(([key, label]) => (
              <span key={key} className="attr-cell">
                <span className="attr-cell__label">{label}</span>
                <span className="attr-cell__val">{player.atributos[key] ?? '—'}</span>
              </span>
            ))}
            <span className="attr-cell attr-cell--media">
              <span className="attr-cell__label">MEDIA</span>
              <span className="attr-cell__val">{player.media}</span>
            </span>
          </div>
          {player.comentario ? (
            <p className="player-bio">{player.comentario}</p>
          ) : (
            <p className="hint">Comentario no disponible para este jugador.</p>
          )}
        </RetroPanel>
      )}

      <RetroButton onClick={() => goTo('title')}>Atrás</RetroButton>
    </main>
  );
}
