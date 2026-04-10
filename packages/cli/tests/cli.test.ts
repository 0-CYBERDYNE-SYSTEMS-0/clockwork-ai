/**
 * CLI Tests
 */

import { spawn } from 'child_process';
import path from 'path';

const CLI_PATH = path.join(__dirname, '../../dist/index.js');

function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      timeout: 10000,
    });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
    proc.on('error', (err) => {
      stderr += err.message;
      resolve({ stdout, stderr, exitCode: 1 });
    });
  });
}

describe('CLI Commands', () => {
  describe('clockwork --help', () => {
    it('displays help and lists all commands', async () => {
      const { stdout, exitCode } = await runCLI(['--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('clockwork');
      expect(stdout).toContain('create-event');
      expect(stdout).toContain('find-conflicts');
      expect(stdout).toContain('resolve-recurrence');
      expect(stdout).toContain('query-events');
      expect(stdout).toContain('validate-rrule');
      expect(stdout).toContain('plan-windows');
      expect(stdout).toContain('create-mission');
    });
  });

  describe('validate-rrule', () => {
    it('shows help for validate-rrule command', async () => {
      const { stdout, exitCode } = await runCLI(['validate-rrule', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('validate-rrule');
      expect(stdout).toContain('RRULE');
    });

    it('validates a valid RRULE string', async () => {
      const { stdout, exitCode } = await runCLI(['validate-rrule', 'FREQ=DAILY;COUNT=5']);
      expect(exitCode).toBe(0);
      const lower = stdout.toLowerCase();
      expect(lower.includes('valid') || lower.includes('valid')).toBe(true);
    });

    it('outputs JSON when --json flag is used', async () => {
      const { stdout, exitCode } = await runCLI(['validate-rrule', 'FREQ=WEEKLY;COUNT=10', '--json']);
      expect(exitCode).toBe(0);
      // Should be valid JSON
      let parsed: any;
      expect(() => { parsed = JSON.parse(stdout); }).not.toThrow();
      expect(parsed).toHaveProperty('valid');
      expect(parsed).toHaveProperty('rrule');
    });
  });

  describe('create-mission --help', () => {
    it('displays help for create-mission command', async () => {
      const { stdout, exitCode } = await runCLI(['create-mission', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('create-mission');
      expect(stdout).toContain('planting');
      expect(stdout).toContain('scouting');
      expect(stdout).toContain('chemical');
      expect(stdout).toContain('equipment');
      expect(stdout).toContain('compliance');
    });
  });

  describe('resolve-recurrence --help', () => {
    it('displays help for resolve-recurrence command', async () => {
      const { stdout, exitCode } = await runCLI(['resolve-recurrence', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('resolve-recurrence');
    });
  });

  describe('find-conflicts --help', () => {
    it('displays help for find-conflicts command', async () => {
      const { stdout, exitCode } = await runCLI(['find-conflicts', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('find-conflicts');
    });
  });

  describe('plan-windows --help', () => {
    it('displays help for plan-windows command', async () => {
      const { stdout, exitCode } = await runCLI(['plan-windows', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('plan-windows');
    });
  });

  describe('query-events --help', () => {
    it('displays help for query-events command', async () => {
      const { stdout, exitCode } = await runCLI(['query-events', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('query-events');
    });
  });

  describe('create-event --help', () => {
    it('displays help for create-event command', async () => {
      const { stdout, exitCode } = await runCLI(['create-event', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('create-event');
    });
  });

  describe('version', () => {
    it('outputs version with -V flag', async () => {
      const { stdout, exitCode } = await runCLI(['-V']);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
