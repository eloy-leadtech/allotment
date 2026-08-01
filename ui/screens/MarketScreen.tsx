import { useMemo, useState } from 'react';
import {
  buyableListings,
  formatEuros,
  careerTeamName,
  squadWageBill,
  playerScoutReport,
  totalDebt,
  creditLimit,
  creditAvailable,
  loanOutCandidates,
  loanOffers,
  careerLoans,
} from '@game';
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
  const lastInterest = useGameStore((s) => s.lastInterest);
  const marketMessage = useGameStore((s) => s.marketMessage);
  const counterOffer = useGameStore((s) => s.counterOffer);
  const makeOffer = useGameStore((s) => s.makeOffer);
  const acceptCounterOffer = useGameStore((s) => s.acceptCounterOffer);
  const acceptMarketBid = useGameStore((s) => s.acceptMarketBid);
  const requestCredit = useGameStore((s) => s.requestCredit);
  const scoutPlayer = useGameStore((s) => s.scoutPlayer);
  const loanOut = useGameStore((s) => s.loanOut);
  const loanIn = useGameStore((s) => s.loanIn);
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
  const outCandidates = useMemo(() => (career ? loanOutCandidates(career) : []), [career]);
  const inOffers = useMemo(() => (career ? loanOffers(career).slice(0, MAX_ROWS) : []), [career]);
  const loanedInIds = useMemo(() => new Set(career ? careerLoans(career).in : []), [career]);
  const loanedOut = useMemo(() => (career ? careerLoans(career).out : []), [career]);

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

  // Bank/board credit and debt ("números rojos"): the budget can be negative.
  const debt = totalDebt(career);
  const inTheRed = career.budget < 0;
  const limit = creditLimit(career);
  const available = creditAvailable(career);
  const seasonsOverLimit = career.credit?.seasonsOverLimit ?? 0;
  const budgetChip = career.budget < 0
    ? { label: 'Presupuesto', value: `−${formatEuros(-career.budget)}`, tone: 'danger' as const }
    : { label: 'Presupuesto', value: formatEuros(career.budget) };

  return (
    <main className="screen">
      <GestHeader
        icon="💰"
        title="Mercado de fichajes"
        subtitle={`Temporada ${career.temporada}`}
        chips={[
          budgetChip,
          { label: 'Masa salarial', value: `${formatEuros(currentWages)}/año`, tone: 'danger' },
        ]}
      />

      {marketMessage ? <p className="market-msg">{marketMessage}</p> : null}

      <RetroPanel title="Crédito y deuda">
        <ul className="mkt-ledger">
          {debt > 0 ? (
            <li className="mkt-ledger__row">
              <span className="mkt-ledger__label">Deuda actual</span>
              <span className="mkt-ledger__value mkt-ledger__value--neg">−{formatEuros(debt)}</span>
            </li>
          ) : (
            <li className="mkt-ledger__row">
              <span className="mkt-ledger__label">Deuda actual</span>
              <span className="mkt-ledger__value">Sin deuda</span>
            </li>
          )}
          <li className="mkt-ledger__row">
            <span className="mkt-ledger__label">Límite de crédito de la directiva</span>
            <span className="mkt-ledger__value">{formatEuros(limit)}</span>
          </li>
          <li className="mkt-ledger__row">
            <span className="mkt-ledger__label">Crédito disponible</span>
            <span className="mkt-ledger__value">{formatEuros(available)}</span>
          </li>
        </ul>
        {inTheRed ? (
          <p className="fate fate--down">
            🔴 Estás en números rojos. La directiva te cobrará intereses cada temporada
            {seasonsOverLimit > 0
              ? ` y llevas ${seasonsOverLimit} temporada(s) por encima del límite: si sigues así, te destituirá.`
              : '.'}
          </p>
        ) : null}
        {available > 0 ? (
          <div className="season-actions">
            <RetroButton onClick={() => requestCredit(available)}>
              Pedir crédito ({formatEuros(available)})
            </RetroButton>
          </div>
        ) : (
          <p className="hint">La directiva no te concede más crédito por ahora.</p>
        )}
      </RetroPanel>

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
            {lastInterest != null && lastInterest > 0 ? (
              <li className="mkt-ledger__row">
                <span className="mkt-ledger__label">Intereses de la deuda</span>
                <span className="mkt-ledger__value mkt-ledger__value--neg">−{formatEuros(lastInterest)}</span>
              </li>
            ) : null}
            {lastWageBill != null ? (
              <li className="mkt-ledger__row mkt-ledger__row--balance">
                <span className="mkt-ledger__label">Balance</span>
                <span className="mkt-ledger__value">
                  {formatEuros(lastIncome.total - lastWageBill - (lastInterest ?? 0))}
                </span>
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

      <RetroPanel title="Cesiones">
        <p className="hint">
          Cede a un jugador una temporada (te ahorras su ficha y cobras una comisión; vuelve la
          próxima) o incorpora a un cedido, más barato que fichar, hasta final de temporada.
        </p>

        {loanedOut.length > 0 ? (
          <ul className="mkt-list">
            {loanedOut.map((lo) => (
              <li key={lo.player.id} className="mkt-signing mkt-signing--muted">
                <div className="mkt-signing__head">
                  <span className={`pos-badge pos-badge--${lo.player.posicion}`}>
                    {lo.player.posicion}
                  </span>
                  <span className="mkt-signing__name team-cell">
                    <Crest teamId={lo.toClubId} size={22} />
                    {lo.player.nombre}
                  </span>
                  <span className="mkt-term">
                    <em>Cedido a</em>
                    <strong>{name(lo.toClubId)}</strong>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <h4 className="mkt-subhead">Ceder de tu plantilla</h4>
        {outCandidates.length === 0 ? (
          <p className="hint">No tienes jugadores disponibles para ceder.</p>
        ) : (
          <ul className="mkt-list">
            {outCandidates.slice(0, MAX_ROWS).map((c) => (
              <li key={c.player.id} className="mkt-signing">
                <div className="mkt-signing__head">
                  <span className={`pos-badge pos-badge--${c.player.posicion}`}>
                    {c.player.posicion}
                  </span>
                  <span className="mkt-signing__name">{c.player.nombre}</span>
                  <span className="mkt-media">
                    {c.player.media}
                    <small>media</small>
                  </span>
                </div>
                <div className="mkt-signing__actions">
                  <span className="mkt-term">
                    <em>Comisión</em>
                    <strong>{formatEuros(c.commission)}</strong>
                  </span>
                  <RetroButton onClick={() => loanOut(c.player.id)}>Ceder</RetroButton>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h4 className="mkt-subhead">Incorporar cedidos</h4>
        {inOffers.length === 0 ? (
          <p className="hint">No hay jugadores ofrecidos en cesión este mercado.</p>
        ) : (
          <ul className="mkt-list">
            {inOffers.map((o) => {
              const already = loanedInIds.has(o.player.id);
              return (
                <li key={o.player.id} className="mkt-signing">
                  <div className="mkt-signing__head">
                    <span className={`pos-badge pos-badge--${o.player.posicion}`}>
                      {o.player.posicion}
                    </span>
                    <span className="mkt-signing__name team-cell">
                      <Crest teamId={o.clubId} size={22} />
                      {o.player.nombre}
                    </span>
                    <span className="mkt-media">
                      {o.player.media}
                      <small>media</small>
                    </span>
                  </div>
                  <div className="mkt-signing__terms">
                    <span className="mkt-term">
                      <em>Cesión</em>
                      <strong>{formatEuros(o.fee)}</strong>
                    </span>
                    <span className="mkt-term">
                      <em>Ficha</em>
                      <strong>{formatEuros(o.wage)}/año</strong>
                    </span>
                  </div>
                  <div className="mkt-signing__actions">
                    <RetroButton
                      variant="primary"
                      disabled={already}
                      onClick={() => loanIn(o.player.id)}
                    >
                      {already ? 'Cedido ✓' : 'Incorporar'}
                    </RetroButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </RetroPanel>

      <div className="season-actions">
        <RetroButton variant="primary" onClick={startSeasonFromMarket}>
          Empezar temporada →
        </RetroButton>
      </div>
    </main>
  );
}
