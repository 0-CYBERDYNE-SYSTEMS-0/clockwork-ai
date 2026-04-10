/**
 * ICS Parser Tests
 */

import { ICSParser } from '../src/parser/ics-parser.js';
import { ICSSerializer } from '../src/parser/ics-serializer.js';

const MINIMAL_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Clockwork//EN
END:VCALENDAR`;

const ICS_WITH_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Clockwork//EN
BEGIN:VEVENT
UID:evt-12345
DTSTART:20260415T090000
DTEND:20260415T100000
SUMMARY:Corn Planting - Pioneer P1197
DESCRIPTION:Planting mission for north-40 field
LOCATION:north-40
CATEGORIES:planting
DTSTAMP:20260401T000000Z
CREATED:20260401T000000Z
END:VEVENT
END:VCALENDAR`;

const ICS_WITH_RECURRENCE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Clockwork//EN
BEGIN:VEVENT
UID:evt-recurring
DTSTART:20260415T090000
DTEND:20260415T100000
SUMMARY:Weekly Scouting Mission
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=12
CATEGORIES:scouting
DTSTAMP:20260401T000000Z
END:VEVENT
END:VCALENDAR`;

const ICS_WITH_XPROPS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Clockwork//EN
BEGIN:VEVENT
UID:evt-agrical
DTSTART:20260415T090000
DTEND:20260415T180000
SUMMARY:Corn Planting
CATEGORIES:planting
X-CLOCKWORK-AGRICAL-CROP:Corn
X-CLOCKWORK-AGRICAL-VARIETY:Pioneer P1197
X-CLOCKWORK-AGRICAL-FIELD:north-40
DTSTAMP:20260401T000000Z
END:VEVENT
END:VCALENDAR`;

describe('ICSParser', () => {
  let parser: ICSParser;

  beforeEach(() => {
    parser = new ICSParser();
  });

  describe('parse()', () => {
    it('parses minimal ICS calendar', () => {
      const calendar = parser.parse(MINIMAL_ICS);
      expect(calendar.productId).toContain('Clockwork');
      expect(calendar.events).toHaveLength(0);
      expect(calendar.timezones).toHaveLength(0);
    });

    it('parses ICS with VEVENT', () => {
      const calendar = parser.parse(ICS_WITH_EVENT);
      expect(calendar.events).toHaveLength(1);

      const event = calendar.events[0];
      expect(event.uid).toBe('evt-12345');
      expect(event.summary).toBe('Corn Planting - Pioneer P1197');
      expect(event.description).toBe('Planting mission for north-40 field');
      expect(event.location).toBe('north-40');
      expect(event.categories).toContain('planting');
    });

    it('extracts start and end dates from VEVENT', () => {
      const calendar = parser.parse(ICS_WITH_EVENT);
      const event = calendar.events[0];

      expect(event.start.date).toBeInstanceOf(Date);
      expect(event.end.date).toBeInstanceOf(Date);
      expect(event.duration).toBeGreaterThan(0);
    });

    it('parses RRULE from VEVENT', () => {
      const calendar = parser.parse(ICS_WITH_RECURRENCE);
      expect(calendar.events).toHaveLength(1);

      const event = calendar.events[0];
      expect(event.rrule).toBeDefined();
      expect(event.rrule!.freq).toBe('WEEKLY');
      expect(event.rrule!.count).toBe(12);
    });

    it('parses X-properties from VEVENT', () => {
      const calendar = parser.parse(ICS_WITH_XPROPS);
      expect(calendar.events).toHaveLength(1);

      const event = calendar.events[0];
      expect(event.xProperties.size).toBeGreaterThan(0);
      expect(event.xProperties.get('X-CLOCKWORK-AGRICAL-CROP')).toBe('Corn');
      expect(event.xProperties.get('X-CLOCKWORK-AGRICAL-VARIETY')).toBe('Pioneer P1197');
      expect(event.xProperties.get('X-CLOCKWORK-AGRICAL-FIELD')).toBe('north-40');
    });

    it('handles all-day events (DATE format)', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-allday
DTSTART;VALUE=DATE:20260415
DTEND;VALUE=DATE:20260416
SUMMARY:All Day Event
CATEGORIES:compliance
END:VEVENT
END:VCALENDAR`;

      const calendar = parser.parse(ics);
      expect(calendar.events).toHaveLength(1);
      expect(calendar.events[0].start.isAllDay).toBe(true);
    });

    it('handles multiple events', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-1
DTSTART:20260415T090000
DTEND:20260415T100000
SUMMARY:Event 1
END:VEVENT
BEGIN:VEVENT
UID:evt-2
DTSTART:20260415T110000
DTEND:20260415T120000
SUMMARY:Event 2
END:VEVENT
END:VCALENDAR`;

      const calendar = parser.parse(ics);
      expect(calendar.events).toHaveLength(2);
    });

    it('extracts PRODID', () => {
      const calendar = parser.parse(ICS_WITH_EVENT);
      expect(calendar.productId).toContain('Test');
    });

    it('parses ICS with CRLF line endings', () => {
      const ics = ICS_WITH_EVENT.replace(/\n/g, '\r\n');
      const calendar = parser.parse(ics);
      expect(calendar.events).toHaveLength(1);
    });
  });

  describe('round-trip', () => {
    it('serializes and re-parses an event', () => {
      const original = parser.parse(ICS_WITH_XPROPS);
      const serializer = new ICSSerializer();
      const serialized = serializer.serializeCalendar({
        filename: 'test.ics',
        events: original.events,
        timezones: original.timezones,
        productId: original.productId,
      });

      const reparsed = parser.parse(serialized);
      expect(reparsed.events).toHaveLength(1);
      expect(reparsed.events[0].uid).toBe(original.events[0].uid);
      expect(reparsed.events[0].summary).toBe(original.events[0].summary);
      expect(reparsed.events[0].xProperties.get('X-CLOCKWORK-AGRICAL-CROP')).toBe('Corn');
    });

    it('round-trips event with RRULE', () => {
      const original = parser.parse(ICS_WITH_RECURRENCE);
      const serializer = new ICSSerializer();
      const serialized = serializer.serializeCalendar({
        filename: 'test.ics',
        events: original.events,
        timezones: original.timezones,
        productId: original.productId,
      });

      const reparsed = parser.parse(serialized);
      expect(reparsed.events[0].rrule!.freq).toBe('WEEKLY');
      expect(reparsed.events[0].rrule!.count).toBe(12);
    });
  });

  describe('error handling', () => {
    it('handles empty ICS string', () => {
      const calendar = parser.parse('');
      expect(calendar.events).toHaveLength(0);
    });

    it('handles ICS without VCALENDAR wrapper', () => {
      const calendar = parser.parse('BEGIN:VEVENT\nUID:test\nEND:VEVENT');
      expect(calendar.events).toHaveLength(0);
    });

    it('handles VEVENT without required fields', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-minimal
END:VEVENT
END:VCALENDAR`;

      const calendar = parser.parse(ics);
      expect(calendar.events).toHaveLength(1);
      expect(calendar.events[0].uid).toBe('evt-minimal');
    });
  });
});

describe('ICSSerializer', () => {
  let serializer: ICSSerializer;
  let parser: ICSParser;

  beforeEach(() => {
    serializer = new ICSSerializer();
    parser = new ICSParser();
  });

  describe('serializeCalendar()', () => {
    it('produces valid ICS output', () => {
      const calendar = parser.parse(ICS_WITH_EVENT);
      const ics = serializer.serializeCalendar({
        filename: 'test.ics',
        events: calendar.events,
        timezones: calendar.timezones,
        productId: calendar.productId,
      });

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('END:VCALENDAR');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('VERSION:2.0');
    });

    it('includes PRODID', () => {
      const calendar = parser.parse(ICS_WITH_EVENT);
      const ics = serializer.serializeCalendar({
        filename: 'test.ics',
        events: calendar.events,
        timezones: calendar.timezones,
        productId: '-//Test//Clockwork//EN',
      });

      expect(ics).toContain('PRODID:-//Test//Clockwork//EN');
    });

    it('serializes event UID', () => {
      const calendar = parser.parse(ICS_WITH_EVENT);
      const ics = serializer.serializeCalendar({
        filename: 'test.ics',
        events: calendar.events,
        timezones: calendar.timezones,
        productId: undefined,
      });

      expect(ics).toContain('UID:evt-12345');
    });

    it('serializes X-properties', () => {
      const calendar = parser.parse(ICS_WITH_XPROPS);
      const ics = serializer.serializeCalendar({
        filename: 'test.ics',
        events: calendar.events,
        timezones: calendar.timezones,
        productId: undefined,
      });

      expect(ics).toContain('X-CLOCKWORK-AGRICAL-CROP:Corn');
    });
  });
});
