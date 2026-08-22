import {
  formatEuros,
  sponsorOffers,
  activeSponsorOffer,
  qualifiesForEurope,
} from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { GestHeader } from '@ui/components/GestHeader';

/**
 * Patrocinios: shows the season's sponsor OFFERS and lets the manager sign one.
 * Each offer pays a guaranteed annual cheque; some add a bonus only if the club
 * reaches Europe. Picking one is a decision — the money lands at season end and
 * shows up in the market screen's income breakdown (a classic PC Fútbol call).
 */
export function SponsorsScreen() {
  const career = useGameStore((s) => s.career);
  const chooseSponsor = useGameStore((s) => s.chooseSponsor);
  const goTo = useGameStore((s) => s.goTo);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const offers = sponsorOffers(career);
  const active = activeSponsorOffer(career);
  const onCourseForEurope = qualifiesForEurope(career);

  return (
    <main className="screen">
      <GestHeader
        icon="🤝"
        title="Patrocinio"
        subtitle={`Temporada ${career.temporada}`}
        chips={[
          { label: 'Patrocinador', value: active.name },
          { label: 'Presupuesto', value: formatEuros(career.budget) },
        ]}
      />

      <RetroPanel title="Patrocinador actual">
        <p className="board-objective">
          🤝 {active.name}{' '}
          <span className="hint">{formatEuros(active.annual)}/año</span>
        </p>
        {active.hasCondition ? (
          <p className="hint">
            Extra por clasificar a Europa: {formatEuros(active.europeBonus)}.{' '}
            {onCourseForEurope
              ? 'Ahora mismo estás en puesto europeo: cobrarías el extra.'
              : 'De momento no estás en puesto europeo.'}
          </p>
        ) : (
          <p className="hint">Sin condiciones: cobras la cifra fija cada temporada.</p>
        )}
      </RetroPanel>

      <RetroPanel title="Ofertas de patrocinio">
        <p className="hint">
          Elige un patrocinador principal. El ingreso se suma a tu presupuesto al final de
          la temporada. Puedes cambiar de oferta cada temporada.
        </p>
        <ul className="market-list">
          {offers.map((offer) => {
            const on = offer.id === active.id;
            return (
              <li key={offer.id} className={`market-row market-negotiate${on ? ' market-row--active' : ''}`}>
                <span className="market-name">
                  {on ? '➡️ ' : ''}
                  {offer.name}
                </span>
                <span className="hint">
                  {offer.description} · Fija {formatEuros(offer.annual)}/año
                  {offer.hasCondition ? ` · +${formatEuros(offer.europeBonus)} si Europa` : ''}
                </span>
                <span className="market-offer">
                  <RetroButton
                    variant={on ? undefined : 'primary'}
                    disabled={on}
                    onClick={() => chooseSponsor(offer.id)}
                  >
                    {on ? 'Firmado ✓' : 'Firmar'}
                  </RetroButton>
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
