import { Command } from 'commander';
import { createEvent } from './commands/create-event.js';
import { findConflicts } from './commands/find-conflicts.js';
import { resolveRecurrence } from './commands/resolve-recurrence.js';
import { queryEvents } from './commands/query-events.js';
import { validateRRule } from './commands/validate-rrule.js';
import { planWindows } from './commands/plan-windows.js';
import { createMission } from './commands/create-mission.js';

export function runCLI() {
  const program = new Command();
  program.name('clockwork').description('ICS-native reasoning layer for AI agents').version('0.1.0');
  program.addCommand(createEvent);
  program.addCommand(findConflicts);
  program.addCommand(resolveRecurrence);
  program.addCommand(queryEvents);
  program.addCommand(validateRRule);
  program.addCommand(planWindows);
  program.addCommand(createMission);
  program.parse(process.argv);
}

// Run if executed directly
runCLI();
