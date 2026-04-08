import { Command } from 'commander';
import { ICSParser, findAvailableWindows, TimeWindow } from '@clockwork-ai/core';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';

function parseDuration(durationStr: string): number {
  const hourMatch = durationStr.match(/^(\d+)h$/);
  const minuteMatch = durationStr.match(/^(\d+)m$/);
  const combinedMatch = durationStr.match(/^(\d+)h(\d+)m?$/);
  
  if (combinedMatch && combinedMatch[1] && combinedMatch[2]) {
    return parseInt(combinedMatch[1], 10) * 60 + parseInt(combinedMatch[2], 10);
  }
  if (hourMatch && hourMatch[1]) {
    return parseInt(hourMatch[1], 10) * 60;
  }
  if (minuteMatch && minuteMatch[1]) {
    return parseInt(minuteMatch[1], 10);
  }
  throw new Error(`Invalid duration format: ${durationStr}. Use formats like "3h", "30m", or "2h30m"`);
}

export const planWindows = new Command('plan-windows')
  .description('Find available time windows for scheduling')
  .requiredOption('--calendar <path>', 'Path to .ics file')
  .requiredOption('--on <date>', 'Target date (YYYY-MM-DD)')
  .requiredOption('--duration <duration>', 'Required duration (e.g. 3h, 30m, 2h30m)')
  .option('--count <number>', 'Number of windows to find', '3')
  .option('--json', 'Output as structured JSON')
  .action(async (opts) => {
    const spinner = ora('Finding available windows...').start();
    
    try {
      if (!fs.existsSync(opts.calendar)) {
        spinner.fail();
        console.error(chalk.red(`Calendar file not found: ${opts.calendar}`));
        process.exit(1);
      }

      const icsContent = fs.readFileSync(opts.calendar, 'utf-8');
      const parser = new ICSParser();
      const calendar = parser.parse(icsContent);
      
      const targetDate = new Date(opts.on);
      const durationMinutes = parseDuration(opts.duration);
      const count = parseInt(opts.count, 10);
      
      const windows = findAvailableWindows(targetDate, durationMinutes, calendar.events, count);
      
      spinner.succeed();

      if (opts.json) {
        console.log(JSON.stringify({
          date: opts.on,
          requiredDuration: `${durationMinutes} minutes`,
          windows: windows.map(w => ({
            start: w.start.toISOString(),
            end: w.end.toISOString(),
            durationMinutes: w.durationMinutes,
            score: w.score
          }))
        }, null, 2));
        return;
      }

      console.log(chalk.bold('\n📅 Available Windows'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`  Date:     ${chalk.cyan(opts.on)}`);
      console.log(`  Duration: ${chalk.green(durationMinutes + ' minutes')}`);
      console.log(`  Requested: ${count} window(s)\n`);
      
      if (windows.length === 0) {
        console.log(chalk.yellow('  No available windows found for this day'));
        console.log(chalk.gray('  Try a different date or shorter duration'));
      } else {
        console.log(chalk.bold(`  Found ${windows.length} window(s):\n`));
        windows.forEach((window: TimeWindow, i: number) => {
          const startTime = window.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const endTime = window.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const scoreStr = window.score ? ` (score: ${window.score.toFixed(1)})` : '';
          console.log(`  ${chalk.cyan(String(i + 1).padStart(2) + '.')} ${startTime} - ${chalk.green(endTime)}${chalk.gray(scoreStr)}`);
        });
      }
      console.log();

    } catch (error) {
      spinner.fail();
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
