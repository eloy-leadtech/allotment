import { useMemo, useState } from 'react';
import { buyableListings, formatEuros, careerTeamName } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';

/** How many buy candidates to show at once (the pool is the whole league). */
const MAX_ROWS = 40;

export function MarketScreen() {
  const career = useGameStore((s) => s.career);
  const bids = useGameStore((s) => s.bids);
  const marketMessage = useGameStore((s) => s.marketMessage);
  const buyInMarket = useGameStore((s) => s.buyInMarket);
  const acceptMarketBid = useGameStore((s) => s.acceptMarketBid);
  const startSeasonFromMarket = useGameStore((s) => s.startSeasonFromMarket);
  const goTo = useGameStore((s) => s.goTo);
  const [query, setQuery] = useState('');

  const listings = useMemo(() => (career ? buyableListings(career) : []), [career]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? listings.filter((l) => l.player.nombre.toLowerCase().includes(q)) : listings;
    return pool.slice(0, MAX_ROWS);
  }, [listings, query]);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const mySquad = career.teams.find((t) => t.id === career.humanTeamId)?.players ?? [];
  const nameById = new Map(mySquad.map((p) => [p.id, p.nombre]));
  // A bid is only valid while you still own that player.
  const openBids = bids.filter((b) => nameById.has(b.playerId));
  const name = (id: string): string => careerTeamName(career, id);

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Mercado de fichajes · {career.temporada}</h1>
        <span className="matchday">Presupuesto: {formatEuros(career.budget)}</span>
      </header>

      {marketMessage ? <p className="market-msg">{marketMessage}</p> : null}

      <RetroButton variant="primary" onClick={startSeasonFromMarket}>
        Empezar temporada →
      </RetroButton>

      <RetroPanel title={`Ofertas por tus jugadores (${openBids.length})`}>
        {openBids.length === 0 ? (
          <p className="hint">Nadie puja por tus jugadores este mercado.</p>
        ) : (
          <ul className="market-list">
            {openBids.map((bid) => (
              <li key={bid.playerId} className="market-row">
                <span className="market-name">{nameById.get(bid.playerId)}</span>
                <span className="hint">
                  {name(bid.fromClubId)} · {formatEuros(bid.amount)}
                </span>
                <RetroButton onClick={() => acceptMarketBid(bid)}>Vender</RetroButton>
              </li>
            ))}
          </ul>
        )}
      </RetroPanel>

      <RetroPanel title="Fichar">
        <input
          className="market-search"
          type="search"
          placeholder="Buscar jugador…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="market-list">
          {filtered.map((l) => {
            const tooExpensive = career.budget < l.askingPrice;
            return (
              <li key={l.player.id} className="market-row">
                <span className="market-name team-cell">
                  <Crest teamId={l.clubId} size={18} />
                  {l.player.nombre}
                </span>
                <span className="hint">
                  {l.player.posicion} · media {l.player.media} · {formatEuros(l.askingPrice)}
                </span>
                <RetroButton disabled={tooExpensive} onClick={() => buyInMarket(l.player.id)}>
                  Fichar
                </RetroButton>
              </li>
            );
          })}
        </ul>
        {listings.length > filtered.length ? (
          <p className="hint">Mostrando {filtered.length} de {listings.length}. Busca por nombre para afinar.</p>
        ) : null}
      </RetroPanel>

      <div className="season-actions">
        <RetroButton variant="primary" onClick={startSeasonFromMarket}>
          Empezar temporada →
        </RetroButton>
      </div>
    </main>
  );
}
