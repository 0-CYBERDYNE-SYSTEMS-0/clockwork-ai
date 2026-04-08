import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { ICSParser, ICSSerializer, MissionRegistry } from '@clockwork-ai/core';
import {
  registerAgrical,
  buildPlantingXProps,
  buildScoutingXProps,
  buildChemicalXProps,
  buildEquipmentXProps,
  buildComplianceXProps,
} from '@clockwork-ai/agrical';

const VALID_MISSION_TYPES = ['planting', 'scouting', 'chemical', 'equipment', 'compliance'];

export const createMission = new Command('create-mission')
  .description('Create an Agrical agricultural mission (planting, scouting, chemical, equipment, compliance)')
  .argument('<missionType>', `Mission type: ${VALID_MISSION_TYPES.join(', ')}`)
  .option('--crop <text>', 'Crop name (planting)')
  .option('--variety <text>', 'Crop variety (planting)')
  .option('--field <text>', 'Field identifier')
  .option('--window <text>', 'Date window YYYY-MM-DD/YYYY-MM-DD (planting, scouting)')
  .option('--observation-type <text>', 'Observation type (scouting): weed_pressure, pest, disease, growth_stage, soil_moisture, general')
  .option('--linked-scout <text>', 'Scout offset e.g. "14 days after" (scouting)')
  .option('--chemical-type <text>', 'Chemical type: herbicide, insecticide, fungicide, fertilizer (chemical)')
  .option('--target <text>', 'Target pest/weed/disease (chemical)')
  .option('--pre-harvest-interval <days>', 'Pre-harvest interval in days (chemical)')
  .option('--temp-min <celsius>', 'Minimum temperature in Celsius (chemical)')
  .option('--temp-max <celsius>', 'Maximum temperature in Celsius (chemical)')
  .option('--equipment-id <text>', 'Equipment identifier (equipment)')
  .option('--maintenance-type <text>', 'Maintenance type: oil_change, repair, inspection, calibration (equipment)')
  .option('--compliance-type <text>', 'Compliance type: reporting, certification, inspection (compliance)')
  .option('--jurisdiction <text>', 'Jurisdiction: federal, state, county (compliance)')
  .option('--filing-deadline <date>', 'Filing deadline YYYY-MM-DD (compliance)')
  .option('--penalty <text>', 'Penalty description (compliance)')
  .option('--calendar <path>', 'Path to .ics file', './farm-missions.ics')
  .option('--dry-run', 'Show preview without writing', true)
  .option('--commit', 'Actually commit the change')
  .action(async (missionType, opts) => {
    const calendarPath = opts.calendar as string;

    if (!VALID_MISSION_TYPES.includes(missionType)) {
      console.log(chalk.red(`\n✖ Invalid mission type: ${missionType}`));
      console.log(chalk.gray(`  Valid types: ${VALID_MISSION_TYPES.join(', ')}\n`));
      return;
    }

    // Initialize registry with agrical extension
    const registry = new MissionRegistry();
    registerAgrical(registry);

    // Parse existing calendar or create new one
    let events: any[] = [];
    let calendarContent = '';
    if (fs.existsSync(calendarPath)) {
      calendarContent = fs.readFileSync(calendarPath, 'utf-8');
      const parser = new ICSParser();
      const calendar = parser.parse(calendarContent);
      events = [...calendar.events];
    }

    // Build the event based on mission type
    const now = new Date();
    let summary = '';
    let xProps = new Map<string, string>();
    let startDate: Date;
    let endDate: Date;
    let duration = 60; // minutes

    if (missionType === 'planting') {
      const windowParts = (opts.window as string || '').split('/');
      if (!opts.crop || !opts.variety || !opts.field || windowParts.length !== 2) {
        console.log(chalk.red('\n✖ Missing required fields for planting mission'));
        console.log(chalk.gray('  Required: --crop, --variety, --field, --window\n'));
        return;
      }
      const windowStart = windowParts[0]!;
      const windowEnd = windowParts[1]!;
      startDate = new Date(windowStart);
      endDate = new Date(windowEnd);
      duration = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
      summary = `${opts.crop} planting (${opts.variety}) - ${opts.field}`;

      xProps = buildPlantingXProps({
        crop: opts.crop as string,
        variety: opts.variety as string,
        field: opts.field as string,
        windowStart,
        windowEnd,
        linkedScout: opts.linkedScout as string | undefined,
      });
    } else if (missionType === 'scouting') {
      const windowParts = (opts.window as string || '').split('/');
      if (!opts.field || !opts['observationType']) {
        console.log(chalk.red('\n✖ Missing required fields for scouting mission'));
        console.log(chalk.gray('  Required: --field, --observation-type, --window\n'));
        return;
      }
      startDate = windowParts[0] ? new Date(windowParts[0]) : now;
      endDate = windowParts[1] ? new Date(windowParts[1]) : new Date(startDate.getTime() + 2 * 3600000);
      duration = 120;
      summary = `Scouting: ${opts['observationType']} on ${opts.field}`;

      xProps = buildScoutingXProps({
        observationType: opts['observationType'] as any,
        field: opts.field as string,
        linkedScoutOffset: opts.linkedScout as string,
      });
    } else if (missionType === 'chemical') {
      if (!opts['chemicalType'] || !opts.target || !opts.field) {
        console.log(chalk.red('\n✖ Missing required fields for chemical mission'));
        console.log(chalk.gray('  Required: --chemical-type, --target, --field\n'));
        return;
      }
      const windowParts = (opts.window as string || '').split('/');
      startDate = windowParts[0] ? new Date(windowParts[0]) : now;
      endDate = windowParts[1] ? new Date(windowParts[1]) : new Date(startDate.getTime() + 3 * 3600000);
      duration = 180;
      summary = `${opts['chemicalType']} application on ${opts.field}`;

      xProps = buildChemicalXProps({
        chemicalType: opts['chemicalType'] as any,
        target: opts.target as string,
        field: opts.field as string,
        preHarvestInterval: opts['preHarvestInterval'] ? parseInt(opts['preHarvestInterval'] as string) : undefined,
        temperatureMin: opts['tempMin'] ? parseFloat(opts['tempMin'] as string) : undefined,
        temperatureMax: opts['tempMax'] ? parseFloat(opts['tempMax'] as string) : undefined,
      });
    } else if (missionType === 'equipment') {
      if (!opts['equipmentId'] || !opts['maintenanceType']) {
        console.log(chalk.red('\n✖ Missing required fields for equipment mission'));
        console.log(chalk.gray('  Required: --equipment-id, --maintenance-type\n'));
        return;
      }
      const windowParts = (opts.window as string || '').split('/');
      startDate = windowParts[0] ? new Date(windowParts[0]) : now;
      endDate = windowParts[1] ? new Date(windowParts[1]) : new Date(startDate.getTime() + 2 * 3600000);
      duration = 120;
      summary = `Equipment ${opts['maintenanceType']}: ${opts['equipmentId']}`;

      xProps = buildEquipmentXProps({
        equipmentId: opts['equipmentId'] as string,
        maintenanceType: opts['maintenanceType'] as any,
      });
    } else if (missionType === 'compliance') {
      if (!opts['complianceType'] || !opts.jurisdiction || !opts['filingDeadline']) {
        console.log(chalk.red('\n✖ Missing required fields for compliance mission'));
        console.log(chalk.gray('  Required: --compliance-type, --jurisdiction, --filing-deadline\n'));
        return;
      }
      startDate = new Date(opts['filingDeadline'] as string);
      endDate = new Date(startDate.getTime() + 60 * 60000);
      duration = 60;
      summary = `Compliance: ${opts['complianceType']} (${opts.jurisdiction})`;

      xProps = buildComplianceXProps({
        complianceType: opts['complianceType'] as any,
        jurisdiction: opts.jurisdiction as any,
        filingDeadline: opts['filingDeadline'] as string,
        penalty: opts.penalty as string,
      });
    } else {
      console.log(chalk.red(`\n✖ Unknown mission type: ${missionType}\n`));
      return;
    }

    // Build event object
    const event = {
      uid: `${missionType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      summary,
      description: `Agrical ${missionType} mission`,
      start: { date: startDate, timezone: 'UTC', isAllDay: false },
      end: { date: endDate, timezone: 'UTC', isAllDay: false },
      duration,
      categories: [missionType],
      xProperties: xProps,
      created: now,
      modified: now,
    };

    // Show dry-run preview
    console.log(chalk.bold('\n🌱 Agrical Mission Creation'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.cyan(`  Mission Type: ${missionType}`));
    console.log(chalk.cyan(`  Summary: ${summary}`));
    console.log(chalk.cyan(`  Start: ${startDate.toISOString()}`));
    console.log(chalk.cyan(`  End: ${endDate.toISOString()}`));
    console.log(chalk.cyan(`  Duration: ${duration} minutes`));
    console.log(chalk.gray('  X-Properties:'));
    for (const [k, v] of xProps) {
      console.log(chalk.gray(`    ${k}: ${v}`));
    }
    console.log(chalk.gray('─'.repeat(50)));

    if (opts.dryRun && !opts.commit) {
      console.log(chalk.yellow('\n  ⚠ Dry-run mode — no changes written'));
      console.log(chalk.gray('  Use --commit to write to calendar.\n'));
    } else {
      // Write to calendar
      const serializer = new ICSSerializer();
      const calFile = {
        filename: path.basename(calendarPath),
        events: [...events, event],
        timezones: [],
        productId: '-//Clockwork Agrical//EN',
      };
      const icsContent = serializer.serializeCalendar(calFile);
      fs.writeFileSync(calendarPath, icsContent, 'utf-8');
      console.log(chalk.green(`\n✔ Mission created and written to ${calendarPath}\n`));
    }
  });
