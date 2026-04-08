/**
 * Chemical Application Mission Type
 * Models chemical (herbicide, insecticide, fungicide, fertilizer) application operations
 */

import type { Event, ValidationResult } from '@clockwork-ai/core';

export const CHEMICAL_X_PROPS = {
  CHEMICAL_TYPE: 'X-CLOCKWORK-AGRICAL-CHEMICAL-TYPE',
  TARGET: 'X-CLOCKWORK-AGRICAL-TARGET',
  PRE_HARVEST_INTERVAL: 'X-CLOCKWORK-AGRICAL-PRE-HARVEST-INTERVAL',
  TEMPERATURE_MIN: 'X-CLOCKWORK-AGRICAL-TEMPERATURE-MIN',
  TEMPERATURE_MAX: 'X-CLOCKWORK-AGRICAL-TEMPERATURE-MAX',
  RESTRICTED_USE: 'X-CLOCKWORK-AGRICAL-RESTRICTED-USE',
  FIELD: 'X-CLOCKWORK-AGRICAL-FIELD',
} as const;

export type ChemicalType = 'herbicide' | 'insecticide' | 'fungicide' | 'fertilizer' | 'other';

export interface ChemicalMissionData {
  chemicalType: ChemicalType;
  target: string; // target pest/weed/disease
  preHarvestInterval?: number; // days
  temperatureMin?: number; // celsius
  temperatureMax?: number; // celsius
  restrictedUse?: boolean;
  field: string;
}

/**
 * Valid chemical types
 */
export const VALID_CHEMICAL_TYPES: Set<ChemicalType> = new Set([
  'herbicide', 'insecticide', 'fungicide', 'fertilizer', 'other',
]);

/**
 * Validate a chemical application mission event
 */
export function validateChemicalMission(event: Event): ValidationResult {
  const errors: { field: string; message: string; code: string }[] = [];

  const chemicalType = event.xProperties.get(CHEMICAL_X_PROPS.CHEMICAL_TYPE);
  const target = event.xProperties.get(CHEMICAL_X_PROPS.TARGET);
  const field = event.xProperties.get(CHEMICAL_X_PROPS.FIELD);
  const preHarvest = event.xProperties.get(CHEMICAL_X_PROPS.PRE_HARVEST_INTERVAL);
  const tempMin = event.xProperties.get(CHEMICAL_X_PROPS.TEMPERATURE_MIN);
  const tempMax = event.xProperties.get(CHEMICAL_X_PROPS.TEMPERATURE_MAX);

  if (!chemicalType) {
    errors.push({ field: CHEMICAL_X_PROPS.CHEMICAL_TYPE, message: 'Chemical type is required', code: 'MISSING_CHEMICAL_TYPE' });
  } else if (!VALID_CHEMICAL_TYPES.has(chemicalType as ChemicalType)) {
    errors.push({
      field: CHEMICAL_X_PROPS.CHEMICAL_TYPE,
      message: `Invalid chemical type: ${chemicalType}`,
      code: 'INVALID_CHEMICAL_TYPE',
    });
  }

  if (!target) {
    errors.push({ field: CHEMICAL_X_PROPS.TARGET, message: 'Target pest/weed/disease is required', code: 'MISSING_TARGET' });
  }

  if (!field) {
    errors.push({ field: CHEMICAL_X_PROPS.FIELD, message: 'Field ID is required', code: 'MISSING_FIELD' });
  }

  // Temperature range validation
  if (tempMin && tempMax) {
    const min = parseFloat(tempMin);
    const max = parseFloat(tempMax);
    if (min > max) {
      errors.push({
        field: CHEMICAL_X_PROPS.TEMPERATURE_MAX,
        message: `Temperature max (${max}°C) must be >= temperature min (${min}°C)`,
        code: 'INVALID_TEMP_RANGE',
      });
    }
  }

  // Pre-harvest interval must be positive
  if (preHarvest) {
    const days = parseInt(preHarvest, 10);
    if (isNaN(days) || days < 0) {
      errors.push({
        field: CHEMICAL_X_PROPS.PRE_HARVEST_INTERVAL,
        message: `Pre-harvest interval must be a positive number of days, got: ${preHarvest}`,
        code: 'INVALID_PRE_HARVEST',
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Build X-properties for a chemical mission event
 */
export function buildChemicalXProps(data: ChemicalMissionData): Map<string, string> {
  const xProps = new Map<string, string>();
  xProps.set(CHEMICAL_X_PROPS.CHEMICAL_TYPE, data.chemicalType);
  xProps.set(CHEMICAL_X_PROPS.TARGET, data.target);
  xProps.set(CHEMICAL_X_PROPS.FIELD, data.field);
  if (data.preHarvestInterval !== undefined) xProps.set(CHEMICAL_X_PROPS.PRE_HARVEST_INTERVAL, String(data.preHarvestInterval));
  if (data.temperatureMin !== undefined) xProps.set(CHEMICAL_X_PROPS.TEMPERATURE_MIN, String(data.temperatureMin));
  if (data.temperatureMax !== undefined) xProps.set(CHEMICAL_X_PROPS.TEMPERATURE_MAX, String(data.temperatureMax));
  if (data.restrictedUse !== undefined) xProps.set(CHEMICAL_X_PROPS.RESTRICTED_USE, data.restrictedUse ? 'yes' : 'no');
  return xProps;
}
