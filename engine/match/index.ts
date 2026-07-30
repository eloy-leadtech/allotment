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
  FORMATIONS,
  FORMATION_LIST,
  DEFAULT_FORMATION,
  formationMods,
  type FormationMods,
} from './formation';
export { MATCH_CONFIG } from './config';
