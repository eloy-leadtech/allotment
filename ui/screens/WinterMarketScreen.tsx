import { useMemo, useState } from 'react';
import {
  winterBuyableListings,
  formatEuros,
  careerTeamName,
  squadWageBill,
  playerScoutReport,
} from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { Crest } from '@ui/components/Crest';
import { GestHeader } from '@ui/components/GestHeader';
import { PotentialRange } from '@ui/components/PotentialRange';

/** How many buy candidates to show at once (the pool is the whole league). */
const MAX_ROWS = 40;

/**
 * The mid-season WINTER TRANSFER WINDOW. Reuses the pre-season market's building
 * blocks, but signings/sales only reinforce the squad for the SECOND half — the
 * jornadas already played never change (see winterMarket.ts). The player closes the
 * window with "Continuar" to play on.
 */
export function WinterMarketScreen() {
  const career = useGameStore((s) => s.career);
  const bids = useGameStore((s) => s.bids);
  const marketMessage = useGameStore((s) => s.marketMessage);
  const counterOffer = useGameStore((s) => s.counterOffer);
  const winterBuy = useGameStore((s) => s.winterBuy);
  const winterOffer = useGameStore((s) => s.winterOffer);
  const winterAcceptCounterOffer = useGameStore((s) => s.winterAcceptCounterOffer);
  const winterSell = useGameStore((s) => s.winterSell);
  const closeWinterMarket = useGameStore((s) => s.closeWinterMarket);
  const scoutPlayer = useGameStore((s) => s.scoutPlayer);
  const goTo = useGameStore((s) => s.goTo);
  const [query, setQuery] = useState('');
  /** Draft offer amounts (in euros) keyed by player id; blank = use asking. */
  const [offers, setOffers] = useState<Record<string, string>>({});

  const listings = useMemo(() => (career ? winterBuyableListings(career) : []), [career]);
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
  const season = career.season;

  const budgetChip = career.budget < 0
    ? { label: 'Presupuesto', value: `−${formatEuros(-career.budget)}`, tone: 'danger' as const }
    : { label: 'Presupuesto', value: formatEuros(career.budget) };

  return (
    <main className="screen">
      <GestHeader
        icon="❄️"
        title="Mercado de invierno"
        subtitle={`Parón de mitad de temporada · Jornada ${season.currentMatchday}/${season.totalMatchdays}`}
        chips={[
          budgetChip,
          { label: 'Masa salarial', value: `${formatEuros(currentWages)}/año`, tone: 'danger' },
        ]}
      />

      <p className="hint">
        La ventana de invierno abre a mitad de liga: refuerza tu plantilla para la segunda vuelta.
        Lo ya jugado no cambia; tus fichajes entran a partir de esta jornada.
      </p>

      {marketMessage ? <p className="market-msg">{marketMessage}</p> : null}

      <RetroButton variant="primary" onClick={closeWinterMarket}>
        Continuar 2ª vuelta →
      </RetroButton>

      <RetroPanel title={`Ofertas por tus jugadores (${openBids.length})`}>
        {openBids.length === 0 ? (
          <p className="hint">Nadie puja por tus jugadores en este mercado de invierno.</p>
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
                  <RetroButton variant="primary" onClick={() => winterSell(bid)}>
                    Vender
                  </RetroButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </RetroPanel>

      <RetroPanel title="Fichar en invierno">
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
                    onClick={() => winterOffer(l.player.id, offerEuros)}
                  >
                    Ofertar
                  </RetroButton>
                  <RetroButton onClick={() => winterBuy(l.player.id)}>
                    Fichar ({formatEuros(l.askingPrice)})
                  </RetroButton>
                  {isCountered ? (
                    <RetroButton variant="primary" onClick={winterAcceptCounterOffer}>
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
        <RetroButton variant="primary" onClick={closeWinterMarket}>
          Continuar 2ª vuelta →
        </RetroButton>
      </div>
    </main>
  );
}
