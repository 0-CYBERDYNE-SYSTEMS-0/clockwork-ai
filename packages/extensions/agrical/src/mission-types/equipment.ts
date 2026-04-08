/**
 * Equipment Maintenance Mission Type
 * Models equipment maintenance operations tied to crop cycle phases
 */

import type { Event, ValidationResult } from '@clockwork-ai/core';

export const EQUIPMENT_X_PROPS = {
  EQUIPMENT_ID: 'X-CLOCKWORK-AGRICAL-EQUIPMENT-ID',
  MAINTENANCE_TYPE: 'X-CLOCKWORK-AGRICAL-MAINTENANCE-TYPE',
  LINKED_PHASE: 'X-CLOCKWORK-AGRICAL-LINKED-PHASE',
} as const;

export type MaintenanceType = 'oil_change' | 'repair' | 'inspection' | 'calibration' | 'cleaning' | 'other';

export const VALID_MAINTENANCE_TYPES: Set<MaintenanceType> = new Set([
  'oil_change', 'repair', 'inspection', 'calibration', 'cleaning', 'other',
]);

export interface EquipmentMissionData {
  equipmentId: string;
  maintenanceType: MaintenanceType;
  linkedPhase?: string; // crop cycle phase
}

/**
 * Validate an equipment maintenance mission event
 */
export function validateEquipmentMission(event: Event): ValidationResult {
  const errors: { field: string; message: string; code: string }[] = [];

  const equipmentId = event.xProperties.get(EQUIPMENT_X_PROPS.EQUIPMENT_ID);
  const maintType = event.xProperties.get(EQUIPMENT_X_PROPS.MAINTENANCE_TYPE);

  if (!equipmentId) {
    errors.push({ field: EQUIPMENT_X_PROPS.EQUIPMENT_ID, message: 'Equipment ID is required', code: 'MISSING_EQUIPMENT_ID' });
  }

  if (!maintType) {
    errors.push({ field: EQUIPMENT_X_PROPS.MAINTENANCE_TYPE, message: 'Maintenance type is required', code: 'MISSING_MAINT_TYPE' });
  } else if (!VALID_MAINTENANCE_TYPES.has(maintType as MaintenanceType)) {
    errors.push({
      field: EQUIPMENT_X_PROPS.MAINTENANCE_TYPE,
      message: `Invalid maintenance type: ${maintType}. Valid: ${[...VALID_MAINTENANCE_TYPES].join(', ')}`,
      code: 'INVALID_MAINT_TYPE',
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Build X-properties for an equipment mission event
 */
export function buildEquipmentXProps(data: EquipmentMissionData): Map<string, string> {
  const xProps = new Map<string, string>();
  xProps.set(EQUIPMENT_X_PROPS.EQUIPMENT_ID, data.equipmentId);
  xProps.set(EQUIPMENT_X_PROPS.MAINTENANCE_TYPE, data.maintenanceType);
  if (data.linkedPhase) xProps.set(EQUIPMENT_X_PROPS.LINKED_PHASE, data.linkedPhase);
  return xProps;
}
