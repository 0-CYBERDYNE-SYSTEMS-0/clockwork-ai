/**
 * Agrical Extension — Agricultural Domain Extension for Clockwork
 * Registers 5 mission types: planting, scouting, chemical, equipment, compliance
 */

import { MissionRegistry, type MissionType } from '@clockwork-ai/core';
import {
  validatePlantingMission,
  buildPlantingXProps,
  type PlantingMissionData,
  PLANTING_X_PROPS,
} from './mission-types/planting.js';
import {
  validateScoutingMission,
  buildScoutingXProps,
  type ScoutingMissionData,
  SCOUTING_X_PROPS,
} from './mission-types/scouting.js';
import {
  validateChemicalMission,
  buildChemicalXProps,
  type ChemicalMissionData,
  CHEMICAL_X_PROPS,
} from './mission-types/chemical.js';
import {
  validateEquipmentMission,
  buildEquipmentXProps,
  type EquipmentMissionData,
  EQUIPMENT_X_PROPS,
} from './mission-types/equipment.js';
import {
  validateComplianceMission,
  buildComplianceXProps,
  type ComplianceMissionData,
  COMPLIANCE_X_PROPS,
} from './mission-types/compliance.js';

export {
  // Planting
  validatePlantingMission,
  buildPlantingXProps,
  PLANTING_X_PROPS,
  type PlantingMissionData,
  // Scouting
  validateScoutingMission,
  buildScoutingXProps,
  SCOUTING_X_PROPS,
  type ScoutingMissionData,
  // Chemical
  validateChemicalMission,
  buildChemicalXProps,
  CHEMICAL_X_PROPS,
  type ChemicalMissionData,
  // Equipment
  validateEquipmentMission,
  buildEquipmentXProps,
  EQUIPMENT_X_PROPS,
  type EquipmentMissionData,
  // Compliance
  validateComplianceMission,
  buildComplianceXProps,
  COMPLIANCE_X_PROPS,
  type ComplianceMissionData,
};

// Mission type definitions
const PLANTING_MISSION: MissionType = {
  type: 'planting',
  name: 'Planting Window',
  description: 'Agricultural crop planting operations with variety, field, and timing constraints',
  requiredFields: ['crop', 'variety', 'field', 'windowStart', 'windowEnd'],
  optionalFields: ['linkedScout'],
  validator: validatePlantingMission,
};

const SCOUTING_MISSION: MissionType = {
  type: 'scouting',
  name: 'Scouting Mission',
  description: 'Agricultural field scouting and inspection missions linked to planting events',
  requiredFields: ['observationType', 'field'],
  optionalFields: ['linkedEvent', 'linkedScoutOffset'],
  validator: validateScoutingMission,
};

const CHEMICAL_MISSION: MissionType = {
  type: 'chemical',
  name: 'Chemical Application',
  description: 'Herbicide, insecticide, fungicide, and fertilizer applications with environmental constraints',
  requiredFields: ['chemicalType', 'target', 'field'],
  optionalFields: ['preHarvestInterval', 'temperatureMin', 'temperatureMax', 'restrictedUse'],
  validator: validateChemicalMission,
};

const EQUIPMENT_MISSION: MissionType = {
  type: 'equipment',
  name: 'Equipment Maintenance',
  description: 'Equipment maintenance operations tied to crop cycle phases',
  requiredFields: ['equipmentId', 'maintenanceType'],
  optionalFields: ['linkedPhase'],
  validator: validateEquipmentMission,
};

const COMPLIANCE_MISSION: MissionType = {
  type: 'compliance',
  name: 'Compliance Deadline',
  description: 'Regulatory compliance deadlines and reporting windows tied to growing seasons',
  requiredFields: ['complianceType', 'jurisdiction', 'filingDeadline'],
  optionalFields: ['penalty', 'field'],
  validator: validateComplianceMission,
};

/**
 * Register all Agrical mission types with a MissionRegistry
 */
export function registerAgrical(registry: MissionRegistry): void {
  registry.registerMissionType(PLANTING_MISSION);
  registry.registerMissionType(SCOUTING_MISSION);
  registry.registerMissionType(CHEMICAL_MISSION);
  registry.registerMissionType(EQUIPMENT_MISSION);
  registry.registerMissionType(COMPLIANCE_MISSION);
}
