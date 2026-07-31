import { useMemo, useState } from 'react';
import { buyableListings, formatEuros, careerTeamName } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { Crest } from '@ui/components/Crest';
import { Pcf7Console } from '@ui/components/Pcf7Frame';

/** How many buy candidates to show at once (the pool is the whole league). */
const MAX_ROWS = 40;

export function MarketScreen() {
  const career = useGameStore((s) => s.career);
  const bids = useGameStore((s) => s.bids);
  const lastIncome = useGameStore((s) => s.lastIncome);
  const marketMessage = useGameStore((s) => s.marketMessage);
  const counterOffer = useGameStore((s) => s.counterOffer);
  const makeOffer = useGameStore((s) => s.makeOffer);
  const acceptCounterOffer = useGameStore((s) => s.acceptCounterOffer);
  const acceptMarketBid = useGameStore((s) => s.acceptMarketBid);
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

  const mySquad = career.teams.find((t) => t.id === career.humanTeamId)?.players ?? [];
  const nameById = new Map(mySquad.map((p) => [p.id, p.nombre]));
  // A bid is only valid while you still own that player.
  const openBids = bids.filter((b) => nameById.has(b.playerId));
  const name = (id: string): string => careerTeamName(career, id);

  return (
    <Pcf7Console
      title={`Mercado · ${career.temporada}`}
      status={`Presupuesto: ${formatEuros(career.budget)}`}
      footer={
        <>
          <button type="button" className="pcf7flatbtn pcf7flatbtn--primary" onClick={startSeasonFromMarket}>
            Empezar temporada →
          </button>
          <button type="button" className="pcf7flatbtn" onClick={() => goTo('season')}>
            Despacho
          </button>
        </>
      }
    >
      {marketMessage ? <p className="pcf7data-ovl" style={{ position: 'static', color: 'var(--c-accent)', margin: 0 }}>{marketMessage}</p> : null}

      {lastIncome ? (
        <section className="pcf7card">
          <div className="pcf7card__head">Ingresos de la temporada · {formatEuros(lastIncome.total)}</div>
          <ul className="pcf7list">
            <li><span className="pcf7list__grow">Derechos de TV</span><span className="pcf7list__dim">{formatEuros(lastIncome.tv)}</span></li>
            <li><span className="pcf7list__grow">Taquilla</span><span className="pcf7list__dim">{formatEuros(lastIncome.gate)}</span></li>
            <li><span className="pcf7list__grow">Premio de liga (posición)</span><span className="pcf7list__dim">{formatEuros(lastIncome.leaguePrize)}</span></li>
            {lastIncome.copa > 0 ? (
              <li><span className="pcf7list__grow">Copa del Rey</span><span className="pcf7list__dim">{formatEuros(lastIncome.copa)}</span></li>
            ) : null}
            {lastIncome.europa > 0 ? (
              <li><span className="pcf7list__grow">Competición europea</span><span className="pcf7list__dim">{formatEuros(lastIncome.europa)}</span></li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section className="pcf7card">
        <div className="pcf7card__head">Ofertas por tus jugadores ({openBids.length})</div>
        {openBids.length === 0 ? (
          <p className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)', padding: '0.5em 0.7em', margin: 0 }}>
            Nadie puja por tus jugadores este mercado.
          </p>
        ) : (
          <ul className="pcf7list">
            {openBids.map((bid) => (
              <li key={bid.playerId}>
                <span className="pcf7list__grow">{nameById.get(bid.playerId)}</span>
                <span className="pcf7list__dim">{name(bid.fromClubId)} · {formatEuros(bid.amount)}</span>
                <button type="button" className="pcf7formchip" onClick={() => acceptMarketBid(bid)}>Vender</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pcf7card">
        <div className="pcf7card__head">Fichar</div>
        <div style={{ padding: '0.5em 0.7em' }}>
          <input
            className="pcf7input"
            type="search"
            placeholder="Buscar jugador…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ul className="pcf7list">
          {filtered.map((l) => {
            const draft = offers[l.player.id] ?? '';
            const offerEuros = draft.trim() === '' ? l.askingPrice : Math.round(Number(draft) * 1_000_000);
            const validOffer = Number.isFinite(offerEuros) && offerEuros > 0;
            const isCountered = counterOffer?.playerId === l.player.id;
            return (
              <li key={l.player.id} style={{ flexWrap: 'wrap' }}>
                <span className="pcf7list__grow" style={{ display: 'flex', alignItems: 'center', gap: '0.4em' }}>
                  <Crest teamId={l.clubId} size={18} />
                  {l.player.nombre}
                </span>
                <span className="pcf7list__dim">
                  {l.player.posicion} · media {l.player.media} · pide {formatEuros(l.askingPrice)} · cláusula {formatEuros(l.clause)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35em' }}>
                  <input
                    className="pcf7num"
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder={(l.askingPrice / 1_000_000).toFixed(1)}
                    value={draft}
                    onChange={(e) => setOffers((o) => ({ ...o, [l.player.id]: e.target.value }))}
                    aria-label={`Oferta por ${l.player.nombre} en millones`}
                  />
                  <span className="pcf7list__dim">M€</span>
                  <button
                    type="button"
                    className="pcf7formchip"
                    disabled={!validOffer}
                    onClick={() => makeOffer(l.player.id, offerEuros)}
                  >
                    Ofertar
                  </button>
                  {isCountered ? (
                    <button type="button" className="pcf7formchip pcf7formchip--on" onClick={acceptCounterOffer}>
                      Aceptar {formatEuros(counterOffer.counter)}
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
        {listings.length > filtered.length ? (
          <p className="pcf7list__dim" style={{ fontFamily: 'var(--font-data)', padding: '0.4em 0.7em', margin: 0 }}>
            Mostrando {filtered.length} de {listings.length}. Busca por nombre para afinar.
          </p>
        ) : null}
      </section>
    </Pcf7Console>
  );
}
