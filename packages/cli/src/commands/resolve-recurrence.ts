import { Command } from 'commander';
import { RRuleParser, RRuleExpander } from '@clockwork-ai/core';
import chalk from 'chalk';
import ora from 'ora';

export const resolveRecurrence = new Command('resolve-recurrence')
  .description('Expand an RRULE to concrete occurrence dates')
  .requiredOption('--rrule <text>', 'RRULE string')
  .requiredOption('--from <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--to <date>', 'End date (YYYY-MM-DD)')
  .option('--json', 'Output as structured JSON')
  .action(async (opts) => {
    const spinner = ora('Expanding recurrence...').start();
    
    try {
      const parser = new RRuleParser();
      const expander = new RRuleExpander();
      
      const rrule = parser.parse(opts.rrule);
      const fromDate = new Date(opts.from);
      const toDate = new Date(opts.to);
      
      // Use fromDate as dtstart (recurrence anchor)
      const occurrences = expander.expand(rrule, fromDate, fromDate, toDate);
      
      spinner.succeed();

      if (opts.json) {
        console.log(JSON.stringify({
          rrule: opts.rrule,
          range: { from: opts.from, to: opts.to },
          count: occurrences.length,
          occurrences: occurrences.map(d => d.toISOString())
        }, null, 2));
        return;
      }

      console.log(chalk.bold('\n📅 Recurrence Expansion'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`  RRULE: ${chalk.cyan(opts.rrule)}`);
      console.log(`  Range: ${opts.from} to ${opts.to}`);
      console.log(`  Count: ${chalk.green(occurrences.length)} occurrence(s)\n`);
      
      if (occurrences.length === 0) {
        console.log(chalk.yellow('  No occurrences in the specified range'));
      } else {
        occurrences.forEach((date, i) => {
          const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
          const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          console.log(`    ${String(i + 1).padStart(3)}. ${chalk.green(dayOfWeek)} ${date.toLocaleDateString()} ${chalk.gray(time)}`);
        });
      }
      console.log();

    } catch (error) {
      spinner.fail();
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
