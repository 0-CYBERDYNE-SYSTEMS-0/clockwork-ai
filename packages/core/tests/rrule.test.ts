/**
 * RRULE Parser and Expander Tests
 * Tests for RFC 5545 RRULE parsing and recurrence expansion
 */

import { RRuleParser } from '../src/rrule/rrule-parser.js';
import { RRuleExpander } from '../src/rrule/rrule-expander.js';

describe('RRuleParser', () => {
  let parser: RRuleParser;

  beforeEach(() => {
    parser = new RRuleParser();
  });

  describe('parse()', () => {
    it('parses simple DAILY frequency', () => {
      const result = parser.parse('FREQ=DAILY');

      expect(result.freq).toBe('DAILY');
      expect(result.interval).toBe(1);
    });

    it('parses WEEKLY frequency with INTERVAL', () => {
      const result = parser.parse('FREQ=WEEKLY;INTERVAL=2');

      expect(result.freq).toBe('WEEKLY');
      expect(result.interval).toBe(2);
    });

    it('parses MONTHLY frequency', () => {
      const result = parser.parse('FREQ=MONTHLY');

      expect(result.freq).toBe('MONTHLY');
    });

    it('parses YEARLY frequency', () => {
      const result = parser.parse('FREQ=YEARLY');

      expect(result.freq).toBe('YEARLY');
    });

    it('parses COUNT', () => {
      const result = parser.parse('FREQ=DAILY;COUNT=10');

      expect(result.count).toBe(10);
    });

    it('parses UNTIL date in UTC', () => {
      const result = parser.parse('FREQ=DAILY;UNTIL=20240430T235959Z');

      expect(result.until).toBeDefined();
      expect(result.until!.getTime()).toBeGreaterThan(0);
    });

    it('parses BYDAY single day', () => {
      const result = parser.parse('FREQ=WEEKLY;BYDAY=MO');

      expect(result.byDay).toEqual([{ day: 'MO' }]);
    });

    it('parses BYDAY multiple days', () => {
      const result = parser.parse('FREQ=WEEKLY;BYDAY=MO,WE,FR');

      expect(result.byDay).toEqual([
        { day: 'MO' },
        { day: 'WE' },
        { day: 'FR' },
      ]);
    });

    it('parses BYDAY with position (nth weekday)', () => {
      const result = parser.parse('FREQ=MONTHLY;BYDAY=1MO');

      expect(result.byDay).toEqual([{ day: 'MO', position: 1 }]);
    });

    it('parses negative position (last weekday)', () => {
      const result = parser.parse('FREQ=MONTHLY;BYDAY=-1FR');

      expect(result.byDay).toEqual([{ day: 'FR', position: -1 }]);
    });

    it('parses BYMONTHDAY', () => {
      const result = parser.parse('FREQ=MONTHLY;BYMONTHDAY=15');

      expect(result.byMonthDay).toEqual([15]);
    });

    it('parses BYMONTHDAY multiple days', () => {
      const result = parser.parse('FREQ=MONTHLY;BYMONTHDAY=1,15');

      expect(result.byMonthDay).toEqual([1, 15]);
    });

    it('parses BYMONTH', () => {
      const result = parser.parse('FREQ=YEARLY;BYMONTH=4');

      expect(result.byMonth).toEqual([4]);
    });

    it('throws when FREQ is missing', () => {
      expect(() => parser.parse('COUNT=10')).toThrow('FREQ is required');
    });

    it('throws on invalid FREQ', () => {
      expect(() => parser.parse('FREQ=INVALID')).toThrow('Invalid FREQ value: INVALID');
    });

    it('throws on invalid INTERVAL', () => {
      expect(() => parser.parse('FREQ=DAILY;INTERVAL=0')).toThrow('Invalid INTERVAL');
    });

    it('throws on invalid BYDAY', () => {
      expect(() => parser.parse('FREQ=WEEKLY;BYDAY=XX')).toThrow('Invalid BYDAY value');
    });
  });

  describe('serialize()', () => {
    it('serializes basic RRule', () => {
      const rrule = { freq: 'DAILY', interval: 1 };
      const result = parser.serialize(rrule);

      expect(result).toBe('FREQ=DAILY');
    });

    it('serializes with INTERVAL', () => {
      const rrule = { freq: 'WEEKLY', interval: 2 };
      const result = parser.serialize(rrule);

      expect(result).toContain('INTERVAL=2');
    });

    it('serializes with COUNT', () => {
      const rrule = { freq: 'DAILY', interval: 1, count: 10 };
      const result = parser.serialize(rrule);

      expect(result).toContain('COUNT=10');
    });

    it('serializes with BYDAY', () => {
      const rrule = {
        freq: 'WEEKLY',
        interval: 1,
        byDay: [{ day: 'MO' }, { day: 'WE' }],
      };
      const result = parser.serialize(rrule);

      expect(result).toContain('BYDAY=MO,WE');
    });

    it('serializes BYDAY with position', () => {
      const rrule = {
        freq: 'MONTHLY',
        interval: 1,
        byDay: [{ day: 'MO', position: 1 }],
      };
      const result = parser.serialize(rrule);

      expect(result).toContain('BYDAY=1MO');
    });

    it('round-trips parse and serialize', () => {
      const original = 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12';
      const parsed = parser.parse(original);
      const serialized = parser.serialize(parsed);

      expect(serialized).toContain('FREQ=WEEKLY');
      expect(serialized).toContain('BYDAY=MO,WE,FR');
      expect(serialized).toContain('COUNT=12');
    });
  });
});

describe('RRuleExpander', () => {
  let expander: RRuleExpander;

  beforeEach(() => {
    expander = new RRuleExpander();
  });

  describe('expand()', () => {
    it('expands DAILY frequency', () => {
      const rrule = { freq: 'DAILY', interval: 1, count: 5 };
      const dtstart = new Date('2024-04-01T09:00:00Z');

      const occurrences = expander.expand(
        rrule,
        dtstart,
        new Date('2024-04-01T00:00:00Z'),
        new Date('2024-04-10T23:59:59Z'),
      );

      expect(occurrences).toHaveLength(5);
    });

    it('expands DAILY with INTERVAL', () => {
      const rrule = { freq: 'DAILY', interval: 2, count: 3 };
      const dtstart = new Date('2024-04-01T09:00:00Z');

      const occurrences = expander.expand(
        rrule,
        dtstart,
        new Date('2024-04-01T00:00:00Z'),
        new Date('2024-04-10T23:59:59Z'),
      );

      expect(occurrences).toHaveLength(3);
      // Should be every 2 days
      const dayDiff = Math.round(
        (occurrences[1].getTime() - occurrences[0].getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(dayDiff).toBe(2);
    });

    it('expands WEEKLY with BYDAY', () => {
      const rrule = {
        freq: 'WEEKLY',
        interval: 1,
        byDay: [{ day: 'MO' }, { day: 'WE' }, { day: 'FR' }],
      };
      const dtstart = new Date('2024-04-01T09:00:00Z'); // Monday

      const occurrences = expander.expand(
        rrule,
        dtstart,
        new Date('2024-04-01T00:00:00Z'),
        new Date('2024-04-30T23:59:59Z'),
      );

      // Should have multiple Mondays, Wednesdays, Fridays in April 2024
      expect(occurrences.length).toBeGreaterThan(5);
    });

    it('expands MONTHLY by month day', () => {
      const rrule = { freq: 'MONTHLY', interval: 1, byMonthDay: [15] };
      const dtstart = new Date('2024-04-15T09:00:00Z');

      const occurrences = expander.expand(
        rrule,
        dtstart,
        new Date('2024-04-01T00:00:00Z'),
        new Date('2024-12-31T23:59:59Z'),
      );

      // Should have occurrences on the 15th of each month
      occurrences.forEach(date => {
        expect(date.getDate()).toBe(15);
      });
    });

    it('expands MONTHLY by nth weekday', () => {
      const rrule = {
        freq: 'MONTHLY',
        interval: 1,
        byDay: [{ day: 'MO', position: 1 }],
      };
      const dtstart = new Date('2024-04-01T09:00:00Z'); // First Monday

      const occurrences = expander.expand(
        rrule,
        dtstart,
        new Date('2024-04-01T00:00:00Z'),
        new Date('2024-12-31T23:59:59Z'),
      );

      // Should have first Monday of each month
      expect(occurrences.length).toBeGreaterThanOrEqual(3);
      occurrences.forEach(date => {
        expect(date.getDay()).toBe(1); // Monday
      });
    });

    it('expands YEARLY frequency', () => {
      const rrule = { freq: 'YEARLY', interval: 1, count: 3 };
      const dtstart = new Date('2024-04-01T09:00:00Z');

      const occurrences = expander.expand(
        rrule,
        dtstart,
        new Date('2024-04-01T00:00:00Z'),
        new Date('2027-12-31T23:59:59Z'),
      );

      expect(occurrences).toHaveLength(3);
    });

    it('respects UNTIL boundary', () => {
      const rrule = {
        freq: 'DAILY',
        interval: 1,
        until: new Date('2024-04-05T23:59:59Z'),
      };
      const dtstart = new Date('2024-04-01T09:00:00Z');

      const occurrences = expander.expand(
        rrule,
        dtstart,
        new Date('2024-04-01T00:00:00Z'),
        new Date('2024-04-30T23:59:59Z'),
      );

      // Should stop at UNTIL date
      occurrences.forEach(date => {
        expect(date.getTime()).toBeLessThanOrEqual(new Date('2024-04-05T23:59:59Z').getTime());
      });
    });

    it('applies EXDATE exclusions', () => {
      const rrule = { freq: 'DAILY', interval: 1, count: 5 };
      const dtstart = new Date('2024-04-01T09:00:00Z');
      const exdates = [new Date('2024-04-02T09:00:00Z'), new Date('2024-04-04T09:00:00Z')];

      const occurrences = expander.expand(
        rrule,
        dtstart,
        new Date('2024-04-01T00:00:00Z'),
        new Date('2024-04-10T23:59:59Z'),
        exdates,
      );

      // Should exclude the EXDATE dates
      expect(occurrences.length).toBe(3);
    });

    it('adds RDATE inclusions', () => {
      const rrule = { freq: 'DAILY', interval: 1, count: 3 };
      const dtstart = new Date('2024-04-01T09:00:00Z');
      const rdates = [new Date('2024-04-07T09:00:00Z')];

      const occurrences = expander.expand(
        rrule,
        dtstart,
        new Date('2024-04-01T00:00:00Z'),
        new Date('2024-04-10T23:59:59Z'),
        [],
        rdates,
      );

      expect(occurrences.length).toBeGreaterThan(3);
    });

    it('filters by range', () => {
      const rrule = { freq: 'DAILY', interval: 1, count: 30 };
      const dtstart = new Date('2024-04-01T09:00:00Z');
      const rangeStart = new Date('2024-04-10T00:00:00Z');
      const rangeEnd = new Date('2024-04-15T23:59:59Z');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);

      // Should only return occurrences within range
      occurrences.forEach(date => {
        expect(date.getTime()).toBeGreaterThanOrEqual(rangeStart.getTime());
        expect(date.getTime()).toBeLessThanOrEqual(rangeEnd.getTime());
      });
    });

    it('sorts and deduplicates occurrences', () => {
      const rrule = { freq: 'WEEKLY', interval: 1, byDay: [{ day: 'MO' }] };
      const dtstart = new Date('2024-04-01T09:00:00Z');

      const occurrences = expander.expand(
        rrule,
        dtstart,
        new Date('2024-04-01T00:00:00Z'),
        new Date('2024-04-30T23:59:59Z'),
      );

      // Should be sorted
      for (let i = 1; i < occurrences.length; i++) {
        expect(occurrences[i].getTime()).toBeGreaterThanOrEqual(occurrences[i - 1].getTime());
      }
    });

    it('handles negative BYMONTHDAY (days from month end)', () => {
      const rrule = { freq: 'MONTHLY', interval: 1, byMonthDay: [-1] };
      const dtstart = new Date('2024-04-30T09:00:00Z');

      const occurrences = expander.expand(
        rrule,
        dtstart,
        new Date('2024-04-01T00:00:00Z'),
        new Date('2024-12-31T23:59:59Z'),
      );

      // Should have last day of each month
      expect(occurrences.length).toBeGreaterThan(0);
      occurrences.forEach(date => {
        const month = date.getMonth();
        const year = date.getFullYear();
        const lastDay = new Date(year, month + 1, 0).getDate();
        expect(date.getDate()).toBe(lastDay);
      });
    });
  });
});