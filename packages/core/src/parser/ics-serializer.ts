/**
 * ICS Serializer
 * Converts typed Event objects back to RFC 5545 compliant ICS strings
 */

import { ICSTokenizer } from './ics-tokenizer.js';
import type { Event, CalendarFile, VTimezone } from '../types.js';

export class ICSSerializer {
  /**
   * Serialize a CalendarFile to ICS string
   */
  serializeCalendar(calendar: CalendarFile): string {
    const lines: string[] = [];

    // VCALENDAR header
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push(`PRODID:-//Clockwork//EN`);
    lines.push('CALSCALE:GREGORIAN');
    lines.push('METHOD:PUBLISH');

    // VTIMEZONE blocks
    for (const tz of calendar.timezones) {
      lines.push(...this.serializeTimezone(tz));
    }

    // VEVENT blocks
    for (const event of calendar.events) {
      lines.push(...this.serializeEvent(event));
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /**
   * Serialize a single event to ICS lines
   */
  serializeEvent(event: Event): string[] {
    const lines: string[] = ['BEGIN:VEVENT'];

    lines.push(`UID:${event.uid}`);
    lines.push(`SUMMARY:${ICSTokenizer.escapeValue(event.summary)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${ICSTokenizer.escapeValue(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${ICSTokenizer.escapeValue(event.location)}`);
    }

    // DTSTART
    lines.push(...this.serializeDateTime('DTSTART', event.start));

    // DTEND
    if (event.start.isAllDay) {
      // For all-day events, end is the day after
      const endDate = new Date(event.end.date);
      endDate.setDate(endDate.getDate() - 1);
      lines.push(`DTEND;VALUE=DATE:${this.formatAllDayDate(endDate)}`);
    } else {
      lines.push(...this.serializeDateTime('DTEND', event.end));
    }

    // RRULE
    if (event.rrule) {
      lines.push(`RRULE:${this.serializeRRule(event.rrule)}`);
    }

    // EXDATE
    if (event.exdates) {
      for (const exdate of event.exdates) {
        lines.push(`EXDATE:${this.formatDateTime(exdate, event.start.timezone)}`);
      }
    }

    // RDATE
    if (event.rdates) {
      for (const rdate of event.rdates) {
        lines.push(`RDATE:${this.formatDateTime(rdate, event.start.timezone)}`);
      }
    }

    // Categories
    if (event.categories.length > 0) {
      lines.push(`CATEGORIES:${event.categories.join(',')}`);
    }

    // Sequence
    lines.push(`SEQUENCE:${event.sequence ?? 0}`);

    // Status
    if (event.status) {
      lines.push(`STATUS:${event.status}`);
    }

    // Timestamps
    lines.push(`CREATED:${this.formatDateTime(event.created, 'UTC').replace(/.*T/, '').replace(/Z$/, 'Z')}`);
    lines.push(`LAST-MODIFIED:${this.formatDateTime(event.modified, 'UTC').replace(/.*T/, '').replace(/Z$/, 'Z')}`);

    // X-properties (preserve all extension properties)
    for (const [key, value] of event.xProperties) {
      lines.push(`${key}:${ICSTokenizer.escapeValue(value)}`);
    }

    lines.push('END:VEVENT');
    return lines;
  }

  private serializeDateTime(label: string, dt: { date: Date; timezone: string; isAllDay: boolean }): string[] {
    if (dt.isAllDay) {
      return [`${label};VALUE=DATE:${this.formatAllDayDate(dt.date)}`];
    }
    if (dt.timezone === 'UTC') {
      return [`${label};TZID=${dt.timezone}:${this.formatDateTimeLocal(dt.date)}Z`];
    }
    return [`${label};TZID=${dt.timezone}:${this.formatDateTimeLocal(dt.date)}`];
  }

  private formatAllDayDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hour}${minute}${second}`;
  }

  private formatDateTime(date: Date, timezone: string): string {
    if (timezone === 'UTC') {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hour = String(date.getUTCHours()).padStart(2, '0');
      const minute = String(date.getUTCMinutes()).padStart(2, '0');
      const second = String(date.getUTCSeconds()).padStart(2, '0');
      return `${year}${month}${day}T${hour}${minute}${second}Z`;
    }
    return this.formatDateTimeLocal(date);
  }

  private serializeRRule(rrule: Event['rrule']): string {
    if (!rrule) return '';
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

  private serializeTimezone(tz: VTimezone): string[] {
    const lines: string[] = ['BEGIN:VTIMEZONE'];
    lines.push(`TZID:${tz.tzid}`);
    // Simplified — full VTIMEZONE serialization would include STANDARD/DAYLIGHT blocks
    lines.push('END:VTIMEZONE');
    return lines;
  }
}
