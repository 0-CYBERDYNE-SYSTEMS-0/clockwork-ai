import { Command } from 'commander';
import { ICSParser, ICSSerializer, ConflictDetector, Event } from '@clockwork-ai/core';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';

function parseDateTime(input: string): Date {
  const isoDate = new Date(input);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  const dateMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
    return new Date(parseInt(dateMatch[1], 10), parseInt(dateMatch[2], 10) - 1, parseInt(dateMatch[3], 10));
  }
  throw new Error(`Invalid date format: ${input}`);
}

function createUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@clockwork`;
}

export const createEvent = new Command('create-event')
  .description('Create a new calendar event (dry-run by default)')
  .requiredOption('--summary <text>', 'Event summary/title')
  .requiredOption('--start <datetime>', 'Start datetime (ISO 8601 or YYYY-MM-DD for all-day)')
  .option('--end <datetime>', 'End datetime')
  .option('--duration <minutes>', 'Duration in minutes (if no end)')
  .option('--calendar <path>', 'Path to .ics file', './calendar.ics')
  .option('--dry-run', 'Show preview without writing', true)
  .option('--commit', 'Actually commit the change')
  .action(async (opts) => {
    const spinner = ora('Processing event...').start();
    
    try {
      let calendar = { filename: opts.calendar, events: [] as Event[], timezones: [] as any[] };
      if (fs.existsSync(opts.calendar)) {
        const icsContent = fs.readFileSync(opts.calendar, 'utf-8');
        const parser = new ICSParser();
        calendar = parser.parse(icsContent) as typeof calendar;
      }

      const startDate = parseDateTime(opts.start);
      let endDate: Date;
      
      if (opts.end) {
        endDate = parseDateTime(opts.end);
      } else if (opts.duration) {
        endDate = new Date(startDate.getTime() + parseInt(opts.duration, 10) * 60 * 1000);
      } else {
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      }

      const isAllDay = !opts.start.includes('T') && !opts.start.includes(':');
      
      const newEvent: Event = {
        uid: createUID(),
        summary: opts.summary,
        start: {
          date: startDate,
          timezone: 'UTC',
          isAllDay
        },
        end: {
          date: endDate,
          timezone: 'UTC',
          isAllDay
        },
        duration: Math.round((endDate.getTime() - startDate.getTime()) / 60000),
        categories: [],
        xProperties: new Map(),
        created: new Date(),
        modified: new Date(),
        sequence: 0,
        status: 'CONFIRMED'
      };

      spinner.succeed();

      console.log(chalk.bold('\n📅 Event Preview'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`  Summary: ${chalk.cyan(newEvent.summary)}`);
      console.log(`  Start:   ${chalk.green(startDate.toISOString())}`);
      console.log(`  End:     ${chalk.green(endDate.toISOString())}`);
      console.log(`  Duration: ${newEvent.duration} minutes`);
      console.log(`  UID:     ${chalk.gray(newEvent.uid)}`);
      
      if (calendar.events.length > 0) {
        const conflictDetector = new ConflictDetector();
        const conflicts = conflictDetector.detectConflictsForNew(
          { start: startDate, end: endDate, duration: newEvent.duration },
          calendar.events
        );
        
        if (conflicts.length > 0) {
          console.log(chalk.yellow('\n⚠️  Conflicts Detected'));
          conflicts.forEach((conflict: any, i: number) => {
            console.log(chalk.yellow(`  [${i + 1}] Conflicts with: ${conflict.eventB.summary}`));
            console.log(chalk.yellow(`      Overlap: ${conflict.overlapStart.toISOString()} - ${conflict.overlapEnd.toISOString()}`));
            console.log(chalk.yellow(`      Severity: ${conflict.severity}`));
          });
        }
      }

      console.log(chalk.gray('─'.repeat(50)));

      if (opts.commit) {
        const commitSpinner = ora('Committing event...').start();
        calendar.events.push(newEvent);
        const serializer = new ICSSerializer();
        const icsOutput = serializer.serializeCalendar(calendar as any);
        
        const dir = path.dirname(opts.calendar);
        if (!fs.existsSync(dir) && dir !== '.') {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(opts.calendar, icsOutput, 'utf-8');
        commitSpinner.succeed(chalk.green(`\n✅ Event committed to ${opts.calendar}`));
      } else {
        console.log(chalk.blue('\n🔍 Dry-run mode - no changes written'));
        console.log(chalk.blue('   Use --commit to actually save the event\n'));
      }

    } catch (error) {
      spinner.fail();
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
