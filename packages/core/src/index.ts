/**
 * Clockwork Core — ICS-Native Reasoning Layer for AI Agents
 */

// Parser
export { ICSParser } from './parser/ics-parser.js';
export { ICSSerializer } from './parser/ics-serializer.js';
export { ICSTokenizer } from './parser/ics-tokenizer.js';

// RRULE
export { RRuleParser } from './rrule/rrule-parser.js';
export { RRuleExpander } from './rrule/rrule-expander.js';

// Validator
export { RRuleValidator } from './validator/rrule-validator.js';

// Timezone
export { TimezoneHandler } from './timezone/timezone.js';

// Conflicts
export { ConflictDetector } from './conflicts/conflicts.js';

// Query
export {
  after,
  before,
  overlaps,
  hasTag,
  inDateRange,
  durationGte,
  durationLte,
  withUid,
  composeFilters,
  applyQuery,
  isFreeAt,
  findAvailableWindows,
} from './query/query.js';

// Transaction
export { TransactionManager } from './transaction/transaction.js';

// Scope
export { ScopeLimiter } from './scope/scope.js';

// Mission Registry
export { MissionRegistry } from './types.js';

// Types (re-exported for convenience)
export type {
  Event,
  DateWithTz,
  RRule,
  DayMask,
  DayCode,
  RRuleFreq,
  VTimezone,
  CalendarFile,
  ValidationResult,
  ValidationError,
  Conflict,
  ResolutionOption,
  TimeWindow,
  FilterFn,
  Operation,
  TransactionLog,
  DryRunResult,
  AgentScope,
  MissionType,
  Extension,
} from './types.js';
