import { useMemo } from 'react';
import {
  careerTeamName,
  palmaresCompetitionLabel,
  palmaresCompetitionIcon,
  type PalmaresTitle,
} from '@game';
import { useGameStore } from '@ui/store/gameStore';
import { RetroButton } from '@ui/components/RetroButton';
import { RetroPanel } from '@ui/components/RetroPanel';
import { GestHeader } from '@ui/components/GestHeader';

/** Stable display order of the competitions in the palmarés. */
const COMPETITION_ORDER: readonly PalmaresTitle['competition'][] = [
  'liga',
  'copa',
  'champions',
  'uefa',
];

/** A group of titles sharing the same label (e.g. all Primera league titles). */
interface TitleGroup {
  label: string;
  icon: string;
  temporadas: string[];
}

/**
 * Group the flat palmarés into one line per distinct competition-title, keeping a
 * deterministic competition order and, within it, the order titles were won.
 * Primera and Segunda league titles are separate groups (different labels).
 */
function groupTitles(palmares: readonly PalmaresTitle[]): TitleGroup[] {
  const byLabel = new Map<string, TitleGroup>();
  const order: string[] = [];
  const rank = (t: PalmaresTitle): number => COMPETITION_ORDER.indexOf(t.competition);
  const sorted = [...palmares].sort(
    (a, b) => rank(a) - rank(b) || a.seasonNumber - b.seasonNumber,
  );
  for (const title of sorted) {
    const label = palmaresCompetitionLabel(title.competition, title.division);
    let group = byLabel.get(label);
    if (!group) {
      group = { label, icon: palmaresCompetitionIcon(title.competition), temporadas: [] };
      byLabel.set(label, group);
      order.push(label);
    }
    group.temporadas.push(title.temporada);
  }
  return order.map((label) => byLabel.get(label)!);
}

export function PalmaresScreen() {
  const career = useGameStore((s) => s.career);
  const goTo = useGameStore((s) => s.goTo);

  const groups = useMemo(() => (career ? groupTitles(career.palmares) : []), [career]);

  if (!career) {
    return (
      <main className="screen">
        <p>No hay carrera en curso.</p>
        <RetroButton onClick={() => goTo('title')}>Menú</RetroButton>
      </main>
    );
  }

  const clubName = careerTeamName(career, career.humanTeamId);
  const total = career.palmares.length;

  return (
    <main className="screen">
      <GestHeader
        crestTeamId={career.humanTeamId}
        title="Palmarés"
        subtitle={clubName}
        chips={[{ label: 'Títulos', value: `${total}`, tone: total > 0 ? 'good' : undefined }]}
      />

      {total === 0 ? (
        <p className="hint">
          Todavía no has ganado ningún título. Gana tu Liga, la Copa del Rey o una
          competición europea para estrenar el palmarés.
        </p>
      ) : (
        groups.map((group) => (
          <RetroPanel key={group.label} title={group.label}>
            <p className="palmares-count">
              {group.icon} {group.temporadas.length}
            </p>
            <ul className="palmares palmares--chips">
              {group.temporadas.map((temporada, i) => (
                <li key={`${temporada}-${i}`}>{temporada}</li>
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
