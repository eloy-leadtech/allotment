import { useMemo, useState } from 'react';
import { buyableListings, formatEuros, careerTeamName, squadWageBill, playerScoutReport } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';
import { GestHeader } from '@ui/components/GestHeader';
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
      <GestHeader
        icon="💰"
        title="Mercado de fichajes"
        subtitle={`Temporada ${career.temporada}`}
        chips={[
          { label: 'Presupuesto', value: formatEuros(career.budget) },
          { label: 'Masa salarial', value: `${formatEuros(currentWages)}/año`, tone: 'danger' },
        ]}
      />

      {marketMessage ? <p className="market-msg">{marketMessage}</p> : null}

      {lastIncome ? (
        <RetroPanel title={`Ingresos de la temporada · ${formatEuros(lastIncome.total)}`}>
          <ul className="mkt-ledger">
            <li className="mkt-ledger__row">
              <span className="mkt-ledger__label">Derechos de TV</span>
              <span className="mkt-ledger__value">{formatEuros(lastIncome.tv)}</span>
            </li>
            <li className="mkt-ledger__row">
              <span className="mkt-ledger__label">Taquilla</span>
              <span className="mkt-ledger__value">{formatEuros(lastIncome.gate)}</span>
            </li>
            <li className="mkt-ledger__row">
              <span className="mkt-ledger__label">Premio de liga (posición)</span>
              <span className="mkt-ledger__value">{formatEuros(lastIncome.leaguePrize)}</span>
            </li>
            {lastIncome.copa > 0 ? (
              <li className="mkt-ledger__row">
                <span className="mkt-ledger__label">Copa del Rey</span>
                <span className="mkt-ledger__value">{formatEuros(lastIncome.copa)}</span>
              </li>
            ) : null}
            {lastIncome.europa > 0 ? (
              <li className="mkt-ledger__row">
                <span className="mkt-ledger__label">Competición europea</span>
                <span className="mkt-ledger__value">{formatEuros(lastIncome.europa)}</span>
              </li>
            ) : null}
            {lastIncome.sponsor > 0 ? (
              <li className="mkt-ledger__row">
                <span className="mkt-ledger__label">Patrocinador principal</span>
                <span className="mkt-ledger__value">{formatEuros(lastIncome.sponsor)}</span>
              </li>
            ) : null}
            {lastWageBill != null ? (
              <li className="mkt-ledger__row">
                <span className="mkt-ledger__label">Masa salarial</span>
                <span className="mkt-ledger__value mkt-ledger__value--neg">−{formatEuros(lastWageBill)}</span>
              </li>
            ) : null}
            {lastWageBill != null ? (
              <li className="mkt-ledger__row mkt-ledger__row--balance">
                <span className="mkt-ledger__label">Balance</span>
                <span className="mkt-ledger__value">{formatEuros(lastIncome.total - lastWageBill)}</span>
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
          <ul className="mkt-list">
            {openBids.map((bid) => (
              <li key={bid.playerId} className="mkt-signing">
                <div className="mkt-signing__head">
                  <span className="mkt-signing__name team-cell">
                    <Crest teamId={bid.fromClubId} size={22} />
                    {nameById.get(bid.playerId)}
                  </span>
                  <span className="mkt-media">
                    {formatEuros(bid.amount)}
                    <small>oferta</small>
                  </span>
                </div>
                <div className="mkt-signing__actions">
                  <span className="mkt-term">
                    <em>Puja</em>
                    <strong>{name(bid.fromClubId)}</strong>
                  </span>
                  <RetroButton variant="primary" onClick={() => acceptMarketBid(bid)}>
                    Vender
                  </RetroButton>
                </div>
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
        <ul className="mkt-list">
          {filtered.map((l) => {
            const draft = offers[l.player.id] ?? '';
            const offerEuros = draft.trim() === '' ? l.askingPrice : Math.round(Number(draft) * 1_000_000);
            const validOffer = Number.isFinite(offerEuros) && offerEuros > 0;
            const isCountered = counterOffer?.playerId === l.player.id;
            const report = playerScoutReport(career, l.player);
            return (
              <li key={l.player.id} className="mkt-signing">
                <div className="mkt-signing__head">
                  <span className={`pos-badge pos-badge--${l.player.posicion}`}>{l.player.posicion}</span>
                  <span className="mkt-signing__name team-cell">
                    <Crest teamId={l.clubId} size={22} />
                    {l.player.nombre}
                  </span>
                  <span className="mkt-media">
                    {report.revealed ? report.media : `${report.ability.low}–${report.ability.high}`}
                    <small>media</small>
                  </span>
                </div>
                <div className="mkt-signing__terms">
                  <span className="mkt-term">
                    <em>Pide</em>
                    <strong>{formatEuros(l.askingPrice)}</strong>
                  </span>
                  <span className="mkt-term">
                    <em>Cláusula</em>
                    <strong>{formatEuros(l.clause)}</strong>
                  </span>
                  <span className="mkt-term">
                    <em>Potencial</em>
                    <PotentialRange low={report.potential.low} high={report.potential.high} />
                  </span>
                </div>
                <div className="mkt-signing__actions">
                  <RetroButton
                    disabled={report.scoutedThisSeason}
                    onClick={() => scoutPlayer(l.player.id)}
                  >
                    {report.scoutedThisSeason ? 'Ojeado ✓' : 'Ojear'}
                  </RetroButton>
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
                </div>
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
