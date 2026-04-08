import { Command } from 'commander';
import { ICSParser, ConflictDetector, Event, Conflict } from '@clockwork-ai/core';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';

export const findConflicts = new Command('find-conflicts')
  .description('Detect scheduling conflicts in a calendar')
  .requiredOption('--calendar <path>', 'Path to .ics file')
  .option('--on <date>', 'Check conflicts on specific date (YYYY-MM-DD)')
  .option('--json', 'Output as structured JSON')
  .action(async (opts) => {
    const spinner = ora('Analyzing calendar for conflicts...').start();
    
    try {
      if (!fs.existsSync(opts.calendar)) {
        spinner.fail();
        console.error(chalk.red(`Calendar file not found: ${opts.calendar}`));
        process.exit(1);
      }

      const icsContent = fs.readFileSync(opts.calendar, 'utf-8');
      const parser = new ICSParser();
      const calendar = parser.parse(icsContent);
      
      if (calendar.events.length === 0) {
        spinner.succeed('No events found in calendar');
        console.log(chalk.gray('  No conflicts to report'));
        return;
      }

      const conflictDetector = new ConflictDetector();
      
      let eventsToCheck: Event[] = calendar.events;
      if (opts.on) {
        const targetDate = new Date(opts.on);
        const targetParts = targetDate.toISOString().split('T');
        const targetStr = targetParts[0] ?? '';
        eventsToCheck = calendar.events.filter((event: Event) => {
          const eventParts = event.start.date.toISOString().split('T');
          const eventStr = eventParts[0] ?? '';
          return eventStr === targetStr;
        });
      }

      const allConflicts: Conflict[] = conflictDetector.detectConflicts(eventsToCheck);
      
      spinner.succeed();

      if (allConflicts.length === 0) {
        console.log(chalk.green('✅ No conflicts found'));
        return;
      }

      const conflictsByDate = new Map<string, Conflict[]>();
      for (const conflict of allConflicts) {
        const parts = conflict.overlapStart.toISOString().split('T');
        const dateKey = parts[0] ?? '';
        if (!conflictsByDate.has(dateKey)) {
          conflictsByDate.set(dateKey, []);
        }
        conflictsByDate.get(dateKey)!.push(conflict);
      }

      if (opts.json) {
        console.log(JSON.stringify({
          conflictCount: allConflicts.length,
          conflicts: allConflicts.map((c: Conflict) => ({
            eventA: c.eventA.summary,
            eventB: c.eventB.summary,
            overlapStart: c.overlapStart.toISOString(),
            overlapEnd: c.overlapEnd.toISOString(),
            severity: c.severity,
            resolutionOptions: c.resolutionOptions
          }))
        }, null, 2));
        return;
      }

      console.log(chalk.bold(`\n🔴 Found ${allConflicts.length} conflict(s)\n`));
      
      for (const [date, conflicts] of conflictsByDate) {
        console.log(chalk.bold.underline(`\n📅 ${date}`));
        conflicts.forEach((conflict: Conflict, i: number) => {
          console.log(chalk.red(`  [${i + 1}] ${conflict.eventA.summary} ↔ ${conflict.eventB.summary}`));
          console.log(chalk.gray(`      Overlap: ${conflict.overlapStart.toLocaleTimeString()} - ${conflict.overlapEnd.toLocaleTimeString()}`));
          console.log(chalk.gray(`      Severity: ${conflict.severity}`));
          console.log(chalk.cyan('      Resolution options:'));
          conflict.resolutionOptions.forEach((opt: any, j: number) => {
            console.log(chalk.cyan(`        ${j + 1}. ${opt.type}: ${opt.description}`));
          });
        });
      }

    } catch (error) {
      spinner.fail();
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
