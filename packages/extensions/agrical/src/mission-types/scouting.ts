/**
 * Scouting Mission Mission Type
 * Models agricultural scouting/inspection operations
 */

import type { Event, ValidationResult } from '@clockwork-ai/core';

export const SCOUTING_X_PROPS = {
  LINKED_EVENT: 'X-CLOCKWORK-AGRICAL-LINKED-EVENT',
  OBSERVATION_TYPE: 'X-CLOCKWORK-AGRICAL-OBSERVATION-TYPE',
  FIELD: 'X-CLOCKWORK-AGRICAL-FIELD',
  LINKED_SCOUT_OFFSET: 'X-CLOCKWORK-AGRICAL-LINKED-SCOUT-OFFSET',
} as const;

export type ObservationType = 'weed_pressure' | 'pest' | 'disease' | 'growth_stage' | 'soil_moisture' | 'general';

export interface ScoutingMissionData {
  linkedEvent?: string; // UID of linked planting event
  linkedScoutOffset?: string; // "N days after" reference
  observationType: ObservationType;
  field: string;
}

/**
 * Valid observation types
 */
export const VALID_OBSERVATION_TYPES: Set<ObservationType> = new Set([
  'weed_pressure', 'pest', 'disease', 'growth_stage', 'soil_moisture', 'general',
]);

/**
 * Validate a scouting mission event
 */
export function validateScoutingMission(event: Event): ValidationResult {
  const errors: { field: string; message: string; code: string }[] = [];

  const field = event.xProperties.get(SCOUTING_X_PROPS.FIELD);
  const obsType = event.xProperties.get(SCOUTING_X_PROPS.OBSERVATION_TYPE);
  const linkedEvent = event.xProperties.get(SCOUTING_X_PROPS.LINKED_EVENT);
  const offset = event.xProperties.get(SCOUTING_X_PROPS.LINKED_SCOUT_OFFSET);

  if (!field) {
    errors.push({ field: SCOUTING_X_PROPS.FIELD, message: 'Field ID is required', code: 'MISSING_FIELD' });
  }

  if (!obsType) {
    errors.push({ field: SCOUTING_X_PROPS.OBSERVATION_TYPE, message: 'Observation type is required', code: 'MISSING_OBS_TYPE' });
  } else if (!VALID_OBSERVATION_TYPES.has(obsType as ObservationType)) {
    errors.push({
      field: SCOUTING_X_PROPS.OBSERVATION_TYPE,
      message: `Invalid observation type: ${obsType}. Valid: ${[...VALID_OBSERVATION_TYPES].join(', ')}`,
      code: 'INVALID_OBS_TYPE',
    });
  }

  // Linked event or offset should be present
  if (!linkedEvent && !offset) {
    errors.push({
      field: SCOUTING_X_PROPS.LINKED_EVENT,
      message: 'Either linked event UID or scout offset (e.g. "14 days after") is required',
      code: 'MISSING_LINK',
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Build X-properties for a scouting mission event
 */
export function buildScoutingXProps(data: ScoutingMissionData): Map<string, string> {
  const xProps = new Map<string, string>();
  xProps.set(SCOUTING_X_PROPS.OBSERVATION_TYPE, data.observationType);
  xProps.set(SCOUTING_X_PROPS.FIELD, data.field);
  if (data.linkedEvent) xProps.set(SCOUTING_X_PROPS.LINKED_EVENT, data.linkedEvent);
  if (data.linkedScoutOffset) xProps.set(SCOUTING_X_PROPS.LINKED_SCOUT_OFFSET, data.linkedScoutOffset);
  return xProps;
}
