/**
 * RRule Validator Tests
 */

import { RRuleValidator } from '../src/validator/rrule-validator.js';
import { RRuleParser } from '../src/rrule/rrule-parser.js';

describe('RRuleValidator', () => {
  let validator: RRuleValidator;
  let parser: RRuleParser;

  beforeEach(() => {
    validator = new RRuleValidator();
    parser = new RRuleParser();
  });

  describe('validate()', () => {
    it('returns valid for a well-formed RRule', () => {
      const rrule = parser.parse('FREQ=DAILY;COUNT=5');
      const result = validator.validate(rrule);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid for RRule with UNTIL (no COUNT)', () => {
      const rrule = parser.parse('FREQ=DAILY;UNTIL=20260630T120000Z');
      const result = validator.validate(rrule);
      expect(result.valid).toBe(true);
    });

    it('returns error for missing FREQ', () => {
      const rrule = { freq: '', interval: 1 } as any;
      const result = validator.validate(rrule);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_FREQ')).toBe(true);
    });

    it('returns error for invalid FREQ', () => {
      const rrule = { freq: 'INVALID', interval: 1 } as any;
      const result = validator.validate(rrule);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_FREQ')).toBe(true);
    });

    it('returns error for INTERVAL < 1', () => {
      const rrule = parser.parse('FREQ=DAILY;INTERVAL=0');
      const result = validator.validate(rrule);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_INTERVAL')).toBe(true);
    });

    it('returns error for COUNT < 1', () => {
      const rrule = parser.parse('FREQ=DAILY;COUNT=0');
      const result = validator.validate(rrule);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_COUNT')).toBe(true);
    });

    it('returns error for COUNT > 1000', () => {
      const rrule = parser.parse('FREQ=DAILY;COUNT=1001');
      const result = validator.validate(rrule);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'COUNT_EXCEEDED')).toBe(true);
    });

    it('warns about infinite recurrence (no UNTIL or COUNT)', () => {
      const rrule = parser.parse('FREQ=DAILY');
      const result = validator.validate(rrule);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INFINITE_RECURRENCE')).toBe(true);
    });

    it('warns when both UNTIL and COUNT are specified', () => {
      const rrule = parser.parse('FREQ=DAILY;UNTIL=20260630T120000Z;COUNT=10');
      const result = validator.validate(rrule);
      expect(result.errors.some(e => e.code === 'UNTIL_AND_COUNT')).toBe(true);
    });

    it('returns error for invalid day in BYDAY', () => {
      const rrule = parser.parse('FREQ=WEEKLY;BYDAY=XX');
      const result = validator.validate(rrule);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_DAY')).toBe(true);
    });

    it('returns error for invalid day position', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYDAY=0MO');
      const result = validator.validate(rrule);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_DAY_POSITION')).toBe(true);
    });

    it('returns error for BYMONTHDAY out of range', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYMONTHDAY=32');
      const result = validator.validate(rrule);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_MONTHDAY')).toBe(true);
    });

    it('returns error for BYMONTHDAY = 0', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYMONTHDAY=0');
      const result = validator.validate(rrule);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_MONTHDAY')).toBe(true);
    });

    it('returns error for BYMONTH out of range', () => {
      const rrule = parser.parse('FREQ=YEARLY;BYMONTH=13');
      const result = validator.validate(rrule);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_MONTH')).toBe(true);
    });

    it('accepts valid BYDAY with position', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYDAY=1MO,-1FR');
      const result = validator.validate(rrule);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateString()', () => {
    it('returns valid for well-formed RRULE string', () => {
      const result = validator.validateString('FREQ=WEEKLY;BYDAY=MO,WE,FR');
      expect(result.valid).toBe(true);
    });

    it('returns error for empty string', () => {
      const result = validator.validateString('');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('EMPTY_RRULE');
    });

    it('returns error for string without FREQ', () => {
      const result = validator.validateString('INTERVAL=2');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_FREQ')).toBe(true);
    });

    it('returns valid for RRULE with only FREQ', () => {
      const result = validator.validateString('FREQ=DAILY');
      expect(result.valid).toBe(true);
    });
  });
});
