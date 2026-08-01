import type { ObjectiveType, Satisfaction } from '@game';

/** Spanish label for each board objective type (shown as the season's mission). */
const OBJECTIVE_LABEL: Record<ObjectiveType, string> = {
  title: 'Ganar la liga',
  europe: 'Clasificarse para Europa',
  promotion: 'Ascender a Primera',
  'mid-table': 'Terminar en mitad de tabla',
  'avoid-relegation': 'Conservar la categoría',
};

/** Spanish sentence for how the board feels about a finished season. */
const SATISFACTION_LABEL: Record<Satisfaction, string> = {
  contento: 'La directiva está contenta.',
  normal: 'La directiva lo considera aceptable.',
  enfadado: 'La directiva está enfadada.',
};

/** Emoji cue for a satisfaction level (retro mood indicator). */
const SATISFACTION_ICON: Record<Satisfaction, string> = {
  contento: '😀',
  normal: '😐',
  enfadado: '😠',
};

export function objectiveLabel(type: ObjectiveType): string {
  return OBJECTIVE_LABEL[type];
}

export function satisfactionLabel(s: Satisfaction): string {
  return SATISFACTION_LABEL[s];
}

export function satisfactionIcon(s: Satisfaction): string {
  return SATISFACTION_ICON[s];
}
