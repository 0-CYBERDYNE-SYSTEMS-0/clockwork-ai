/**
 * RRULE Validator — RFC 5545 compliance validation
 */

import type { RRule, ValidationResult, ValidationError } from '../types.js';

export class RRuleValidator {
  /**
   * Validate an RRule object
   */
  validate(rrule: RRule): ValidationResult {
    const errors: ValidationError[] = [];

    // FREQ is required
    if (!rrule.freq) {
      errors.push({ field: 'freq', message: 'FREQ is required', code: 'MISSING_FREQ' });
    }

    // FREQ must be valid
    const validFreqs = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
    if (rrule.freq && !validFreqs.includes(rrule.freq)) {
      errors.push({ field: 'freq', message: `Invalid FREQ: ${rrule.freq}`, code: 'INVALID_FREQ' });
    }

    // INTERVAL must be positive
    if (rrule.interval !== undefined && rrule.interval < 1) {
      errors.push({ field: 'interval', message: `INTERVAL must be >= 1, got ${rrule.interval}`, code: 'INVALID_INTERVAL' });
    }

    // UNTIL must be UTC
    if (rrule.until) {
      // UNTIL should be in UTC for DAILY/WEEKLY/MONTHLY
      if (rrule.freq !== 'YEARLY' && !this.isUTC(rrule.until)) {
        errors.push({ field: 'until', message: 'UNTIL should be in UTC', code: 'UNTIL_NOT_UTC' });
      }
    }

    // COUNT limits
    if (rrule.count !== undefined) {
      if (rrule.count < 1) {
        errors.push({ field: 'count', message: 'COUNT must be >= 1', code: 'INVALID_COUNT' });
      }
      if (rrule.count > 1000) {
        errors.push({ field: 'count', message: 'COUNT exceeds maximum of 1000', code: 'COUNT_EXCEEDED' });
      }
    }

    // UNTIL and COUNT are mutually exclusive (well, not strictly but having both is odd)
    if (rrule.until && rrule.count) {
      errors.push({ field: 'until', message: 'UNTIL and COUNT should not both be specified', code: 'UNTIL_AND_COUNT' });
    }

    // Infinite recurrence check
    if (!rrule.until && !rrule.count) {
      errors.push({
        field: 'count',
        message: 'Recurrence has no end (no UNTIL or COUNT). Max 1000 occurrences enforced.',
        code: 'INFINITE_RECURRENCE',
      });
    }

    // BYDAY validation
    if (rrule.byDay) {
      for (const mask of rrule.byDay) {
        const validDays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
        if (!validDays.includes(mask.day)) {
          errors.push({ field: 'byDay', message: `Invalid day: ${mask.day}`, code: 'INVALID_DAY' });
        }
        if (mask.position !== undefined && (mask.position < -53 || mask.position > 53 || mask.position === 0)) {
          errors.push({ field: 'byDay', message: `Invalid day position: ${mask.position}`, code: 'INVALID_DAY_POSITION' });
        }
      }
    }

    // BYMONTHDAY validation
    if (rrule.byMonthDay) {
      for (const day of rrule.byMonthDay) {
        if (day === 0 || day < -31 || day > 31) {
          errors.push({ field: 'byMonthDay', message: `Invalid BYMONTHDAY: ${day}`, code: 'INVALID_MONTHDAY' });
        }
      }
    }

    // BYMONTH validation
    if (rrule.byMonth) {
      for (const month of rrule.byMonth) {
        if (month < 1 || month > 12) {
          errors.push({ field: 'byMonth', message: `Invalid BYMONTH: ${month}`, code: 'INVALID_MONTH' });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate an RRULE string directly
   */
  validateString(rruleStr: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!rruleStr || rruleStr.trim() === '') {
      return { valid: false, errors: [{ field: 'rrule', message: 'RRULE string is empty', code: 'EMPTY_RRULE' }] };
    }

    const parts = rruleStr.split(';');
    let hasFreq = false;

    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx);
      if (key.toUpperCase() === 'FREQ') hasFreq = true;
    }

    if (!hasFreq) {
      errors.push({ field: 'rrule', message: 'RRULE must contain FREQ', code: 'MISSING_FREQ' });
    }

    return { valid: errors.length === 0, errors };
  }

  private isUTC(date: Date): boolean {
    return date.getTime() === new Date(date.toISOString()).getTime();
  }
}
