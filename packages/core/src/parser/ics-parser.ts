/**
 * RFC 5545 ICS Parser
 * Converts tokenized ICS into typed Event objects
 */

import { ICSTokenizer } from './ics-tokenizer.js';
import type { Token } from './ics-tokenizer.js';
import type { Event, DateWithTz, RRule, VTimezone, TZComponent, CalendarFile } from '../types.js';
import { RRuleParser } from '../rrule/rrule-parser.js';

interface ParsedProperty {
  name: string;
  value: string;
  params: Map<string, string>;
}

export class ICSParser {
  private tokens: Token[] = [];
  private pos: number = 0;

  /**
   * Parse an ICS string into a CalendarFile
   */
  parse(ics: string): CalendarFile {
    const tokenizer = new ICSTokenizer(ics);
    this.tokens = tokenizer.tokenize();
    this.pos = 0;

    const calendar: CalendarFile = {
      filename: 'calendar.ics',
      events: [],
      timezones: [],
      productId: undefined,
    };

    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (token.type === 'EOF') break;

      if (token.type === 'BEGIN' && token.name === 'VCALENDAR') {
        this.advance();
        this.parseVCalendar(calendar);
      } else {
        this.advance();
      }
    }

    return calendar;
  }

  private parseVCalendar(calendar: CalendarFile): void {
    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (token.type === 'EOF') break;
      if (token.type === 'END' && token.name === 'VCALENDAR') {
        this.advance();
        break;
      }
      if (token.type === 'BEGIN') {
        this.advance();
        const componentName = token.name;
        if (componentName === 'VEVENT') {
          const event = this.parseEvent();
          if (event) calendar.events.push(event);
        } else if (componentName === 'VTIMEZONE') {
          const tz = this.parseTimezone();
          if (tz) calendar.timezones.push(tz);
        }
      } else if (token.type === 'CONTENTLINE' && token.name === 'PRODID') {
        calendar.productId = token.value;
        this.advance();
      } else {
        this.advance();
      }
    }
  }

  private parseEvent(): Event | null {
    const props = new Map<string, ParsedProperty>();

    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (token.type === 'EOF') break;
      if (token.type === 'END' && token.name === 'VEVENT') {
        this.advance();
        break;
      }
      if (token.type === 'CONTENTLINE') {
        props.set(token.name!, {
          name: token.name!,
          value: token.value ?? '',
          params: token.params ?? new Map(),
        });
      }
      this.advance();
    }

    return this.buildEvent(props);
  }

  private buildEvent(props: Map<string, ParsedProperty>): Event | null {
    const dtstart = props.get('DTSTART');
    const dtend = props.get('DTEND') || props.get('DURATION');
    const summary = props.get('SUMMARY')?.value ?? 'Untitled';
    const uid = props.get('UID')?.value ?? crypto.randomUUID();

    if (!dtstart) {
      // Lenient parsing: event without DTSTART — use epoch as fallback
      return {
        uid,
        summary,
        description: props.get('DESCRIPTION')?.value,
        location: props.get('LOCATION')?.value,
        start: { date: new Date(0), timezone: 'UTC', isAllDay: false },
        end: { date: new Date(0), timezone: 'UTC', isAllDay: false },
        duration: 0,
        categories: [],
        xProperties: new Map(),
        created: new Date(),
        modified: new Date(),
        sequence: 0,
        status: 'CONFIRMED',
      };
    }

    const start = this.parseDateTime(dtstart);
    let end: DateWithTz;

    if (dtend) {
      end = this.parseDateTime(dtend);
    } else if (dtstart.params?.get('VALUE') === 'DATE') {
      // All-day event: DTEND is exclusive end date
      const endDate = new Date(start.date);
      endDate.setDate(endDate.getDate() + 1);
      end = { date: endDate, timezone: start.timezone, isAllDay: true };
    } else {
      end = { date: new Date(start.date.getTime() + 60 * 60 * 1000), timezone: start.timezone, isAllDay: false };
    }

    const durationMs = end.date.getTime() - start.date.getTime();
    const duration = Math.round(durationMs / 60000);

    // Parse RRULE
    let rrule: RRule | undefined;
    const rruleProp = props.get('RRULE');
    if (rruleProp) {
      const parser = new RRuleParser();
      rrule = parser.parse(rruleProp.value);
    }

    // Parse EXDATE
    const exdates: Date[] = [];
    for (const [name, prop] of props) {
      if (name === 'EXDATE') {
        exdates.push(this.parseDateTime(prop).date);
      }
    }

    // Parse RDATE
    const rdates: Date[] = [];
    for (const [name, prop] of props) {
      if (name === 'RDATE') {
        rdates.push(this.parseDateTime(prop).date);
      }
    }

    // Parse categories
    const categories: string[] = [];
    const catProp = props.get('CATEGORIES');
    if (catProp) {
      categories.push(...catProp.value.split(',').map(c => c.trim()));
    }

    // Parse X-properties
    const xProperties = new Map<string, string>();
    for (const [name, prop] of props) {
      if (name.startsWith('X-')) {
        xProperties.set(name, prop.value);
      }
    }

    // Parse created/modified
    const createdProp = props.get('CREATED');
    const modifiedProp = props.get('LAST-MODIFIED');

    const created = createdProp ? new Date(createdProp.value) : new Date();
    const modified = modifiedProp ? new Date(modifiedProp.value) : new Date();

    return {
      uid,
      summary,
      description: props.get('DESCRIPTION')?.value,
      location: props.get('LOCATION')?.value,
      start,
      end,
      duration,
      rrule,
      exdates: exdates.length ? exdates : undefined,
      rdates: rdates.length ? rdates : undefined,
      categories,
      xProperties,
      created,
      modified,
      sequence: parseInt(props.get('SEQUENCE')?.value ?? '0', 10),
      status: this.parseStatus(props.get('STATUS')?.value),
    };
  }

  private parseDateTime(prop: ParsedProperty): DateWithTz {
    const value: string = prop.value;
    const params = prop.params;

    // Determine timezone
    let timezone = 'UTC';
    if (params?.has('TZID')) {
      timezone = params.get('TZID')!;
    }

    const isAllDay = params?.get('VALUE') === 'DATE' || !value.includes('T');

    let date: Date;
    if (isAllDay) {
      // DATE format: YYYYMMDD
      const year = parseInt(value.slice(0, 4), 10);
      const month = parseInt(value.slice(4, 6), 10) - 1;
      const day = parseInt(value.slice(6, 8), 10);
      date = new Date(year, month, day, 0, 0, 0, 0);
    } else {
      // DATETIME format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
      const year = parseInt(value.slice(0, 4), 10);
      const month = parseInt(value.slice(4, 6), 10) - 1;
      const day = parseInt(value.slice(6, 8), 10);
      const hour = parseInt(value.slice(9, 11), 10) || 0;
      const minute = parseInt(value.slice(11, 13), 10) || 0;
      const second = parseInt(value.slice(13, 15), 10) || 0;

      if (value.endsWith('Z')) {
        timezone = 'UTC';
        date = new Date(Date.UTC(year, month, day, hour, minute, second));
      } else {
        date = new Date(year, month, day, hour, minute, second);
      }
    }

    return { date, timezone, isAllDay };
  }

  private parseStatus(value?: string): Event['status'] {
    switch (value?.toUpperCase()) {
      case 'CONFIRMED': return 'CONFIRMED';
      case 'TENTATIVE': return 'TENTATIVE';
      case 'CANCELLED': return 'CANCELLED';
      default: return 'CONFIRMED';
    }
  }

  private parseTimezone(): VTimezone | null {
    let tzid = '';
    let standard: TZComponent | undefined;
    let daylight: TZComponent | undefined;

    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (token.type === 'EOF') break;
      if (token.type === 'END' && token.name === 'VTIMEZONE') {
        this.advance();
        break;
      }
      if (token.type === 'BEGIN') {
        const subName = token.name;
        this.advance();
        if (subName === 'STANDARD') {
          standard = this.parseTZComponent();
        } else if (subName === 'DAYLIGHT') {
          daylight = this.parseTZComponent();
        }
        continue;
      }
      if (token.type === 'CONTENTLINE') {
        if (token.name === 'TZID') {
          tzid = token.value ?? '';
        }
      }
      this.advance();
    }

    if (!tzid) return null;
    return { tzid, standard, daylight };
  }

  /**
   * Parse a STANDARD or DAYLIGHT sub-component inside VTIMEZONE
   */
  private parseTZComponent(): TZComponent {
    let tzoffsetFrom = '+0000';
    let tzoffsetTo = '+0000';
    let tzname = '';
    let dtstart = '';
    let rrule: string | undefined;
    let comment: string | undefined;

    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (token.type === 'EOF') break;
      if (token.type === 'END' && (token.name === 'STANDARD' || token.name === 'DAYLIGHT')) {
        this.advance();
        break;
      }
      if (token.type === 'CONTENTLINE') {
        switch (token.name) {
          case 'TZOFFSETFROM':
            tzoffsetFrom = token.value ?? '+0000';
            break;
          case 'TZOFFSETTO':
            tzoffsetTo = token.value ?? '+0000';
            break;
          case 'TZNAME':
            tzname = token.value ?? '';
            break;
          case 'DTSTART':
            dtstart = token.value ?? '';
            break;
          case 'RRULE':
            rrule = token.value;
            break;
          case 'COMMENT':
            comment = token.value;
            break;
        }
      }
      this.advance();
    }

    return { tzoffsetFrom, tzoffsetTo, tzname, dtstart, rrule, comment };
  }

  private current(): Token {
    return this.tokens[this.pos] ?? { type: 'EOF', line: 0 };
  }

  private advance(): void {
    this.pos++;
  }
}
