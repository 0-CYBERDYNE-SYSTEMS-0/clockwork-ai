/**
 * RRULE Parser — RFC 5545 Section 3.3.10
 * Parses RRULE strings into typed RRule objects
 */

import type { RRule, DayMask, DayCode, ValidationResult, ValidationError } from '../types.js';

export class RRuleParser {
  /**
   * Parse an RRULE string into an RRule object
   * @throws Error if FREQ is missing
   */
  parse(rruleStr: string): RRule {
    const parts = rruleStr.split(';');
    const rrule: RRule = { freq: 'WEEKLY', interval: 1 };
    let hasFreq = false;

    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;

      const key = part.slice(0, eqIdx).toUpperCase();
      const value = part.slice(eqIdx + 1);

      switch (key) {
        case 'FREQ':
          if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(value.toUpperCase())) {
            throw new Error(`Invalid FREQ value: ${value}`);
          }
          rrule.freq = value.toUpperCase() as RRule['freq'];
          hasFreq = true;
          break;
        case 'INTERVAL':
          rrule.interval = parseInt(value, 10);
          if (isNaN(rrule.interval) || rrule.interval < 1) {
            throw new Error(`Invalid INTERVAL: ${value}`);
          }
          break;
        case 'UNTIL':
          rrule.until = this.parseUntil(value);
          break;
        case 'COUNT':
          rrule.count = parseInt(value, 10);
          if (isNaN(rrule.count) || rrule.count < 1) {
            throw new Error(`Invalid COUNT: ${value}`);
          }
          break;
        case 'BYDAY':
          rrule.byDay = this.parseByDay(value);
          break;
        case 'BYMONTHDAY':
          rrule.byMonthDay = value.split(',').map(v => parseInt(v, 10));
          break;
        case 'BYMONTH':
          rrule.byMonth = value.split(',').map(v => parseInt(v, 10));
          break;
      }
    }

    if (!hasFreq) {
      throw new Error('FREQ is required in RRULE');
    }

    return rrule;
  }

  /**
   * Parse UNTIL value — UTC datetime in YYYYMMDDTHHMMSSZ format
   */
  private parseUntil(value: string): Date {
    const isUTC = value.endsWith('Z');
    const clean = value.replace('Z', '');

    if (clean.length < 8) {
      throw new Error(`Invalid UNTIL format: ${value}`);
    }

    const year = parseInt(clean.slice(0, 4), 10);
    const month = parseInt(clean.slice(4, 6), 10) - 1;
    const day = parseInt(clean.slice(6, 8), 10);
    const hour = clean.length >= 10 ? parseInt(clean.slice(9, 11), 10) : 0;
    const minute = clean.length >= 12 ? parseInt(clean.slice(11, 13), 10) : 0;
    const second = clean.length >= 14 ? parseInt(clean.slice(13, 15), 10) : 0;

    if (isUTC) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Parse BYDAY value — e.g. "MO,WE,FR" or "1MO,-1FR"
   */
  private parseByDay(value: string): DayMask[] {
    return value.split(',').map(v => {
      const match = v.match(/^(-?\d+)?([A-Z]{2})$/);
      if (!match || !match[2]) {
        return { day: v as DayCode };
      }
      return {
        position: match[1] ? parseInt(match[1], 10) : undefined,
        day: match[2] as DayCode,
      };
    });
  }

  /**
   * Serialize RRule back to RRULE string
   */
  serialize(rrule: RRule): string {
    const parts: string[] = [`FREQ=${rrule.freq}`];
    if (rrule.interval !== 1) parts.push(`INTERVAL=${rrule.interval}`);
    if (rrule.until) {
      const d = rrule.until;
      const str = `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}T${String(d.getUTCHours()).padStart(2,'0')}${String(d.getUTCMinutes()).padStart(2,'0')}${String(d.getUTCSeconds()).padStart(2,'0')}Z`;
      parts.push(`UNTIL=${str}`);
    }
    if (rrule.count !== undefined) parts.push(`COUNT=${rrule.count}`);
    if (rrule.byDay && rrule.byDay.length > 0) {
      const dayStr = rrule.byDay.map(d => d.position ? `${d.position}${d.day}` : d.day).join(',');
      parts.push(`BYDAY=${dayStr}`);
    }
    if (rrule.byMonthDay && rrule.byMonthDay.length > 0) {
      parts.push(`BYMONTHDAY=${rrule.byMonthDay.join(',')}`);
    }
    if (rrule.byMonth && rrule.byMonth.length > 0) {
      parts.push(`BYMONTH=${rrule.byMonth.join(',')}`);
    }
    return parts.join(';');
  }
}
