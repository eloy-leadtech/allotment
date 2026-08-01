import {
  formatEuros,
  stadiumAforo,
  stadiumTierLabel,
  gateMultiplier,
  canExpand,
  nextExpansionCost,
  nextExpansionAforo,
  STADIUM_TIERS,
} from '@game';
import { getEstadio } from '@data';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';

/** Flat per-division base gate (mirrors finances.ts) to project the taquilla. */
const BASE_GATE = { primera: 12_000_000, segunda: 3_000_000 } as const;

/**
 * Estadio / Instalaciones: shows the ground's current aforo and lets the manager
 * INVEST budget to enlarge it. A bigger aforo lifts the season's taquilla (gate)
 * every season that follows — a classic PC Fútbol long-term investment.
 */
export function StadiumScreen() {
  const career = useGameStore((s) => s.career);
  const marketMessage = useGameStore((s) => s.marketMessage);
  const expand = useGameStore((s) => s.expandStadium);
  const goTo = useGameStore((s) => s.goTo);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const stadium = career.stadium;
  const info = getEstadio(career.humanTeamId);
  const aforo = stadiumAforo(stadium);
  const currentGate = Math.round(BASE_GATE[career.division] * gateMultiplier(stadium));
  const cost = nextExpansionCost(stadium);
  const nextAforo = nextExpansionAforo(stadium);
  const nextGate =
    nextAforo !== null
      ? Math.round(BASE_GATE[career.division] * (nextAforo / STADIUM_TIERS[0]!.aforo))
      : null;
  const affordable = cost !== null && career.budget >= cost;

  return (
    <main className="screen">
      <header className="season-head">
        <h1>Estadio · {info?.nombre ?? 'Instalaciones'}</h1>
        <span className="matchday">Presupuesto: {formatEuros(career.budget)}</span>
      </header>

      {marketMessage ? <p className="market-msg">{marketMessage}</p> : null}

      <RetroPanel title="Estado actual">
        <p className="board-objective">
          🏟️ {stadiumTierLabel(stadium)}{' '}
          <span className="hint">(nivel {stadium.capacityLevel + 1} / {STADIUM_TIERS.length})</span>
        </p>
        <p>
          Aforo: <strong>{aforo.toLocaleString('es-ES')}</strong> espectadores
        </p>
        <p className="hint">
          Taquilla estimada esta temporada: {formatEuros(currentGate)} (x{gateMultiplier(stadium).toFixed(2)} sobre la base)
        </p>
      </RetroPanel>

      <RetroPanel title="Ampliar el estadio">
        {canExpand(stadium) && cost !== null && nextAforo !== null ? (
          <>
            <p className="hint">
              Invierte presupuesto para ampliar el aforo hasta{' '}
              <strong>{nextAforo.toLocaleString('es-ES')}</strong> espectadores. Una taquilla mayor
              sube tus ingresos cada temporada
              {nextGate !== null ? ` (pasaría a ~${formatEuros(nextGate)})` : ''}.
            </p>
            <p>
              Coste de la obra: <strong>{formatEuros(cost)}</strong>
            </p>
            <div className="season-actions">
              <RetroButton variant="primary" onClick={expand} disabled={!affordable}>
                Ampliar aforo
              </RetroButton>
              {!affordable ? <span className="hint">No te llega el presupuesto.</span> : null}
            </div>
          </>
        ) : (
          <p className="hint">Tu estadio ya está al máximo nivel. No se puede ampliar más.</p>
        )}
      </RetroPanel>

      <RetroPanel title="Niveles del estadio">
        <ul className="market-list">
          {STADIUM_TIERS.map((tier, i) => {
            const on = i === stadium.capacityLevel;
            return (
              <li key={i} className="market-row">
                <span className="market-name">
                  {on ? '➡️ ' : ''}
                  {tier.label}
                </span>
                <span className="hint">
                  {tier.aforo.toLocaleString('es-ES')} espectadores
                  {tier.upgradeCost > 0 ? ` · ${formatEuros(tier.upgradeCost)}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </RetroPanel>

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}
