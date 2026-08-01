import { useMemo, useState } from 'react';
import { buyableListings, formatEuros, careerTeamName, squadWageBill, playerScoutReport } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';
import { PotentialRange } from '@ui/components/PotentialRange';

/** How many buy candidates to show at once (the pool is the whole league). */
const MAX_ROWS = 40;

export function MarketScreen() {
  const career = useGameStore((s) => s.career);
  const bids = useGameStore((s) => s.bids);
  const lastIncome = useGameStore((s) => s.lastIncome);
  const lastWageBill = useGameStore((s) => s.lastWageBill);
  const marketMessage = useGameStore((s) => s.marketMessage);
  const counterOffer = useGameStore((s) => s.counterOffer);
  const makeOffer = useGameStore((s) => s.makeOffer);
  const acceptCounterOffer = useGameStore((s) => s.acceptCounterOffer);
  const acceptMarketBid = useGameStore((s) => s.acceptMarketBid);
  const scoutPlayer = useGameStore((s) => s.scoutPlayer);
  const startSeasonFromMarket = useGameStore((s) => s.startSeasonFromMarket);
  const goTo = useGameStore((s) => s.goTo);
  const [query, setQuery] = useState('');
  /** Draft offer amounts (in euros) keyed by player id; blank = use asking. */
  const [offers, setOffers] = useState<Record<string, string>>({});

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

  const myTeam = career.teams.find((t) => t.id === career.humanTeamId);
  const mySquad = myTeam?.players ?? [];
  const currentWages = myTeam ? squadWageBill(myTeam, career.contracts) : 0;
  const nameById = new Map(mySquad.map((p) => [p.id, p.nombre]));
  // A bid is only valid while you still own that player.
  const openBids = bids.filter((b) => nameById.has(b.playerId));
  const name = (id: string): string => careerTeamName(career, id);

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Mercado de fichajes · {career.temporada}</h1>
        <span className="matchday">
          Presupuesto: {formatEuros(career.budget)} · Masa salarial: {formatEuros(currentWages)}/año
        </span>
      </header>

      {marketMessage ? <p className="market-msg">{marketMessage}</p> : null}

      {lastIncome ? (
        <RetroPanel title={`Ingresos de la temporada · ${formatEuros(lastIncome.total)}`}>
          <ul className="market-list">
            <li className="market-row"><span className="market-name">Derechos de TV</span><span className="hint">{formatEuros(lastIncome.tv)}</span></li>
            <li className="market-row"><span className="market-name">Taquilla</span><span className="hint">{formatEuros(lastIncome.gate)}</span></li>
            <li className="market-row"><span className="market-name">Premio de liga (posición)</span><span className="hint">{formatEuros(lastIncome.leaguePrize)}</span></li>
            {lastIncome.copa > 0 ? (
              <li className="market-row"><span className="market-name">Copa del Rey</span><span className="hint">{formatEuros(lastIncome.copa)}</span></li>
            ) : null}
            {lastIncome.europa > 0 ? (
              <li className="market-row"><span className="market-name">Competición europea</span><span className="hint">{formatEuros(lastIncome.europa)}</span></li>
            ) : null}
            {lastWageBill != null ? (
              <li className="market-row">
                <span className="market-name">Masa salarial (−)</span>
                <span className="squad-status squad-status--injured">−{formatEuros(lastWageBill)}</span>
              </li>
            ) : null}
            {lastWageBill != null ? (
              <li className="market-row">
                <span className="market-name"><strong>Balance</strong></span>
                <span className="hint"><strong>{formatEuros(lastIncome.total - lastWageBill)}</strong></span>
              </li>
            ) : null}
          </ul>
        </RetroPanel>
      ) : null}

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
            const draft = offers[l.player.id] ?? '';
            const offerEuros = draft.trim() === '' ? l.askingPrice : Math.round(Number(draft) * 1_000_000);
            const validOffer = Number.isFinite(offerEuros) && offerEuros > 0;
            const isCountered = counterOffer?.playerId === l.player.id;
            const report = playerScoutReport(career, l.player);
            return (
              <li key={l.player.id} className="market-row market-negotiate">
                <span className="market-name team-cell">
                  <Crest teamId={l.clubId} size={18} />
                  {l.player.nombre}
                </span>
                <span className="hint">
                  {l.player.posicion} ·{' '}
                  {report.revealed
                    ? `media ${report.media}`
                    : `media ~${report.ability.low}–${report.ability.high}`}{' '}
                  · pide {formatEuros(l.askingPrice)} · cláusula {formatEuros(l.clause)}
                </span>
                <span className="market-scout">
                  <PotentialRange low={report.potential.low} high={report.potential.high} />
                  <RetroButton
                    disabled={report.scoutedThisSeason}
                    onClick={() => scoutPlayer(l.player.id)}
                  >
                    {report.scoutedThisSeason ? 'Ojeado ✓' : 'Ojear'}
                  </RetroButton>
                </span>
                <span className="market-offer">
                  <input
                    className="offer-input"
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder={(l.askingPrice / 1_000_000).toFixed(1)}
                    value={draft}
                    onChange={(e) => setOffers((o) => ({ ...o, [l.player.id]: e.target.value }))}
                    aria-label={`Oferta por ${l.player.nombre} en millones`}
                  />
                  <span className="hint">M€</span>
                  <RetroButton
                    disabled={!validOffer}
                    onClick={() => makeOffer(l.player.id, offerEuros)}
                  >
                    Ofertar
                  </RetroButton>
                  {isCountered ? (
                    <RetroButton variant="primary" onClick={acceptCounterOffer}>
                      Aceptar {formatEuros(counterOffer.counter)}
                    </RetroButton>
                  ) : null}
                </span>
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
