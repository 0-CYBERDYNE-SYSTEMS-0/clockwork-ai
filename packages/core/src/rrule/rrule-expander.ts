/**
 * RRULE Expander — RFC 5545 compliant recurrence expansion
 * Expands RRule objects into concrete Date occurrences
 */

import type { RRule, DayMask, DayCode } from '../types.js';

const DAY_CODE_TO_NUMBER: Record<DayCode, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

const NUMBER_TO_DAY_CODE: Record<number, DayCode> = {
  0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA',
};

export class RRuleExpander {
  /**
   * Expand an RRule to concrete occurrences within a date range
   * @param rrule The parsed RRule
   * @param dtstart The event start date (recurrence anchor)
   * @param rangeStart Beginning of the range to expand
   * @param rangeEnd End of the range to expand
   * @param exdates Dates to exclude
   * @param rdates Additional dates to include
   */
  expand(
    rrule: RRule,
    dtstart: Date,
    rangeStart: Date,
    rangeEnd: Date,
    exdates: Date[] = [],
    rdates: Date[] = [],
  ): Date[] {
    // Apply max count safety
    const maxOccurrences = 1000;
    const effectiveEnd = this.effectiveEnd(rrule, rangeEnd);

    let occurrences: Date[] = [];

    switch (rrule.freq) {
      case 'DAILY':
        occurrences = this.expandDaily(rrule, dtstart, rangeStart, effectiveEnd, maxOccurrences);
        break;
      case 'WEEKLY':
        occurrences = this.expandWeekly(rrule, dtstart, rangeStart, effectiveEnd, maxOccurrences);
        break;
      case 'MONTHLY':
        occurrences = this.expandMonthly(rrule, dtstart, rangeStart, effectiveEnd, maxOccurrences);
        break;
      case 'YEARLY':
        occurrences = this.expandYearly(rrule, dtstart, rangeStart, effectiveEnd, maxOccurrences);
        break;
    }

    // Add RDATE occurrences
    for (const rdate of rdates) {
      if (rdate >= rangeStart && rdate <= effectiveEnd) {
        occurrences.push(new Date(rdate));
      }
    }

    // Filter by range
    occurrences = occurrences.filter(d => d >= rangeStart && d <= effectiveEnd);

    // Remove EXDATEs
    for (const exdate of exdates) {
      occurrences = occurrences.filter(d => !this.sameDay(d, exdate));
    }

    // Sort and deduplicate
    occurrences.sort((a, b) => a.getTime() - b.getTime());
    const unique = occurrences.filter((d, i) => {
      const prev = occurrences[i - 1];
      return i === 0 || (prev !== undefined && d.getTime() !== prev.getTime());
    });

    return unique;
  }

  private effectiveEnd(rrule: RRule, rangeEnd: Date): Date {
    if (rrule.until && rrule.until < rangeEnd) {
      return rrule.until;
    }
    if (rrule.count) {
      // Can't know effective end without expanding — use rangeEnd with count cap
    }
    return rangeEnd;
  }

  private sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  private expandDaily(
    rrule: RRule,
    dtstart: Date,
    rangeStart: Date,
    rangeEnd: Date,
    maxOccurrences: number,
  ): Date[] {
    const results: Date[] = [];
    let current = new Date(dtstart);
    const interval = rrule.interval || 1;

    // Fast forward to range
    while (current < rangeStart && results.length < maxOccurrences) {
      current = this.addDays(current, interval);
    }

    while (current <= rangeEnd && results.length < maxOccurrences) {
      if (current >= rangeStart) {
        results.push(new Date(current));
      }
      current = this.addDays(current, interval);
    }

    return results;
  }

  private expandWeekly(
    rrule: RRule,
    dtstart: Date,
    rangeStart: Date,
    rangeEnd: Date,
    maxOccurrences: number,
  ): Date[] {
    const results: Date[] = [];
    let current = new Date(dtstart);
    const interval = rrule.interval || 1;

    // Fast forward to range start week
    while (current < rangeStart) {
      current = this.addDays(current, 7 * interval);
    }

    // Rewind to start of week containing dtstart
    const startOfWeek = this.startOfWeek(dtstart);

    while (current <= rangeEnd && results.length < maxOccurrences) {
      const candidates = this.weekCandidates(current, startOfWeek, rrule.byDay);
      for (const candidate of candidates) {
        if (candidate >= rangeStart && candidate <= rangeEnd && results.length < maxOccurrences) {
          results.push(candidate);
        }
      }
      current = this.addDays(current, 7 * interval);
    }

    return results;
  }

  private expandMonthly(
    rrule: RRule,
    dtstart: Date,
    rangeStart: Date,
    rangeEnd: Date,
    maxOccurrences: number,
  ): Date[] {
    const results: Date[] = [];
    let current = new Date(dtstart);
    const interval = rrule.interval || 1;

    // Fast forward
    while (current < rangeStart) {
      current = this.addMonths(current, interval);
    }

    while (current <= rangeEnd && results.length < maxOccurrences) {
      const candidates = this.monthCandidates(current, dtstart, rrule.byDay, rrule.byMonthDay);
      for (const candidate of candidates) {
        if (candidate >= rangeStart && candidate <= rangeEnd && results.length < maxOccurrences) {
          results.push(candidate);
        }
      }
      current = this.addMonths(current, interval);
    }

    return results;
  }

  private expandYearly(
    rrule: RRule,
    dtstart: Date,
    rangeStart: Date,
    rangeEnd: Date,
    maxOccurrences: number,
  ): Date[] {
    const results: Date[] = [];
    let current = new Date(dtstart);
    const interval = rrule.interval || 1;

    while (current < rangeStart) {
      current.setFullYear(current.getFullYear() + interval);
    }

    while (current <= rangeEnd && results.length < maxOccurrences) {
      results.push(new Date(current));
      current.setFullYear(current.getFullYear() + interval);
    }

    return results;
  }

  private startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private weekCandidates(weekStart: Date, originalStart: Date, byDay?: DayMask[]): Date[] {
    const candidates: Date[] = [];

    if (!byDay || byDay.length === 0) {
      // Default: same day of week as dtstart
      candidates.push(new Date(originalStart));
      return candidates;
    }

    for (const mask of byDay) {
      let targetDay = DAY_CODE_TO_NUMBER[mask.day];

      if (mask.position !== undefined && mask.position !== 0) {
        // Nth weekday of month — find the nth occurrence
        const monthStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
        const occurrences = this.findNthWeekday(monthStart, mask.day, mask.position);
        candidates.push(...occurrences);
      } else {
        // Every occurrence of this day in the week
        const firstOfWeek = weekStart.getDay();
        const diff = targetDay - firstOfWeek;
        const candidate = this.addDays(weekStart, diff);
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  private monthCandidates(
    current: Date,
    originalStart: Date,
    byDay?: DayMask[],
    byMonthDay?: number[],
  ): Date[] {
    const candidates: Date[] = [];
    const year = current.getFullYear();
    const month = current.getMonth();

    if (byMonthDay && byMonthDay.length > 0) {
      for (const day of byMonthDay) {
        const d = new Date(year, month, day);
        if (d.getMonth() === month) { // Valid day for this month
          candidates.push(d);
        }
      }
    } else if (byDay && byDay.length > 0) {
      for (const mask of byDay) {
        if (mask.position !== undefined && mask.position !== 0) {
          candidates.push(...this.findNthWeekday(new Date(year, month, 1), mask.day, mask.position));
        } else {
          // Every weekday in the month
          const lastDay = new Date(year, month + 1, 0).getDate();
          for (let d = 1; d <= lastDay; d++) {
            const date = new Date(year, month, d);
            if (date.getDay() === DAY_CODE_TO_NUMBER[mask.day]) {
              candidates.push(date);
            }
          }
        }
      }
    } else {
      // Default: same day of month as dtstart
      candidates.push(new Date(originalStart));
    }

    return candidates;
  }

  private findNthWeekday(monthStart: Date, day: DayCode, position: number): Date[] {
    const results: Date[] = [];
    const targetDay = DAY_CODE_TO_NUMBER[day];
    let firstOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);

    // Find first occurrence of target day
    let firstOccurrence = firstOfMonth.getDay();
    let diff = targetDay - firstOccurrence;
    if (diff < 0) diff += 7;
    const firstDate = this.addDays(firstOfMonth, diff);

    if (position > 0) {
      const nthDate = this.addDays(firstDate, (position - 1) * 7);
      if (nthDate.getMonth() === monthStart.getMonth()) {
        results.push(nthDate);
      }
    } else if (position < 0) {
      // Last occurrence of day in month
      const lastOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      const lastOccurrence = lastOfMonth.getDay();
      let diffFromEnd = targetDay - lastOccurrence;
      if (diffFromEnd > 0) diffFromEnd -= 7;
      const lastDate = this.addDays(lastOfMonth, diffFromEnd);
      if (lastDate >= firstOfMonth) {
        results.push(lastDate);
      }
    }

    return results;
  }
}
