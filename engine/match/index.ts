export type {
  Line,
  EventType,
  MatchPlayer,
  MatchTeam,
  MatchInput,
  MatchEvent,
  MatchResult,
  Formation,
  Tactics,
} from './types';
export { simulateMatch } from './simulateMatch';
export { selectStartingXI } from './lineup';
export { computeStrength, type TeamStrength } from './strength';
export {
  NEUTRAL_FORM,
  NEUTRAL_MORALE,
  SCORE_MIN,
  SCORE_MAX,
  clampScore,
  playerForm,
  playerMorale,
  performanceMultiplier,
  outcomeOf,
  nextForm,
  nextMorale,
  updateTeamFormMorale,
  scoreTier,
  squadMorale,
  type MatchOutcome,
  type PlayerMatchContext,
} from './morale';
export {
  FORMATIONS,
  FORMATION_LIST,
  DEFAULT_FORMATION,
  formationMods,
  type FormationMods,
} from './formation';
export { MATCH_CONFIG } from './config';
