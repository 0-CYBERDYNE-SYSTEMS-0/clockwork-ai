/**
 * Clockwork Core Type Definitions
 * RFC 5545 compliant ICS types
 */

export interface DateWithTz {
  date: Date;
  timezone: string; // IANA timezone e.g. "America/Chicago"
  isAllDay: boolean;
}

export type RRuleFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type DayCode = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export interface DayMask {
  day: DayCode;
  position?: number; // For 1MO (first Monday), -1FR (last Friday)
}

export interface RRule {
  freq: RRuleFreq;
  interval: number; // Default 1
  until?: Date;
  count?: number;
  byDay?: DayMask[];
  byMonthDay?: number[]; // 1-31, -1 to -31
  byMonth?: number[]; // 1-12
}

export interface Event {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: DateWithTz;
  end: DateWithTz;
  duration: number; // minutes
  rrule?: RRule;
  exdates?: Date[];
  rdates?: Date[];
  categories: string[];
  xProperties: Map<string, string>; // Extension properties
  created: Date;
  modified: Date;
  sequence?: number;
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
}

export interface VTimezone {
  tzid: string;
  standard?: TZComponent;
  daylight?: TZComponent;
}

export interface TZComponent {
  tzoffsetFrom: string;
  tzoffsetTo: string;
  tzname: string;
  dtstart: string; // e.g. "19701025T020000"
  rrule?: string; // RRULE for recurring transitions
  comment?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface Conflict {
  eventA: Event;
  eventB: Event;
  overlapStart: Date;
  overlapEnd: Date;
  severity: 'critical' | 'warning';
  resource?: string;
  resolutionOptions: ResolutionOption[];
}

export interface ResolutionOption {
  type: 'reschedule' | 'override' | 'merge';
  description: string;
  newTime?: { start: Date; end: Date };
  requiresReason: boolean;
}

export interface TimeWindow {
  start: Date;
  end: Date;
  durationMinutes: number;
  score?: number;
}

export type FilterFn = (events: Event[]) => Event[];

export type Operation =
  | { type: 'create'; event: Event }
  | { type: 'update'; uid: string; patch: Partial<Event> }
  | { type: 'delete'; uid: string };

export interface TransactionLog {
  id: string;
  seq: number;
  operations: Operation[];
  status: 'pending' | 'committed' | 'rolled_back';
  createdAt: Date;
  expiresAt: Date;
  agentId: string;
}

export interface DryRunResult {
  transactionId: string;
  preview: Operation[];
  conflicts: Conflict[];
  canCommit: boolean;
}

export interface AgentScope {
  agentId: string;
  readPaths: string[]; // Glob patterns
  writePaths: string[];
  maxEventsPerWrite: number;
}

export interface CalendarFile {
  filename: string;
  events: Event[];
  timezones: VTimezone[];
  productId?: string;
}

export interface MissionType {
  type: string;
  name: string;
  description: string;
  requiredFields: string[];
  optionalFields: string[];
  validator: (event: Event) => ValidationResult;
}

export interface Extension {
  name: string;
  version: string;
  missionTypes: MissionType[];
  register(registry: MissionRegistry): void;
}

export class MissionRegistry {
  private missionTypes = new Map<string, MissionType>();

  register(extension: Extension): void {
    extension.register(this);
  }

  getMissionType(type: string): MissionType | undefined {
    return this.missionTypes.get(type);
  }

  getAllMissionTypes(): MissionType[] {
    return Array.from(this.missionTypes.values());
  }

  validate(event: Event): ValidationResult {
    const category = event.categories[0];
    if (!category) {
      return { valid: true, errors: [] };
    }
    const missionType = this.missionTypes.get(category);
    if (!missionType) {
      return { valid: true, errors: [] };
    }
    return missionType.validator(event);
  }

  registerMissionType(missionType: MissionType): void {
    this.missionTypes.set(missionType.type, missionType);
  }
}
