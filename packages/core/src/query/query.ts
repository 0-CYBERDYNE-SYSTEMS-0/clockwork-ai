/**
 * Query Engine — Composable filter primitives for calendar reasoning
 */

import type { Event, FilterFn, TimeWindow } from '../types.js';

/**
 * Returns events that start on or after the given date
 */
export function after(date: Date): FilterFn {
  return (events: Event[]) =>
    events.filter(e => e.start.date >= date);
}

/**
 * Returns events that end on or before the given date
 */
export function before(date: Date): FilterFn {
  return (events: Event[]) =>
    events.filter(e => e.end.date <= date);
}

/**
 * Returns events that overlap with the given time range
 */
export function overlaps(start: Date, end: Date): FilterFn {
  return (events: Event[]) =>
    events.filter(e => {
      const eStart = e.start.date.getTime();
      const eEnd = e.end.date.getTime();
      return eStart < end.getTime() && eEnd > start.getTime();
    });
}

/**
 * Returns events that have the specified tag in their categories
 */
export function hasTag(tag: string): FilterFn {
  return (events: Event[]) =>
    events.filter(e => e.categories.some(c => c.toLowerCase() === tag.toLowerCase()));
}

/**
 * Returns events within the given date range
 */
export function inDateRange(start: Date, end: Date): FilterFn {
  return (events: Event[]) =>
    events.filter(e => {
      const eStart = e.start.date.getTime();
      const eEnd = e.end.date.getTime();
      return eStart <= end.getTime() && eEnd >= start.getTime();
    });
}

/**
 * Returns events with duration >= the specified minutes
 */
export function durationGte(minutes: number): FilterFn {
  return (events: Event[]) =>
    events.filter(e => e.duration >= minutes);
}

/**
 * Returns events with duration <= the specified minutes
 */
export function durationLte(minutes: number): FilterFn {
  return (events: Event[]) =>
    events.filter(e => e.duration <= minutes);
}

/**
 * Returns events matching any of the given UIDs
 */
export function withUid(uids: string[]): FilterFn {
  const uidSet = new Set(uids);
  return (events: Event[]) =>
    events.filter(e => uidSet.has(e.uid));
}

/**
 * Compose multiple filters into a single filter (AND logic)
 */
export function composeFilters(...filters: FilterFn[]): FilterFn {
  return (events: Event[]) => {
    let result = events;
    for (const filter of filters) {
      result = filter(result);
    }
    return result;
  };
}

/**
 * Apply a query by combining filters
 */
export function applyQuery(events: Event[], ...filters: FilterFn[]): Event[] {
  return composeFilters(...filters)(events);
}

/**
 * Check if a time range is free (no conflicts with given events)
 */
export function isFreeAt(start: Date, end: Date, events: Event[]): boolean {
  return !events.some(e => {
    const eStart = e.start.date.getTime();
    const eEnd = e.end.date.getTime();
    return eStart < end.getTime() && eEnd > start.getTime();
  });
}

/**
 * Find available time windows of at least the specified duration on a given day
 */
export function findAvailableWindows(
  targetDate: Date,
  durationMinutes: number,
  events: Event[],
  count: number = 3,
): TimeWindow[] {
  const windows: TimeWindow[] = [];

  // Start of the target day
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);

  // End of the target day (11:59 PM)
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Filter events to just this day
  const dayEvents = applyQuery(events, inDateRange(dayStart, dayEnd));

  // Sort by start time
  const sorted = [...dayEvents].sort((a, b) => a.start.date.getTime() - b.start.date.getTime());

  // Find gaps
  let cursor = new Date(dayStart);
  cursor.setHours(8, 0, 0, 0); // Business hours start: 8 AM

  const businessEnd = new Date(dayStart);
  businessEnd.setHours(18, 0, 0, 0); // 6 PM

  for (const event of sorted) {
    const eventStart = event.start.date;
    const eventEnd = event.end.date;

    // Skip events outside business hours
    if (eventEnd <= cursor) continue;
    if (eventStart >= businessEnd) continue;

    // Align cursor to max of cursor and event end
    if (eventStart > cursor) {
      const gapStart = new Date(cursor);
      const gapEnd = new Date(Math.min(eventStart.getTime(), businessEnd.getTime()));
      const gapDuration = Math.round((gapEnd.getTime() - gapStart.getTime()) / 60000);

      if (gapDuration >= durationMinutes) {
        windows.push({
          start: gapStart,
          end: new Date(gapStart.getTime() + durationMinutes * 60000),
          durationMinutes,
          score: gapDuration - durationMinutes, // Prefer smaller gaps (less waste)
        });
        if (windows.length >= count) break;
      }
    }

    cursor = new Date(Math.max(cursor.getTime(), eventEnd.getTime()));
    if (cursor >= businessEnd) break;
  }

  // Check remaining time after last event
  if (windows.length < count && cursor < businessEnd) {
    const gapDuration = Math.round((businessEnd.getTime() - cursor.getTime()) / 60000);
    if (gapDuration >= durationMinutes) {
      windows.push({
        start: new Date(cursor),
        end: new Date(cursor.getTime() + durationMinutes * 60000),
        durationMinutes,
        score: gapDuration - durationMinutes,
      });
    }
  }

  // Sort by score (smaller gap = better)
  return windows.sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, count);
}
