import { useMemo } from 'react';
import { careerTeamName, hemerotecaEventIcon, type HemerotecaEvent } from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { GestHeader } from '@ui/components/GestHeader';

/** The headlines of one season, kept in the order they were archived. */
interface SeasonPage {
  seasonNumber: number;
  temporada: string;
  events: HemerotecaEvent[];
}

/**
 * Group the flat hemeroteca into one page per season, newest season first (a real
 * hemeroteca reads from the latest news backwards). Within a season the archived
 * order is preserved, so the most important hito of the year leads its page.
 */
function paginate(hemeroteca: readonly HemerotecaEvent[]): SeasonPage[] {
  const bySeason = new Map<number, SeasonPage>();
  for (const event of hemeroteca) {
    let page = bySeason.get(event.seasonNumber);
    if (!page) {
      page = { seasonNumber: event.seasonNumber, temporada: event.temporada, events: [] };
      bySeason.set(event.seasonNumber, page);
    }
    page.events.push(event);
  }
  return [...bySeason.values()].sort((a, b) => b.seasonNumber - a.seasonNumber);
}

/**
 * Hemeroteca de carrera: the club's press archive. Every milestone of the career
 * — titles, ascensos/descensos, tus Pichichi/Zamora, retiradas de cracks,
 * fichajes récord y el veredicto de la directiva — shown as newspaper headlines,
 * grouped by season with the most recent on top.
 */
export function HemerotecaScreen() {
  const career = useGameStore((s) => s.career);
  const goTo = useGameStore((s) => s.goTo);

  const pages = useMemo(() => (career ? paginate(career.hemeroteca ?? []) : []), [career]);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const clubName = careerTeamName(career, career.humanTeamId);
  const total = career.hemeroteca?.length ?? 0;

  return (
    <main className="screen">
      <GestHeader
        crestTeamId={career.humanTeamId}
        title="Hemeroteca"
        subtitle={clubName}
        chips={[{ label: 'Titulares', value: `${total}`, tone: total > 0 ? 'good' : undefined }]}
      />

      {total === 0 ? (
        <p className="hint">
          Todavía no hay titulares. Gana títulos, asciende, ficha estrellas o vive un
          cese: la hemeroteca irá recogiendo los grandes hitos de tu carrera.
        </p>
      ) : (
        pages.map((page) => (
          <RetroPanel key={page.seasonNumber} title={`Temporada ${page.temporada}`}>
            <ul className="hemeroteca">
              {page.events.map((event, i) => (
                <li key={`${page.seasonNumber}-${i}`} className={`hemeroteca-line hemeroteca-line--${event.type}`}>
                  <span className="hemeroteca-icon" aria-hidden="true">
                    {hemerotecaEventIcon(event.type)}
                  </span>
                  <span className="hemeroteca-text">{event.text}</span>
                </li>
              ))}
            </ul>
          </RetroPanel>
        ))
      )}

      <div className="season-actions">
        <RetroButton onClick={() => goTo('season')}>Volver a la liga</RetroButton>
      </div>
    </main>
  );
}
