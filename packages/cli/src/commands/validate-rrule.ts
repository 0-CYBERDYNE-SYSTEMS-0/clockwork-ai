import { Command } from 'commander';
import { RRuleParser, RRuleValidator } from '@clockwork-ai/core';
import chalk from 'chalk';
import ora from 'ora';

export const validateRRule = new Command('validate-rrule')
  .description('Validate RRULE syntax and constraints')
  .argument('<rrule>', 'RRULE string to validate')
  .option('--json', 'Output as structured JSON')
  .action(async (rruleStr, opts) => {
    const spinner = ora('Validating RRULE...').start();
    
    try {
      const parser = new RRuleParser();
      const validator = new RRuleValidator();
      
      const rrule = parser.parse(rruleStr);
      const result = validator.validate(rrule);
      
      spinner.succeed();

      if (opts.json) {
        console.log(JSON.stringify({
          valid: result.valid,
          rrule: rruleStr,
          errors: result.errors
        }, null, 2));
        return;
      }

      console.log(chalk.bold('\n🔍 RRULE Validation'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`  RRULE: ${chalk.cyan(rruleStr)}\n`);
      
      if (result.valid) {
        console.log(chalk.green('  ✅ Valid RRULE'));
        console.log(chalk.gray('  ─────────────────────'));
        console.log(chalk.gray(`    Frequency: ${rrule.freq}`));
        console.log(chalk.gray(`    Interval:  ${rrule.interval}`));
        if (rrule.count) {
          console.log(chalk.gray(`    Count:     ${rrule.count}`));
        }
        if (rrule.until) {
          console.log(chalk.gray(`    Until:     ${rrule.until.toISOString()}`));
        }
        if (rrule.byDay && rrule.byDay.length > 0) {
          console.log(chalk.gray(`    ByDay:     ${rrule.byDay.map(d => d.day).join(', ')}`));
        }
      } else {
        console.log(chalk.red('  ❌ Invalid RRULE'));
        console.log(chalk.gray('  ─────────────────────'));
        result.errors.forEach((err, i) => {
          console.log(chalk.red(`    ${i + 1}. [${err.code}] ${err.message}`));
          console.log(chalk.gray(`       Field: ${err.field}`));
        });
      }
      console.log();

    } catch (error) {
      spinner.fail();
      if (opts.json) {
        console.log(JSON.stringify({
          valid: false,
          rrule: rruleStr,
          errors: [{ code: 'PARSE_ERROR', message: error instanceof Error ? error.message : String(error), field: 'rrule' }]
        }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    }
  });
