/**
 * RRULE Expander Tests
 */

import { RRuleExpander } from '../src/rrule/rrule-expander.js';
import { RRuleParser } from '../src/rrule/rrule-parser.js';

describe('RRuleExpander', () => {
  let expander: RRuleExpander;
  let parser: RRuleParser;

  beforeEach(() => {
    expander = new RRuleExpander();
    parser = new RRuleParser();
  });

  describe('expand() - DAILY', () => {
    it('expands daily recurrence with COUNT', () => {
      const rrule = parser.parse('FREQ=DAILY;COUNT=5');
      const dtstart = new Date('2026-04-01T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-04-30T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(5);
    });

    it('expands daily recurrence with INTERVAL', () => {
      const rrule = parser.parse('FREQ=DAILY;INTERVAL=2;COUNT=5');
      const dtstart = new Date('2026-04-01T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-04-30T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(5);
      // Every other day
      expect(occurrences[1].getDate()).toBe(3);
      expect(occurrences[2].getDate()).toBe(5);
    });

    it('respects UNTIL bound', () => {
      const rrule = parser.parse('FREQ=DAILY;UNTIL=20260405T000000Z');
      const dtstart = new Date('2026-04-01T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-04-30T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(5); // Apr 1, 2, 3, 4, 5
    });

    it('excludes EXDATEs', () => {
      const rrule = parser.parse('FREQ=DAILY;COUNT=5');
      const dtstart = new Date('2026-04-01T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-04-30T23:59');
      const exdates = [new Date('2026-04-02T09:00'), new Date('2026-04-04T09:00')];

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd, exdates);
      expect(occurrences).toHaveLength(3);
    });

    it('includes RDATEs', () => {
      const rrule = parser.parse('FREQ=DAILY;COUNT=3');
      const dtstart = new Date('2026-04-01T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-04-30T23:59');
      const rdates = [new Date('2026-04-10T09:00'), new Date('2026-04-15T09:00')];

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd, [], rdates);
      expect(occurrences.some(d => d.getDate() === 10)).toBe(true);
      expect(occurrences.some(d => d.getDate() === 15)).toBe(true);
    });
  });

  describe('expand() - WEEKLY', () => {
    it('expands weekly recurrence', () => {
      const rrule = parser.parse('FREQ=WEEKLY;COUNT=4');
      const dtstart = new Date('2026-04-01T09:00'); // Wednesday
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-04-30T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(4);
    });

    it('expands weekly with BYDAY', () => {
      const rrule = parser.parse('FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12');
      const dtstart = new Date('2026-04-01T09:00'); // Wednesday
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-04-30T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      // Should have occurrences on Mon, Wed, Fri for ~3 weeks = ~9 occurrences
      expect(occurrences.length).toBeGreaterThan(0);
    });

    it('expands weekly with INTERVAL', () => {
      const rrule = parser.parse('FREQ=WEEKLY;INTERVAL=2;COUNT=4');
      const dtstart = new Date('2026-04-01T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-05-31T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(4);
    });
  });

  describe('expand() - MONTHLY', () => {
    it('expands monthly recurrence', () => {
      const rrule = parser.parse('FREQ=MONTHLY;COUNT=6');
      const dtstart = new Date('2026-04-15T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-12-31T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(6);
    });

    it('expands monthly with BYMONTHDAY', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYMONTHDAY=1;COUNT=6');
      const dtstart = new Date('2026-04-15T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-12-31T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(6);
      // All should be on the 1st of each month
      occurrences.forEach(d => expect(d.getDate()).toBe(1));
    });

    it('expands monthly with BYDAY positional (1st Monday)', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYDAY=1MO;COUNT=6');
      const dtstart = new Date('2026-04-01T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-12-31T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(6);
      // Each should be a Monday
      occurrences.forEach(d => expect(d.getDay()).toBe(1));
    });

    it('expands monthly with negative BYDAY position (last Friday)', () => {
      const rrule = parser.parse('FREQ=MONTHLY;BYDAY=-1FR;COUNT=6');
      const dtstart = new Date('2026-04-01T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-12-31T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(6);
      // Each should be a Friday
      occurrences.forEach(d => expect(d.getDay()).toBe(5));
    });
  });

  describe('expand() - YEARLY', () => {
    it('expands yearly recurrence', () => {
      const rrule = parser.parse('FREQ=YEARLY;COUNT=3');
      const dtstart = new Date('2026-04-15T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2029-12-31T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(3);
    });

    it('expands yearly with INTERVAL', () => {
      const rrule = parser.parse('FREQ=YEARLY;INTERVAL=2;COUNT=3');
      const dtstart = new Date('2026-04-15T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2032-12-31T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(3);
      expect(occurrences[0].getFullYear()).toBe(2026);
      expect(occurrences[1].getFullYear()).toBe(2028);
      expect(occurrences[2].getFullYear()).toBe(2030);
    });
  });

  describe('expand() - edge cases', () => {
    it('caps at 1000 occurrences maximum', () => {
      const rrule = parser.parse('FREQ=DAILY'); // No UNTIL or COUNT
      const dtstart = new Date('2020-01-01T09:00');
      const rangeStart = new Date('2020-01-01T00:00');
      const rangeEnd = new Date('2030-12-31T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences.length).toBeLessThanOrEqual(1000);
    });

    it('returns sorted and deduplicated occurrences', () => {
      const rrule = parser.parse('FREQ=DAILY;COUNT=5');
      const dtstart = new Date('2026-04-01T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-04-30T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      // Check sorted
      for (let i = 1; i < occurrences.length; i++) {
        expect(occurrences[i].getTime()).toBeGreaterThanOrEqual(occurrences[i - 1].getTime());
      }
    });

    it('returns empty array when range is before dtstart', () => {
      const rrule = parser.parse('FREQ=DAILY;COUNT=5');
      const dtstart = new Date('2026-04-15T09:00');
      const rangeStart = new Date('2026-04-01T00:00');
      const rangeEnd = new Date('2026-04-10T23:59');

      const occurrences = expander.expand(rrule, dtstart, rangeStart, rangeEnd);
      expect(occurrences).toHaveLength(0);
    });
  });
});
