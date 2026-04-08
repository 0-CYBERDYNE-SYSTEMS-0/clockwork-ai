import { Command } from 'commander';
import { ICSParser, applyQuery, after, before, hasTag, Event } from '@clockwork-ai/core';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';

export const queryEvents = new Command('query-events')
  .description('Query events with structured filters')
  .requiredOption('--calendar <path>', 'Path to .ics file')
  .option('--after <date>', 'Events after date (YYYY-MM-DD)')
  .option('--before <date>', 'Events before date (YYYY-MM-DD)')
  .option('--tag <text>', 'Filter by category/tag')
  .option('--json', 'Output as structured JSON')
  .action(async (opts) => {
    const spinner = ora('Querying events...').start();
    
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
        return;
      }

      const filters: any[] = [];
      
      if (opts.after) {
        const afterDate = new Date(opts.after);
        filters.push(after(afterDate));
      }
      
      if (opts.before) {
        const beforeDate = new Date(opts.before);
        filters.push(before(beforeDate));
      }
      
      if (opts.tag) {
        filters.push(hasTag(opts.tag));
      }

      const results = filters.length > 0 
        ? applyQuery(calendar.events as Event[], ...filters)
        : calendar.events as Event[];

      spinner.succeed();

      if (opts.json) {
        console.log(JSON.stringify({
          total: calendar.events.length,
          matched: results.length,
          events: results.map(e => ({
            uid: e.uid,
            summary: e.summary,
            start: e.start.date.toISOString(),
            end: e.end.date.toISOString(),
            categories: e.categories
          }))
        }, null, 2));
        return;
      }

      console.log(chalk.bold(`\n📋 Query Results`));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`  Total events: ${chalk.gray(calendar.events.length.toString())}`);
      console.log(`  Matched: ${chalk.green(results.length.toString())}\n`);
      
      if (results.length === 0) {
        console.log(chalk.yellow('  No events match your query'));
      } else {
        results.forEach((event: Event, i: number) => {
          const startStr = event.start.date.toLocaleDateString() + ' ' + event.start.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const endStr = event.end.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          console.log(`  ${chalk.cyan(String(i + 1).padStart(2) + '.')} ${event.summary}`);
          console.log(chalk.gray(`      ${startStr} - ${endStr}`));
          if (event.categories.length > 0) {
            console.log(chalk.gray(`      Tags: ${event.categories.join(', ')}`));
          }
        });
      }
      console.log();

    } catch (error) {
      spinner.fail();
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
