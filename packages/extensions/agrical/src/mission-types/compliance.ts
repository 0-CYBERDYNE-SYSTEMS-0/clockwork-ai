/**
 * Compliance Deadline Mission Type
 * Models regulatory compliance deadlines tied to growing seasons
 */

import type { Event, ValidationResult } from '@clockwork-ai/core';

export const COMPLIANCE_X_PROPS = {
  COMPLIANCE_TYPE: 'X-CLOCKWORK-AGRICAL-COMPLIANCE-TYPE',
  JURISDICTION: 'X-CLOCKWORK-AGRICAL-JURISDICTION',
  FILING_DEADLINE: 'X-CLOCKWORK-AGRICAL-FILING-DEADLINE',
  PENALTY: 'X-CLOCKWORK-AGRICAL-PENALTY',
  FIELD: 'X-CLOCKWORK-AGRICAL-FIELD',
} as const;

export type ComplianceType = 'reporting' | 'certification' | 'inspection' | 'permit' | 'other';
export type Jurisdiction = 'federal' | 'state' | 'county' | 'municipal';

export const VALID_COMPLIANCE_TYPES: Set<ComplianceType> = new Set([
  'reporting', 'certification', 'inspection', 'permit', 'other',
]);

export const VALID_JURISDICTIONS: Set<Jurisdiction> = new Set([
  'federal', 'state', 'county', 'municipal',
]);

export interface ComplianceMissionData {
  complianceType: ComplianceType;
  jurisdiction: Jurisdiction;
  filingDeadline: string; // ISO date
  penalty?: string; // description of penalty
  field?: string;
}

/**
 * Validate a compliance deadline mission event
 */
export function validateComplianceMission(event: Event): ValidationResult {
  const errors: { field: string; message: string; code: string }[] = [];

  const compType = event.xProperties.get(COMPLIANCE_X_PROPS.COMPLIANCE_TYPE);
  const jurisdiction = event.xProperties.get(COMPLIANCE_X_PROPS.JURISDICTION);
  const deadline = event.xProperties.get(COMPLIANCE_X_PROPS.FILING_DEADLINE);

  if (!compType) {
    errors.push({ field: COMPLIANCE_X_PROPS.COMPLIANCE_TYPE, message: 'Compliance type is required', code: 'MISSING_COMPLIANCE_TYPE' });
  } else if (!VALID_COMPLIANCE_TYPES.has(compType as ComplianceType)) {
    errors.push({
      field: COMPLIANCE_X_PROPS.COMPLIANCE_TYPE,
      message: `Invalid compliance type: ${compType}`,
      code: 'INVALID_COMPLIANCE_TYPE',
    });
  }

  if (!jurisdiction) {
    errors.push({ field: COMPLIANCE_X_PROPS.JURISDICTION, message: 'Jurisdiction is required', code: 'MISSING_JURISDICTION' });
  } else if (!VALID_JURISDICTIONS.has(jurisdiction as Jurisdiction)) {
    errors.push({
      field: COMPLIANCE_X_PROPS.JURISDICTION,
      message: `Invalid jurisdiction: ${jurisdiction}`,
      code: 'INVALID_JURISDICTION',
    });
  }

  if (!deadline) {
    errors.push({ field: COMPLIANCE_X_PROPS.FILING_DEADLINE, message: 'Filing deadline is required', code: 'MISSING_DEADLINE' });
  } else {
    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      errors.push({
        field: COMPLIANCE_X_PROPS.FILING_DEADLINE,
        message: `Invalid deadline date: ${deadline}`,
        code: 'INVALID_DEADLINE',
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Build X-properties for a compliance mission event
 */
export function buildComplianceXProps(data: ComplianceMissionData): Map<string, string> {
  const xProps = new Map<string, string>();
  xProps.set(COMPLIANCE_X_PROPS.COMPLIANCE_TYPE, data.complianceType);
  xProps.set(COMPLIANCE_X_PROPS.JURISDICTION, data.jurisdiction);
  xProps.set(COMPLIANCE_X_PROPS.FILING_DEADLINE, data.filingDeadline);
  if (data.penalty) xProps.set(COMPLIANCE_X_PROPS.PENALTY, data.penalty);
  if (data.field) xProps.set(COMPLIANCE_X_PROPS.FIELD, data.field);
  return xProps;
}
