/**
 * Agrical Mission Types Tests
 */

import type { Event } from '@clockwork-ai/core';
import {
  validatePlantingMission,
  buildPlantingXProps,
  PLANTING_X_PROPS,
} from '@clockwork-ai/agrical';
import {
  validateScoutingMission,
  buildScoutingXProps,
  SCOUTING_X_PROPS,
} from '@clockwork-ai/agrical';
import {
  validateChemicalMission,
  buildChemicalXProps,
  CHEMICAL_X_PROPS,
} from '@clockwork-ai/agrical';
import {
  validateEquipmentMission,
  buildEquipmentXProps,
  EQUIPMENT_X_PROPS,
} from '@clockwork-ai/agrical';
import {
  validateComplianceMission,
  buildComplianceXProps,
  COMPLIANCE_X_PROPS,
} from '@clockwork-ai/agrical';

function makeEvent(xProps: Map<string, string> = new Map(), categories: string[] = ['planting']): Event {
  return {
    uid: 'test-evt',
    summary: 'Test Event',
    start: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false },
    end: { date: new Date('2026-04-15T18:00'), timezone: 'UTC', isAllDay: false },
    duration: 540,
    categories,
    xProperties: xProps,
    created: new Date(),
    modified: new Date(),
  };
}

describe('Planting Mission', () => {
  describe('validatePlantingMission()', () => {
    it('returns valid for complete planting mission', () => {
      const xProps = new Map<string, string>();
      xProps.set(PLANTING_X_PROPS.CROP, 'corn');
      xProps.set(PLANTING_X_PROPS.VARIETY, 'Pioneer P1197');
      xProps.set(PLANTING_X_PROPS.FIELD, 'north-40');
      xProps.set(PLANTING_X_PROPS.WINDOW_START, '2026-04-15');
      xProps.set(PLANTING_X_PROPS.WINDOW_END, '2026-04-22');

      const event = makeEvent(xProps, ['planting']);
      const result = validatePlantingMission(event);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error for missing crop', () => {
      const xProps = new Map<string, string>();
      xProps.set(PLANTING_X_PROPS.VARIETY, 'Pioneer P1197');
      xProps.set(PLANTING_X_PROPS.FIELD, 'north-40');
      xProps.set(PLANTING_X_PROPS.WINDOW_START, '2026-04-15');
      xProps.set(PLANTING_X_PROPS.WINDOW_END, '2026-04-22');

      const event = makeEvent(xProps);
      const result = validatePlantingMission(event);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_CROP')).toBe(true);
    });

    it('returns error for missing variety', () => {
      const xProps = new Map<string, string>();
      xProps.set(PLANTING_X_PROPS.CROP, 'corn');
      xProps.set(PLANTING_X_PROPS.FIELD, 'north-40');
      xProps.set(PLANTING_X_PROPS.WINDOW_START, '2026-04-15');
      xProps.set(PLANTING_X_PROPS.WINDOW_END, '2026-04-22');

      const event = makeEvent(xProps);
      const result = validatePlantingMission(event);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_VARIETY')).toBe(true);
    });

    it('returns error for missing field', () => {
      const xProps = new Map<string, string>();
      xProps.set(PLANTING_X_PROPS.CROP, 'corn');
      xProps.set(PLANTING_X_PROPS.VARIETY, 'Pioneer P1197');
      xProps.set(PLANTING_X_PROPS.WINDOW_START, '2026-04-15');
      xProps.set(PLANTING_X_PROPS.WINDOW_END, '2026-04-22');

      const event = makeEvent(xProps);
      const result = validatePlantingMission(event);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_FIELD')).toBe(true);
    });

    it('returns error when window end is before window start', () => {
      const xProps = new Map<string, string>();
      xProps.set(PLANTING_X_PROPS.CROP, 'corn');
      xProps.set(PLANTING_X_PROPS.VARIETY, 'Pioneer P1197');
      xProps.set(PLANTING_X_PROPS.FIELD, 'north-40');
      xProps.set(PLANTING_X_PROPS.WINDOW_START, '2026-04-22');
      xProps.set(PLANTING_X_PROPS.WINDOW_END, '2026-04-15');

      const event = makeEvent(xProps);
      const result = validatePlantingMission(event);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_WINDOW')).toBe(true);
    });

    it('warns about unknown crop type', () => {
      const xProps = new Map<string, string>();
      xProps.set(PLANTING_X_PROPS.CROP, 'quinoa'); // not in KNOWN_CROPS
      xProps.set(PLANTING_X_PROPS.VARIETY, 'Unknown Variety');
      xProps.set(PLANTING_X_PROPS.FIELD, 'north-40');
      xProps.set(PLANTING_X_PROPS.WINDOW_START, '2026-04-15');
      xProps.set(PLANTING_X_PROPS.WINDOW_END, '2026-04-22');

      const event = makeEvent(xProps);
      const result = validatePlantingMission(event);
      expect(result.errors.some(e => e.code === 'UNKNOWN_CROP')).toBe(true);
    });
  });

  describe('buildPlantingXProps()', () => {
    it('builds X-properties from PlantingMissionData', () => {
      const xProps = buildPlantingXProps({
        crop: 'corn',
        variety: 'Pioneer P1197',
        field: 'north-40',
        windowStart: '2026-04-15',
        windowEnd: '2026-04-22',
      });

      expect(xProps.get(PLANTING_X_PROPS.CROP)).toBe('corn');
      expect(xProps.get(PLANTING_X_PROPS.VARIETY)).toBe('Pioneer P1197');
      expect(xProps.get(PLANTING_X_PROPS.FIELD)).toBe('north-40');
      expect(xProps.get(PLANTING_X_PROPS.WINDOW_START)).toBe('2026-04-15');
      expect(xProps.get(PLANTING_X_PROPS.WINDOW_END)).toBe('2026-04-22');
    });

    it('includes linkedScout when provided', () => {
      const xProps = buildPlantingXProps({
        crop: 'corn',
        variety: 'Pioneer P1197',
        field: 'north-40',
        windowStart: '2026-04-15',
        windowEnd: '2026-04-22',
        linkedScout: '14 days after',
      });

      expect(xProps.get(PLANTING_X_PROPS.LINKED_SCOUT)).toBe('14 days after');
    });
  });
});

describe('Scouting Mission', () => {
  describe('validateScoutingMission()', () => {
    it('returns valid for complete scouting mission', () => {
      const xProps = new Map<string, string>();
      xProps.set(SCOUTING_X_PROPS.OBSERVATION_TYPE, 'pest');
      xProps.set(SCOUTING_X_PROPS.FIELD, 'north-40');
      xProps.set(SCOUTING_X_PROPS.LINKED_SCOUT_OFFSET, '14 days after');

      const event = makeEvent(xProps, ['scouting']);
      const result = validateScoutingMission(event);
      expect(result.valid).toBe(true);
    });

    it('returns error for missing observation type', () => {
      const xProps = new Map<string, string>();
      xProps.set(SCOUTING_X_PROPS.FIELD, 'north-40');

      const event = makeEvent(xProps, ['scouting']);
      const result = validateScoutingMission(event);
      expect(result.valid).toBe(false);
    });

    it('returns error for missing field', () => {
      const xProps = new Map<string, string>();
      xProps.set(SCOUTING_X_PROPS.OBSERVATION_TYPE, 'pest');

      const event = makeEvent(xProps, ['scouting']);
      const result = validateScoutingMission(event);
      expect(result.valid).toBe(false);
    });
  });

  describe('buildScoutingXProps()', () => {
    it('builds X-properties from ScoutingMissionData', () => {
      const xProps = buildScoutingXProps({
        observationType: 'pest',
        field: 'north-40',
      });

      expect(xProps.get(SCOUTING_X_PROPS.OBSERVATION_TYPE)).toBe('pest');
      expect(xProps.get(SCOUTING_X_PROPS.FIELD)).toBe('north-40');
    });
  });
});

describe('Chemical Mission', () => {
  describe('validateChemicalMission()', () => {
    it('returns valid for complete chemical mission', () => {
      const xProps = new Map<string, string>();
      xProps.set(CHEMICAL_X_PROPS.CHEMICAL_TYPE, 'herbicide');
      xProps.set(CHEMICAL_X_PROPS.TARGET, 'broadleaf weeds');
      xProps.set(CHEMICAL_X_PROPS.FIELD, 'north-40');
      xProps.set(CHEMICAL_X_PROPS.TEMPERATURE_MIN, '10');
      xProps.set(CHEMICAL_X_PROPS.TEMPERATURE_MAX, '25');

      const event = makeEvent(xProps, ['chemical']);
      const result = validateChemicalMission(event);
      expect(result.valid).toBe(true);
    });

    it('returns error for missing chemical type', () => {
      const xProps = new Map<string, string>();
      xProps.set(CHEMICAL_X_PROPS.TARGET, 'broadleaf weeds');
      xProps.set(CHEMICAL_X_PROPS.FIELD, 'north-40');

      const event = makeEvent(xProps, ['chemical']);
      const result = validateChemicalMission(event);
      expect(result.valid).toBe(false);
    });

    it('returns error when temperature min >= max', () => {
      const xProps = new Map<string, string>();
      xProps.set(CHEMICAL_X_PROPS.CHEMICAL_TYPE, 'herbicide');
      xProps.set(CHEMICAL_X_PROPS.TARGET, 'broadleaf weeds');
      xProps.set(CHEMICAL_X_PROPS.FIELD, 'north-40');
      xProps.set(CHEMICAL_X_PROPS.TEMPERATURE_MIN, '30');
      xProps.set(CHEMICAL_X_PROPS.TEMPERATURE_MAX, '25');

      const event = makeEvent(xProps, ['chemical']);
      const result = validateChemicalMission(event);
      expect(result.valid).toBe(false);
    });
  });

  describe('buildChemicalXProps()', () => {
    it('builds X-properties from ChemicalMissionData', () => {
      const xProps = buildChemicalXProps({
        chemicalType: 'herbicide',
        target: 'broadleaf weeds',
        field: 'north-40',
        temperatureMin: 10,
        temperatureMax: 25,
      });

      expect(xProps.get(CHEMICAL_X_PROPS.CHEMICAL_TYPE)).toBe('herbicide');
      expect(xProps.get(CHEMICAL_X_PROPS.TARGET)).toBe('broadleaf weeds');
      expect(xProps.get(CHEMICAL_X_PROPS.FIELD)).toBe('north-40');
    });
  });
});

describe('Equipment Mission', () => {
  describe('validateEquipmentMission()', () => {
    it('returns valid for complete equipment mission', () => {
      const xProps = new Map<string, string>();
      xProps.set(EQUIPMENT_X_PROPS.EQUIPMENT_ID, 'TRACTOR-001');
      xProps.set(EQUIPMENT_X_PROPS.MAINTENANCE_TYPE, 'oil_change');

      const event = makeEvent(xProps, ['equipment']);
      const result = validateEquipmentMission(event);
      expect(result.valid).toBe(true);
    });

    it('returns error for missing equipment ID', () => {
      const xProps = new Map<string, string>();
      xProps.set(EQUIPMENT_X_PROPS.MAINTENANCE_TYPE, 'oil_change');

      const event = makeEvent(xProps, ['equipment']);
      const result = validateEquipmentMission(event);
      expect(result.valid).toBe(false);
    });

    it('returns error for missing maintenance type', () => {
      const xProps = new Map<string, string>();
      xProps.set(EQUIPMENT_X_PROPS.EQUIPMENT_ID, 'TRACTOR-001');

      const event = makeEvent(xProps, ['equipment']);
      const result = validateEquipmentMission(event);
      expect(result.valid).toBe(false);
    });
  });

  describe('buildEquipmentXProps()', () => {
    it('builds X-properties from EquipmentMissionData', () => {
      const xProps = buildEquipmentXProps({
        equipmentId: 'TRACTOR-001',
        maintenanceType: 'oil_change',
      });

      expect(xProps.get(EQUIPMENT_X_PROPS.EQUIPMENT_ID)).toBe('TRACTOR-001');
      expect(xProps.get(EQUIPMENT_X_PROPS.MAINTENANCE_TYPE)).toBe('oil_change');
    });
  });
});

describe('Compliance Mission', () => {
  describe('validateComplianceMission()', () => {
    it('returns valid for complete compliance mission', () => {
      const xProps = new Map<string, string>();
      xProps.set(COMPLIANCE_X_PROPS.COMPLIANCE_TYPE, 'reporting');
      xProps.set(COMPLIANCE_X_PROPS.JURISDICTION, 'federal');
      xProps.set(COMPLIANCE_X_PROPS.FILING_DEADLINE, '2026-06-30');

      const event = makeEvent(xProps, ['compliance']);
      const result = validateComplianceMission(event);
      expect(result.valid).toBe(true);
    });

    it('returns error for missing compliance type', () => {
      const xProps = new Map<string, string>();
      xProps.set(COMPLIANCE_X_PROPS.JURISDICTION, 'federal');
      xProps.set(COMPLIANCE_X_PROPS.FILING_DEADLINE, '2026-06-30');

      const event = makeEvent(xProps, ['compliance']);
      const result = validateComplianceMission(event);
      expect(result.valid).toBe(false);
    });

    it('returns error for missing jurisdiction', () => {
      const xProps = new Map<string, string>();
      xProps.set(COMPLIANCE_X_PROPS.COMPLIANCE_TYPE, 'reporting');
      xProps.set(COMPLIANCE_X_PROPS.FILING_DEADLINE, '2026-06-30');

      const event = makeEvent(xProps, ['compliance']);
      const result = validateComplianceMission(event);
      expect(result.valid).toBe(false);
    });

    it('returns error for missing filing deadline', () => {
      const xProps = new Map<string, string>();
      xProps.set(COMPLIANCE_X_PROPS.COMPLIANCE_TYPE, 'reporting');
      xProps.set(COMPLIANCE_X_PROPS.JURISDICTION, 'federal');

      const event = makeEvent(xProps, ['compliance']);
      const result = validateComplianceMission(event);
      expect(result.valid).toBe(false);
    });
  });

  describe('buildComplianceXProps()', () => {
    it('builds X-properties from ComplianceMissionData', () => {
      const xProps = buildComplianceXProps({
        complianceType: 'reporting',
        jurisdiction: 'federal',
        filingDeadline: '2026-06-30',
      });

      expect(xProps.get(COMPLIANCE_X_PROPS.COMPLIANCE_TYPE)).toBe('reporting');
      expect(xProps.get(COMPLIANCE_X_PROPS.JURISDICTION)).toBe('federal');
      expect(xProps.get(COMPLIANCE_X_PROPS.FILING_DEADLINE)).toBe('2026-06-30');
    });

    it('includes penalty when provided', () => {
      const xProps = buildComplianceXProps({
        complianceType: 'reporting',
        jurisdiction: 'federal',
        filingDeadline: '2026-06-30',
        penalty: 'Loss of crop insurance eligibility',
      });

      expect(xProps.get(COMPLIANCE_X_PROPS.PENALTY)).toBe('Loss of crop insurance eligibility');
    });
  });
});
