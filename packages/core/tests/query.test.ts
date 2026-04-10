/**
 * Query Engine Tests
 */

import {
  after,
  before,
  overlaps,
  hasTag,
  inDateRange,
  durationGte,
  durationLte,
  withUid,
  composeFilters,
  applyQuery,
  isFreeAt,
  findAvailableWindows,
} from '../src/query/query.js';
import type { Event } from '../src/types.js';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    uid: 'evt-1',
    summary: 'Test Event',
    start: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false },
    end: { date: new Date('2026-04-15T10:00'), timezone: 'UTC', isAllDay: false },
    duration: 60,
    categories: ['planting'],
    xProperties: new Map(),
    created: new Date(),
    modified: new Date(),
    ...overrides,
  };
}

describe('Query Filters', () => {
  const events: Event[] = [
    makeEvent({ uid: 'morning', summary: 'Morning Planting', start: { date: new Date('2026-04-15T08:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, duration: 60, categories: ['planting'] }),
    makeEvent({ uid: 'midday', summary: 'Midday Scouting', start: { date: new Date('2026-04-15T11:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T12:00'), timezone: 'UTC', isAllDay: false }, duration: 60, categories: ['scouting'] }),
    makeEvent({ uid: 'afternoon', summary: 'Afternoon Chemical', start: { date: new Date('2026-04-15T14:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T15:30'), timezone: 'UTC', isAllDay: false }, duration: 90, categories: ['chemical'] }),
    makeEvent({ uid: 'evening', summary: 'Evening Equipment', start: { date: new Date('2026-04-15T18:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T19:00'), timezone: 'UTC', isAllDay: false }, duration: 60, categories: ['equipment'] }),
  ];

  describe('after()', () => {
    it('returns events starting on or after the given date', () => {
      const result = after(new Date('2026-04-15T11:00'))(events);
      expect(result.map(e => e.uid)).toEqual(['midday', 'afternoon', 'evening']);
    });

    it('includes events exactly at the boundary', () => {
      const result = after(new Date('2026-04-15T11:00'))(events);
      expect(result.some(e => e.uid === 'midday')).toBe(true);
    });
  });

  describe('before()', () => {
    it('returns events ending on or before the given date', () => {
      const result = before(new Date('2026-04-15T12:00'))(events);
      expect(result.map(e => e.uid)).toEqual(['morning', 'midday']);
    });
  });

  describe('overlaps()', () => {
    it('returns events overlapping with the given time range', () => {
      const result = overlaps(new Date('2026-04-15T09:30'), new Date('2026-04-15T11:30'))(events);
      expect(result.map(e => e.uid)).toEqual(['morning', 'midday']);
    });

    it('returns empty array when no overlap', () => {
      const result = overlaps(new Date('2026-04-15T20:00'), new Date('2026-04-15T21:00'))(events);
      expect(result).toHaveLength(0);
    });
  });

  describe('hasTag()', () => {
    it('returns events with matching category (case insensitive)', () => {
      const result = hasTag('planting')(events);
      expect(result.map(e => e.uid)).toEqual(['morning']);
    });

    it('returns events with matching category regardless of case', () => {
      const result = hasTag('PLANTING')(events);
      expect(result.map(e => e.uid)).toEqual(['morning']);
    });

    it('returns empty for non-existent tag', () => {
      const result = hasTag('compliance')(events);
      expect(result).toHaveLength(0);
    });
  });

  describe('inDateRange()', () => {
    it('returns events within the given date range', () => {
      const result = inDateRange(new Date('2026-04-15T00:00'), new Date('2026-04-15T23:59'))(events);
      expect(result).toHaveLength(4);
    });

    it('excludes events completely outside the range', () => {
      const result = inDateRange(new Date('2026-04-15T00:00'), new Date('2026-04-15T10:00'))(events);
      expect(result.map(e => e.uid)).toEqual(['morning']);
    });
  });

  describe('durationGte()', () => {
    it('returns events with duration >= specified minutes', () => {
      const result = durationGte(60)(events);
      expect(result.map(e => e.uid)).toEqual(['morning', 'midday', 'afternoon', 'evening']);
    });

    it('excludes events shorter than specified', () => {
      const result = durationGte(90)(events);
      expect(result.map(e => e.uid)).toEqual(['afternoon']);
    });
  });

  describe('durationLte()', () => {
    it('returns events with duration <= specified minutes', () => {
      const result = durationLte(60)(events);
      expect(result.map(e => e.uid)).toEqual(['morning', 'midday', 'evening']);
    });
  });

  describe('withUid()', () => {
    it('returns events matching any of the given UIDs', () => {
      const result = withUid(['morning', 'afternoon'])(events);
      expect(result.map(e => e.uid)).toEqual(['morning', 'afternoon']);
    });

    it('returns empty array for non-existent UIDs', () => {
      const result = withUid(['nonexistent'])(events);
      expect(result).toHaveLength(0);
    });
  });

  describe('composeFilters()', () => {
    it('applies multiple filters with AND logic', () => {
      const filter = composeFilters(hasTag('planting'), durationGte(30));
      const result = filter(events);
      expect(result.map(e => e.uid)).toEqual(['morning']);
    });

    it('works with empty filter list', () => {
      const filter = composeFilters();
      const result = filter(events);
      expect(result).toHaveLength(4);
    });
  });

  describe('applyQuery()', () => {
    it('applies filters in sequence', () => {
      const result = applyQuery(events, hasTag('planting'), durationGte(30));
      expect(result.map(e => e.uid)).toEqual(['morning']);
    });
  });
});

describe('isFreeAt()', () => {
  const events: Event[] = [
    makeEvent({ uid: 'morning', start: { date: new Date('2026-04-15T08:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
    makeEvent({ uid: 'midday', start: { date: new Date('2026-04-15T11:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T12:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
  ];

  it('returns false when time range conflicts', () => {
    expect(isFreeAt(new Date('2026-04-15T08:30'), new Date('2026-04-15T09:30'), events)).toBe(false);
  });

  it('returns true when time range is free', () => {
    expect(isFreeAt(new Date('2026-04-15T09:30'), new Date('2026-04-15T10:30'), events)).toBe(true);
  });

  it('returns true for adjacent event (ends at start)', () => {
    expect(isFreeAt(new Date('2026-04-15T09:00'), new Date('2026-04-15T10:00'), events)).toBe(true);
  });
});

describe('findAvailableWindows()', () => {
  const events: Event[] = [
    makeEvent({ uid: 'morning', start: { date: new Date('2026-04-15T08:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
    makeEvent({ uid: 'midday', start: { date: new Date('2026-04-15T11:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T12:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
  ];

  it('finds available windows on a day with events', () => {
    const target = new Date('2026-04-15T12:00');
    const windows = findAvailableWindows(target, 60, events, 3);
    expect(windows).toHaveLength(3);
    expect(windows[0].durationMinutes).toBe(60);
  });

  it('returns windows sorted by score (smaller gap preferred)', () => {
    const target = new Date('2026-04-15T12:00');
    const windows = findAvailableWindows(target, 30, events, 3);
    expect(windows[0].score).toBeLessThanOrEqual(windows[1].score ?? Infinity);
  });

  it('respects business hours 8 AM - 6 PM', () => {
    const target = new Date('2026-04-15T12:00');
    const windows = findAvailableWindows(target, 60, events, 1);
    if (windows.length > 0) {
      expect(windows[0].start.getHours()).toBeGreaterThanOrEqual(8);
      expect(windows[0].end.getHours()).toBeLessThanOrEqual(18);
    }
  });

  it('returns empty array when no windows available', () => {
    const fullDay = [
      makeEvent({ uid: 'all-day', start: { date: new Date('2026-04-15T08:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T18:00'), timezone: 'UTC', isAllDay: false }, duration: 600 }),
    ];
    const target = new Date('2026-04-15T12:00');
    const windows = findAvailableWindows(target, 60, fullDay, 3);
    expect(windows).toHaveLength(0);
  });

  it('handles day with no events', () => {
    const target = new Date('2026-04-15T12:00');
    const windows = findAvailableWindows(target, 60, [], 3);
    expect(windows).toHaveLength(3);
  });
});
