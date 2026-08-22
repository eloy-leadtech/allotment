import { useState } from 'react';
import { pendingRenewals, resolvedRenewals, formatEuros } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroPanel } from './RetroPanel';
import { RetroButton } from './RetroButton';

/**
 * Season-end RENOVACIONES: the players whose deal is in its final year put a
 * demand on the table. Accept it, counter-offer your own ficha/term, or let them
 * leave FREE (Bosman). Renewed players stay on a fresh deal; the rest walk at the
 * transition. All logic lives in game/career/renewals.ts; this only renders it.
 */
export function RenewalsPanel() {
  const career = useGameStore((s) => s.career);
  const accept = useGameStore((s) => s.acceptRenewal);
  const offer = useGameStore((s) => s.offerRenewal);
  const letGo = useGameStore((s) => s.letGoPlayer);
  /** Draft counter-offer ficha (in thousands of euros), keyed by player id. */
  const [salaries, setSalaries] = useState<Record<string, string>>({});
  /** Draft counter-offer term (in seasons), keyed by player id. */
  const [years, setYears] = useState<Record<string, string>>({});

  if (!career) return null;
  const offers = pendingRenewals(career);
  const resolved = resolvedRenewals(career);
  if (offers.length === 0 && resolved.length === 0) return null;

  return (
    <RetroPanel title="Renovaciones de contrato">
      {offers.length > 0 ? (
        <>
          <p className="hint">
            A estos jugadores les acaba el contrato. Renueva o se marcharán LIBRES (Bosman).
          </p>
          <ul className="retain-list">
            {offers.map((o) => {
              const salaryDraft = salaries[o.playerId] ?? '';
              const yearsDraft = years[o.playerId] ?? String(o.demand.years);
              const offeredSalary =
                salaryDraft.trim() === ''
                  ? o.demand.salary
                  : Math.round(Number(salaryDraft) * 1_000);
              const offeredYears = Number(yearsDraft);
              const validOffer =
                Number.isFinite(offeredSalary) &&
                offeredSalary > 0 &&
                Number.isFinite(offeredYears) &&
                offeredYears >= 1;
              return (
                <li key={o.playerId} className="renewal-row">
                  <div className="renewal-head">
                    <span className="retain-name">{o.playerName}</span>
                    <span className="hint">
                      {o.posicion} · media {o.media}
                      {o.age !== null ? ` · ${o.age} años` : ''}
                    </span>
                  </div>
                  <p className="hint">
                    Ficha actual {formatEuros(o.currentSalary)}/año. Pide{' '}
                    <strong>{formatEuros(o.demand.salary)}/año</strong> por {o.demand.years}{' '}
                    {o.demand.years === 1 ? 'temporada' : 'temporadas'}.
                  </p>
                  <div className="renewal-actions">
                    <RetroButton variant="primary" onClick={() => accept(o.playerId)}>
                      Aceptar
                    </RetroButton>
                    <input
                      className="offer-input"
                      type="number"
                      min={0}
                      step={25}
                      placeholder={String(Math.round(o.demand.salary / 1_000))}
                      value={salaryDraft}
                      onChange={(e) =>
                        setSalaries((s) => ({ ...s, [o.playerId]: e.target.value }))
                      }
                      aria-label={`Ficha ofertada a ${o.playerName} en miles de euros`}
                    />
                    <span className="hint">k€/año</span>
                    <input
                      className="offer-input"
                      type="number"
                      min={1}
                      max={5}
                      step={1}
                      value={yearsDraft}
                      onChange={(e) => setYears((s) => ({ ...s, [o.playerId]: e.target.value }))}
                      aria-label={`Años ofertados a ${o.playerName}`}
                    />
                    <span className="hint">años</span>
                    <RetroButton
                      disabled={!validOffer}
                      onClick={() => offer(o.playerId, offeredSalary, offeredYears)}
                    >
                      Ofertar
                    </RetroButton>
                    <RetroButton onClick={() => letGo(o.playerId)}>Dejar libre</RetroButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="hint">No queda ninguna renovación pendiente.</p>
      )}

      {resolved.length > 0 ? (
        <ul className="renewal-resolved">
          {resolved.map((r) => (
            <li key={r.playerId} className="hint">
              {r.outcome === 'renewed'
                ? `✅ ${r.playerName} renueva — ${formatEuros(r.salary ?? 0)}/año · ${r.years} ${
                    r.years === 1 ? 'temporada' : 'temporadas'
                  }.`
                : `👋 ${r.playerName} se marchará libre a final de temporada.`}
            </li>
          ))}
        </ul>
      ) : null}
    </RetroPanel>
  );
}
