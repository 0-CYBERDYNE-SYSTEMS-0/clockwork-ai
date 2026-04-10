/**
 * RRULE Parser Tests
 */

import { RRuleParser } from '../src/rrule/rrule-parser.js';

describe('RRuleParser', () => {
  let parser: RRuleParser;

  beforeEach(() => {
    parser = new RRuleParser();
  });

  describe('parse()', () => {
    it('parses FREQ=DAILY', () => {
      const rrule = parser.parse('FREQ=DAILY');
      expect(rrule.freq).toBe('DAILY');
      expect(rrule.interval).toBe(1);
    });

    it('parses FREQ=WEEKLY', () => {
      const rrule = parser.parse('FREQ=WEEKLY');
      expect(rrule.freq).toBe('WEEKLY');
    });

    it('parses FREQ=MONTHLY', () => {
      const rrule = parser.parse('FREQ=MONTHLY');
      expect(rrule.freq).toBe('MONTHLY');
    });

    it('parses FREQ=YEARLY', () => {
      const rrule = parser.parse('FREQ=YEARLY');
      expect(rrule.freq).toBe('YEARLY');
    });

    it('parses INTERVAL', () => {
      const rrule = parser.parse('FREQ=WEEKLY;INTERVAL=2');
      expect(rrule.interval).toBe(2);
    });

    it('defaults INTERVAL to 1', () => {
      const rrule = parser.parse('FREQ=DAILY');
      expect(rrule.interval).toBe(1);
    });

    it('parses UNTIL with date only', () => {
      const rrule = parser.parse('FREQ=DAILY;UNTIL=20260630');
      expect(rrule.until).toBeInstanceOf(Date);
    });

    it('parses UNTIL with UTC datetime', () => {
      const rrule = parser.parse('FREQ=DAILY;UNTIL=20260630T120000Z');
      expect(rrule.until).toBeInstanceOf(Date);
    });

    it('parses COUNT', () => {
      const rrule = parser.parse('FREQ=DAILY;COUNT=12');
      expect(rrule.count).toBe(12);
    });

    it('parses BYDAY with single day', () => {
      const rrule = parser.parse('FREQ=WEEKLY;BYDAY=MO');
      expect(rrule.byDay).toEqual([{ day: 'MO', position: undefined }]);
    });

    it('parses BYDAY with multiple days', () => {
      const rrule = parser.parse('FREQ=WEEKLY;BYDAY=MO,WE,FR');
      expect(rrule.byDay).toEqual([
        { day: 'MO', position: undefined },
        { day: 'WE', position: undefined },
        { day: 'FR', position: undefined },
      ]);
    });

    it('parses BYDAY with positional prefix', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYDAY=1MO');
      expect(rrule.byDay).toEqual([{ day: 'MO', position: 1 }]);
    });

    it('parses BYDAY with negative position (last)', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYDAY=-1FR');
      expect(rrule.byDay).toEqual([{ day: 'FR', position: -1 }]);
    });

    it('parses BYMONTHDAY', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYMONTHDAY=15');
      expect(rrule.byMonthDay).toEqual([15]);
    });

    it('parses multiple BYMONTHDAY', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYMONTHDAY=1,15');
      expect(rrule.byMonthDay).toEqual([1, 15]);
    });

    it('parses negative BYMONTHDAY', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYMONTHDAY=-1');
      expect(rrule.byMonthDay).toEqual([-1]);
    });

    it('parses BYMONTH', () => {
      const rrule = parser.parse('FREQ=YEARLY;BYMONTH=6');
      expect(rrule.byMonth).toEqual([6]);
    });

    it('parses complex RRULE', () => {
      const rrule = parser.parse('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=20');
      expect(rrule.freq).toBe('WEEKLY');
      expect(rrule.interval).toBe(2);
      expect(rrule.count).toBe(20);
      expect(rrule.byDay).toEqual([
        { day: 'TU', position: undefined },
        { day: 'TH', position: undefined },
      ]);
    });

    it('throws error when FREQ is missing', () => {
      expect(() => parser.parse('INTERVAL=2')).toThrow('FREQ is required');
    });

    it('throws error for invalid FREQ value', () => {
      expect(() => parser.parse('FREQ=INVALID')).toThrow('Invalid FREQ value');
    });

    it('throws error for invalid INTERVAL', () => {
      expect(() => parser.parse('FREQ=DAILY;INTERVAL=0')).toThrow('Invalid INTERVAL');
      expect(() => parser.parse('FREQ=DAILY;INTERVAL=-1')).toThrow('Invalid INTERVAL');
    });

    it('throws error for invalid COUNT', () => {
      expect(() => parser.parse('FREQ=DAILY;COUNT=0')).toThrow('Invalid COUNT');
      expect(() => parser.parse('FREQ=DAILY;COUNT=-5')).toThrow('Invalid COUNT');
    });

    it('throws error for invalid BYDAY value', () => {
      expect(() => parser.parse('FREQ=WEEKLY;BYDAY=INVALID')).toThrow('Invalid BYDAY value');
    });

    it('parses lowercase RRULE string', () => {
      const rrule = parser.parse('freq=daily;interval=2');
      expect(rrule.freq).toBe('DAILY');
      expect(rrule.interval).toBe(2);
    });
  });

  describe('serialize()', () => {
    it('serializes basic FREQ and INTERVAL', () => {
      const rrule = parser.parse('FREQ=DAILY;INTERVAL=1');
      expect(parser.serialize(rrule)).toBe('FREQ=DAILY');
    });

    it('serializes with custom INTERVAL', () => {
      const rrule = parser.parse('FREQ=WEEKLY;INTERVAL=2');
      expect(parser.serialize(rrule)).toBe('FREQ=WEEKLY;INTERVAL=2');
    });

    it('serializes UNTIL in UTC format', () => {
      const rrule = parser.parse('FREQ=DAILY;UNTIL=20260630T120000Z');
      const serialized = parser.serialize(rrule);
      expect(serialized).toContain('UNTIL=20260630');
    });

    it('serializes COUNT', () => {
      const rrule = parser.parse('FREQ=DAILY;COUNT=10');
      expect(parser.serialize(rrule)).toContain('COUNT=10');
    });

    it('serializes BYDAY with position', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYDAY=1MO');
      const serialized = parser.serialize(rrule);
      expect(serialized).toContain('BYDAY=1MO');
    });

    it('serializes multiple BYDAY values', () => {
      const rrule = parser.parse('FREQ=WEEKLY;BYDAY=MO,WE,FR');
      const serialized = parser.serialize(rrule);
      expect(serialized).toContain('BYDAY=MO,WE,FR');
    });

    it('round-trips: parse -> serialize -> parse', () => {
      const original = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=20';
      const rrule1 = parser.parse(original);
      const serialized = parser.serialize(rrule1);
      const rrule2 = parser.parse(serialized);
      expect(rrule2).toEqual(rrule1);
    });

    it('round-trips complex RRULE with UNTIL', () => {
      const original = 'FREQ=DAILY;UNTIL=20260630T120000Z;BYDAY=MO,WE,FR';
      const rrule1 = parser.parse(original);
      const serialized = parser.serialize(rrule1);
      const rrule2 = parser.parse(serialized);
      expect(rrule2.freq).toBe(rrule1.freq);
      expect(rrule2.byDay).toEqual(rrule1.byDay);
    });
  });
});
