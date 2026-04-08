/**
 * Planting Window Mission Type
 * Models crop planting operations as first-class ICS events with structured X-properties
 */

import type { Event, ValidationResult } from '@clockwork-ai/core';

export const PLANTING_X_PROPS = {
  CROP: 'X-CLOCKWORK-AGRICAL-CROP',
  VARIETY: 'X-CLOCKWORK-AGRICAL-VARIETY',
  FIELD: 'X-CLOCKWORK-AGRICAL-FIELD',
  WINDOW_START: 'X-CLOCKWORK-AGRICAL-WINDOW-START',
  WINDOW_END: 'X-CLOCKWORK-AGRICAL-WINDOW-END',
  LINKED_SCOUT: 'X-CLOCKWORK-AGRICAL-LINKED-SCOUT',
} as const;

export interface PlantingMissionData {
  crop: string;
  variety: string;
  field: string;
  windowStart: string; // ISO date
  windowEnd: string; // ISO date
  linkedScout?: string; // "N days after" or UID reference
}

/**
 * Known crop types for validation
 */
export const KNOWN_CROPS = new Set([
  'corn', 'soybeans', 'wheat', 'cotton', 'rice', 'sorghum',
  'barley', 'oats', 'rye', 'sunflower', 'canola', 'alfalfa',
  'cotton', 'peanuts', 'potatoes', 'tomatoes', 'lettuce', 'onions',
]);

/**
 * Validate a planting mission event
 */
export function validatePlantingMission(event: Event): ValidationResult {
  const errors: { field: string; message: string; code: string }[] = [];

  const crop = event.xProperties.get(PLANTING_X_PROPS.CROP);
  const variety = event.xProperties.get(PLANTING_X_PROPS.VARIETY);
  const field = event.xProperties.get(PLANTING_X_PROPS.FIELD);
  const windowStart = event.xProperties.get(PLANTING_X_PROPS.WINDOW_START);
  const windowEnd = event.xProperties.get(PLANTING_X_PROPS.WINDOW_END);

  // Required fields
  if (!crop) {
    errors.push({ field: 'X-CLOCKWORK-AGRICAL-CROP', message: 'Crop type is required', code: 'MISSING_CROP' });
  } else if (!KNOWN_CROPS.has(crop.toLowerCase())) {
    // Warning only — allow unknown crops for extensibility
    errors.push({ field: 'X-CLOCKWORK-AGRICAL-CROP', message: `Unknown crop type: ${crop}`, code: 'UNKNOWN_CROP' });
  }

  if (!variety) {
    errors.push({ field: 'X-CLOCKWORK-AGRICAL-VARIETY', message: 'Variety is required', code: 'MISSING_VARIETY' });
  }

  if (!field) {
    errors.push({ field: 'X-CLOCKWORK-AGRICAL-FIELD', message: 'Field ID is required', code: 'MISSING_FIELD' });
  }

  if (!windowStart) {
    errors.push({ field: 'X-CLOCKWORK-AGRICAL-WINDOW-START', message: 'Window start date is required', code: 'MISSING_WINDOW_START' });
  }

  if (!windowEnd) {
    errors.push({ field: 'X-CLOCKWORK-AGRICAL-WINDOW-END', message: 'Window end date is required', code: 'MISSING_WINDOW_END' });
  }

  // Date logic validation
  if (windowStart && windowEnd) {
    const start = new Date(windowStart);
    const end = new Date(windowEnd);
    if (start >= end) {
      errors.push({ field: 'X-CLOCKWORK-AGRICAL-WINDOW-END', message: 'Window end must be after window start', code: 'INVALID_WINDOW' });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Build X-properties for a planting mission event
 */
export function buildPlantingXProps(data: PlantingMissionData): Map<string, string> {
  const xProps = new Map<string, string>();
  xProps.set(PLANTING_X_PROPS.CROP, data.crop);
  xProps.set(PLANTING_X_PROPS.VARIETY, data.variety);
  xProps.set(PLANTING_X_PROPS.FIELD, data.field);
  xProps.set(PLANTING_X_PROPS.WINDOW_START, data.windowStart);
  xProps.set(PLANTING_X_PROPS.WINDOW_END, data.windowEnd);
  if (data.linkedScout) {
    xProps.set(PLANTING_X_PROPS.LINKED_SCOUT, data.linkedScout);
  }
  return xProps;
}
