/**
 * Conflict Detector Tests
 */

import { ConflictDetector } from '../src/conflicts/conflicts.js';
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

describe('ConflictDetector', () => {
  let detector: ConflictDetector;

  beforeEach(() => {
    detector = new ConflictDetector();
  });

  describe('detectConflicts()', () => {
    it('returns no conflicts for non-overlapping events', () => {
      const events = [
        makeEvent({ uid: 'morning', summary: 'Morning Planting', start: { date: new Date('2026-04-15T08:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
        makeEvent({ uid: 'midday', summary: 'Midday Scouting', start: { date: new Date('2026-04-15T11:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T12:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
      ];

      const conflicts = detector.detectConflicts(events);
      expect(conflicts).toHaveLength(0);
    });

    it('detects overlap between two events', () => {
      const events = [
        makeEvent({ uid: 'evt-a', summary: 'Event A', start: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T10:30'), timezone: 'UTC', isAllDay: false }, duration: 90 }),
        makeEvent({ uid: 'evt-b', summary: 'Event B', start: { date: new Date('2026-04-15T10:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T11:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
      ];

      const conflicts = detector.detectConflicts(events);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].eventA.uid).toBe('evt-a');
      expect(conflicts[0].eventB.uid).toBe('evt-b');
    });

    it('detects multiple overlaps in a set of events', () => {
      const events = [
        makeEvent({ uid: 'a', summary: 'A', start: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T11:00'), timezone: 'UTC', isAllDay: false }, duration: 120 }),
        makeEvent({ uid: 'b', summary: 'B', start: { date: new Date('2026-04-15T10:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T12:00'), timezone: 'UTC', isAllDay: false }, duration: 120 }),
        makeEvent({ uid: 'c', summary: 'C', start: { date: new Date('2026-04-15T11:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T13:00'), timezone: 'UTC', isAllDay: false }, duration: 120 }),
      ];

      const conflicts = detector.detectConflicts(events);
      expect(conflicts.length).toBeGreaterThan(1);
    });

    it('skips cancelled events', () => {
      const events = [
        makeEvent({ uid: 'a', status: 'CONFIRMED', start: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T11:00'), timezone: 'UTC', isAllDay: false }, duration: 120 }),
        makeEvent({ uid: 'b', status: 'CANCELLED', start: { date: new Date('2026-04-15T10:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T12:00'), timezone: 'UTC', isAllDay: false }, duration: 120 }),
      ];

      const conflicts = detector.detectConflicts(events);
      expect(conflicts).toHaveLength(0);
    });

    it('marks same-location conflicts as critical', () => {
      const events = [
        makeEvent({ uid: 'a', location: 'north-40', start: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T10:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
        makeEvent({ uid: 'b', location: 'north-40', start: { date: new Date('2026-04-15T09:30'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T10:30'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
      ];

      const conflicts = detector.detectConflicts(events);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].severity).toBe('critical');
    });

    it('marks same-category conflicts as critical', () => {
      const events = [
        makeEvent({ uid: 'a', categories: ['planting'], start: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T10:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
        makeEvent({ uid: 'b', categories: ['planting'], start: { date: new Date('2026-04-15T09:30'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T10:30'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
      ];

      const conflicts = detector.detectConflicts(events);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].severity).toBe('critical');
    });

    it('generates reschedule resolution options', () => {
      const events = [
        makeEvent({ uid: 'a', summary: 'Event A', start: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T10:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
        makeEvent({ uid: 'b', summary: 'Event B', start: { date: new Date('2026-04-15T09:30'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T10:30'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
      ];

      const conflicts = detector.detectConflicts(events);
      expect(conflicts[0].resolutionOptions.length).toBeGreaterThan(0);
      expect(conflicts[0].resolutionOptions.some(o => o.type === 'reschedule')).toBe(true);
    });

    it('returns empty array for single event', () => {
      const events = [
        makeEvent({ uid: 'a', start: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T10:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
      ];

      const conflicts = detector.detectConflicts(events);
      expect(conflicts).toHaveLength(0);
    });

    it('returns empty array for empty input', () => {
      const conflicts = detector.detectConflicts([]);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('detectConflictsForNew()', () => {
    it('detects conflicts between proposed event and existing events', () => {
      const existing = [
        makeEvent({ uid: 'existing', start: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T10:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
      ];
      const proposed = { start: new Date('2026-04-15T09:30'), end: new Date('2026-04-15T10:30'), duration: 60 };

      const conflicts = detector.detectConflictsForNew(proposed, existing);
      expect(conflicts).toHaveLength(1);
    });

    it('returns no conflicts when proposed event fits', () => {
      const existing = [
        makeEvent({ uid: 'existing', start: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T10:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
      ];
      const proposed = { start: new Date('2026-04-15T11:00'), end: new Date('2026-04-15T12:00'), duration: 60 };

      const conflicts = detector.detectConflictsForNew(proposed, existing);
      expect(conflicts).toHaveLength(0);
    });

    it('skips cancelled existing events', () => {
      const existing = [
        makeEvent({ uid: 'cancelled', status: 'CANCELLED', start: { date: new Date('2026-04-15T09:00'), timezone: 'UTC', isAllDay: false }, end: { date: new Date('2026-04-15T10:00'), timezone: 'UTC', isAllDay: false }, duration: 60 }),
      ];
      const proposed = { start: new Date('2026-04-15T09:30'), end: new Date('2026-04-15T10:30'), duration: 60 };

      const conflicts = detector.detectConflictsForNew(proposed, existing);
      expect(conflicts).toHaveLength(0);
    });
  });
});
