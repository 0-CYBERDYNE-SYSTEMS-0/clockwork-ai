/**
 * Timezone Handler
 * Handles VTIMEZONE parsing, DST transitions, and UTC conversion
 */

import type { VTimezone } from '../types.js';

/**
 * Common UTC offsets for timezone resolution when full VTIMEZONE data is unavailable
 */
const UTC_OFFSET_CACHE: Record<string, number> = {
  'America/New_York': -5,
  'America/Chicago': -6,
  'America/Denver': -7,
  'America/Los_Angeles': -8,
  'America/Phoenix': -7,
  'Europe/London': 0,
  'Europe/Paris': 1,
  'Europe/Berlin': 1,
  'Asia/Tokyo': 9,
  'Asia/Shanghai': 8,
  'Asia/Kolkata': 5.5,
  'Australia/Sydney': 10,
  'UTC': 0,
};

export class TimezoneHandler {
  /**
   * Convert a local time to UTC
   */
  toUTC(localDate: Date, timezone: string): Date {
    if (timezone === 'UTC') return localDate;

    const offset = this.getOffsetForTimezone(timezone, localDate);
    const utc = new Date(localDate.getTime() - offset * 3600 * 1000);
    return utc;
  }

  /**
   * Convert UTC to local time in a timezone
   */
  fromUTC(utcDate: Date, timezone: string): Date {
    if (timezone === 'UTC') return utcDate;

    const offset = this.getOffsetForTimezone(timezone, utcDate);
    const local = new Date(utcDate.getTime() + offset * 3600 * 1000);
    return local;
  }

  /**
   * Get the UTC offset in hours for a given timezone and date
   */
  getOffsetForTimezone(timezone: string, date: Date): number {
    // Try to use Intl API for real timezone support
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });

      const parts = formatter.formatToParts(date);
      const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);

      // Get the local time components
      const localYear = getPart('year');
      const localMonth = getPart('month') - 1;
      const localDay = getPart('day');
      const localHour = getPart('hour');
      const localMinute = getPart('minute');
      const localSecond = getPart('second');

      const localDate = new Date(localYear, localMonth, localDay, localHour, localMinute, localSecond);
      const utcDate = new Date(date);

      const offsetMs = localDate.getTime() - utcDate.getTime();
      return offsetMs / (3600 * 1000);
    } catch {
      // Fallback to known offsets
      return UTC_OFFSET_CACHE[timezone] ?? 0;
    }
  }

  /**
   * Check if a timezone is valid (IANA recognized)
   */
  isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse VTIMEZONE component into structured form
   */
  parseVTimezone(vtimezoneBlock: string): VTimezone | null {
    const tzidMatch = vtimezoneBlock.match(/TZID:([^\n]+)/);
    if (!tzidMatch || !tzidMatch[1]) return null;

    return {
      tzid: tzidMatch[1].trim(),
    };
  }

  /**
   * Format a Date as UTC string for ICS output
   */
  formatUTC(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    const second = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hour}${minute}${second}Z`;
  }
}
