#!/usr/bin/env node
/**
 * Clockwork MCP Server
 * Exposes all Clockwork calendar reasoning tools as MCP endpoints.
 *
 * Usage: npx @clockwork-ai/mcp
 * Or:    node dist/index.js
 *
 * Configure in Claude Desktop / Hermes / Cursor:
 * {
 *   "mcpServers": {
 *     "clockwork": {
 *       "command": "node",
 *       "args": ["/path/to/clockwork-ai/packages/mcp/dist/index.js"]
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  ICSParser,
  ICSSerializer,
  RRuleParser,
  RRuleExpander,
  RRuleValidator,
  ConflictDetector,
  findAvailableWindows,
  applyQuery,
  inDateRange,
  hasTag,
  TransactionManager,
  type Event,
  type CalendarFile,
} from '@clockwork-ai/core';

import * as fs from 'fs';

// ── Tools definitions ────────────────────────────────────────────────

const tools = [
  {
    name: 'validate_rrule',
    description: 'Validate an RFC 5545 RRULE string for syntax and constraint compliance.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        rrule: { type: 'string', description: 'RRULE string, e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12' },
      },
      required: ['rrule'],
    },
  },
  {
    name: 'resolve_recurrence',
    description: 'Expand an RRULE into concrete occurrence dates within a date range.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        rrule: { type: 'string', description: 'RRULE string' },
        from: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to: { type: 'string', description: 'End date YYYY-MM-DD' },
      },
      required: ['rrule', 'from', 'to'],
    },
  },
  {
    name: 'find_conflicts',
    description: 'Detect scheduling conflicts in an ICS calendar file on a specific date.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        calendar_path: { type: 'string', description: 'Path to .ics calendar file' },
        date: { type: 'string', description: 'Date to check YYYY-MM-DD' },
      },
      required: ['calendar_path', 'date'],
    },
  },
  {
    name: 'plan_windows',
    description: 'Find available time windows of a specified duration in a calendar.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        calendar_path: { type: 'string', description: 'Path to .ics calendar file' },
        date: { type: 'string', description: 'Target date YYYY-MM-DD' },
        duration_minutes: { type: 'number', description: 'Minimum window duration in minutes' },
        count: { type: 'number', description: 'Number of windows to find (default: 3)', default: 3 },
      },
      required: ['calendar_path', 'date', 'duration_minutes'],
    },
  },
  {
    name: 'create_event',
    description: 'Create a new calendar event (dry-run by default, pass commit=true to write).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string', description: 'Event summary/title' },
        start: { type: 'string', description: 'Start datetime YYYY-MM-DDTHH:MM (or YYYY-MM-DD for all-day)' },
        end: { type: 'string', description: 'End datetime YYYY-MM-DDTHH:MM' },
        calendar_path: { type: 'string', description: 'Path to .ics calendar file to write to' },
        description: { type: 'string', description: 'Optional event description' },
        location: { type: 'string', description: 'Optional event location' },
        commit: { type: 'boolean', description: 'Actually write to file (default: false = dry-run)' },
      },
      required: ['summary', 'start', 'end', 'calendar_path'],
    },
  },
  {
    name: 'query_events',
    description: 'Query events in a calendar with structured filters.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        calendar_path: { type: 'string', description: 'Path to .ics calendar file' },
        filter: { type: 'string', description: 'Filter type: "today", "this_week", "this_month", or a tag name' },
        tag: { type: 'string', description: 'Filter by category tag' },
        from: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to: { type: 'string', description: 'End date YYYY-MM-DD' },
      },
      required: ['calendar_path'],
    },
  },
  {
    name: 'create_mission',
    description: 'Create an agricultural mission event (planting, scouting, chemical, equipment, compliance).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        mission_type: { type: 'string', description: 'Mission type: planting, scouting, chemical, equipment, compliance' },
        calendar_path: { type: 'string', description: 'Path to .ics calendar file' },
        field: { type: 'string', description: 'Field identifier' },
        crop: { type: 'string', description: 'Crop name (planting)' },
        variety: { type: 'string', description: 'Crop variety (planting)' },
        window_start: { type: 'string', description: 'Window start date YYYY-MM-DD' },
        window_end: { type: 'string', description: 'Window end date YYYY-MM-DD' },
        observation_type: { type: 'string', description: 'Observation type (scouting)' },
        chemical_type: { type: 'string', description: 'Chemical type (chemical)' },
        target: { type: 'string', description: 'Target pest/weed (chemical)' },
        equipment_id: { type: 'string', description: 'Equipment ID (equipment)' },
        maintenance_type: { type: 'string', description: 'Maintenance type (equipment)' },
        compliance_type: { type: 'string', description: 'Compliance type (compliance)' },
        jurisdiction: { type: 'string', description: 'Jurisdiction (compliance)' },
        filing_deadline: { type: 'string', description: 'Filing deadline YYYY-MM-DD (compliance)' },
        commit: { type: 'boolean', description: 'Actually write to file (default: false = dry-run)' },
      },
      required: ['mission_type', 'calendar_path'],
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

function loadCalendar(calendarPath: string): CalendarFile {
  if (!fs.existsSync(calendarPath)) {
    return { filename: calendarPath, events: [], timezones: [], productId: undefined };
  }
  const content = fs.readFileSync(calendarPath, 'utf-8');
  const parser = new ICSParser();
  return parser.parse(content);
}

function saveCalendar(calFile: CalendarFile, calendarPath: string): void {
  const serializer = new ICSSerializer();
  const ics = serializer.serializeCalendar(calFile);
  fs.writeFileSync(calendarPath, ics, 'utf-8');
}

function buildEvent(opts: {
  summary: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  categories?: string[];
  xProperties?: Map<string, string>;
}): Event {
  const now = new Date();
  return {
    uid: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    summary: opts.summary,
    description: opts.description,
    location: opts.location,
    start: { date: opts.start, timezone: 'UTC', isAllDay: false },
    end: { date: opts.end, timezone: 'UTC', isAllDay: false },
    duration: Math.round((opts.end.getTime() - opts.start.getTime()) / 60000),
    categories: opts.categories ?? [],
    xProperties: opts.xProperties ?? new Map(),
    created: now,
    modified: now,
  };
}

// ── Server ───────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'clockwork-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ─── validate_rrule ─────────────────────────────────────
      case 'validate_rrule': {
        const rruleStr = args?.rrule as string;
        if (!rruleStr) throw new Error('rrule is required');

        const rruleParser = new RRuleParser();
        const validator = new RRuleValidator();

        let rrule;
        let parseError: string | null = null;
        try {
          rrule = rruleParser.parse(rruleStr);
        } catch (e: any) {
          parseError = e.message;
        }

        if (parseError) {
          return { content: [{ type: 'text', text: JSON.stringify({ valid: false, error: parseError }, null, 2) }] };
        }

        const validation = validator.validate(rrule!);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              valid: validation.valid,
              errors: validation.errors,
              parsed: {
                freq: rrule!.freq,
                interval: rrule!.interval,
                count: rrule!.count,
                until: rrule!.until?.toISOString(),
                byDay: rrule!.byDay?.map(d => d.position ? `${d.position}${d.day}` : d.day),
              },
            }, null, 2),
          }],
        };
      }

      // ─── resolve_recurrence ─────────────────────────────────
      case 'resolve_recurrence': {
        const rruleStr = args?.rrule as string;
        const fromStr = args?.from as string;
        const toStr = args?.to as string;
        if (!rruleStr || !fromStr || !toStr) {
          throw new Error('rrule, from, and to are required');
        }

        const rruleParser = new RRuleParser();
        const expander = new RRuleExpander();
        const rrule = rruleParser.parse(rruleStr);
        const from = new Date(fromStr);
        const to = new Date(toStr);

        const dates = expander.expand(rrule, from, from, to);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              rrule: rruleStr,
              count: dates.length,
              dates: dates.map(d => d.toISOString().slice(0, 10)),
            }, null, 2),
          }],
        };
      }

      // ─── find_conflicts ─────────────────────────────────────
      case 'find_conflicts': {
        const calendarPath = args?.calendar_path as string;
        const dateStr = args?.date as string;
        if (!calendarPath || !dateStr) throw new Error('calendar_path and date are required');

        const calendar = loadCalendar(calendarPath);
        const targetDate = new Date(dateStr);

        // Filter events on or overlapping target date
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);
        const dayEvents = applyQuery(calendar.events, inDateRange(targetDate, dayEnd));

        const detector = new ConflictDetector();
        const conflicts = detector.detectConflicts(dayEvents);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              date: dateStr,
              total_events: dayEvents.length,
              conflicts: conflicts.map(c => ({
                event_a: c.eventA.summary,
                event_b: c.eventB.summary,
                severity: c.severity,
                overlap_start: c.overlapStart.toISOString(),
                overlap_end: c.overlapEnd.toISOString(),
                resolution_options: c.resolutionOptions.map(r => ({
                  type: r.type,
                  description: r.description,
                })),
              })),
            }, null, 2),
          }],
        };
      }

      // ─── plan_windows ───────────────────────────────────────
      case 'plan_windows': {
        const calendarPath = args?.calendar_path as string;
        const dateStr = args?.date as string;
        const durationMinutes = args?.duration_minutes as number;
        const count = (args?.count as number) || 3;
        if (!calendarPath || !dateStr || !durationMinutes) {
          throw new Error('calendar_path, date, and duration_minutes are required');
        }

        const calendar = loadCalendar(calendarPath);
        const targetDate = new Date(dateStr);
        const windows = findAvailableWindows(targetDate, durationMinutes, calendar.events, count);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              date: dateStr,
              duration_minutes: durationMinutes,
              windows: windows.map(w => ({
                start: w.start.toISOString(),
                end: w.end.toISOString(),
                duration_minutes: w.durationMinutes,
                score: w.score,
              })),
            }, null, 2),
          }],
        };
      }

      // ─── create_event ───────────────────────────────────────
      case 'create_event': {
        const summary = args?.summary as string;
        const startStr = args?.start as string;
        const endStr = args?.end as string;
        const calendarPath = args?.calendar_path as string;
        const description = args?.description as string | undefined;
        const location = args?.location as string | undefined;
        const commit = args?.commit === true;

        if (!summary || !startStr || !endStr || !calendarPath) {
          throw new Error('summary, start, end, and calendar_path are required');
        }

        const start = new Date(startStr);
        const end = new Date(endStr);
        const event = buildEvent({ summary, start, end, description, location });

        const calendar = loadCalendar(calendarPath);

        // Dry-run: show what would happen
        if (!commit) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                mode: 'dry-run',
                summary: event.summary,
                start: event.start.date.toISOString(),
                end: event.end.date.toISOString(),
                duration_minutes: event.duration,
                message: 'Use commit=true to write this event.',
              }, null, 2),
            }],
          };
        }

        // Commit: write to calendar
        calendar.events.push(event);
        saveCalendar(calendar, calendarPath);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              mode: 'committed',
              uid: event.uid,
              summary: event.summary,
              start: event.start.date.toISOString(),
              end: event.end.date.toISOString(),
              calendar_path: calendarPath,
            }, null, 2),
          }],
        };
      }

      // ─── query_events ───────────────────────────────────────
      case 'query_events': {
        const calendarPath = args?.calendar_path as string;
        const filter = args?.filter as string | undefined;
        const tag = args?.tag as string | undefined;
        const fromStr = args?.from as string | undefined;
        const toStr = args?.to as string | undefined;

        if (!calendarPath) throw new Error('calendar_path is required');

        const calendar = loadCalendar(calendarPath);
        let filtered = [...calendar.events];

        // Apply tag filter
        if (tag) {
          filtered = applyQuery(filtered, hasTag(tag));
        }

        // Apply date range
        if (fromStr && toStr) {
          filtered = applyQuery(filtered, inDateRange(new Date(fromStr), new Date(toStr)));
        } else if (filter) {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const weekEnd = new Date(today.getTime() + 7 * 86400000);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

          switch (filter.toLowerCase()) {
            case 'today':
              filtered = applyQuery(filtered, inDateRange(today, new Date(today.getTime() + 86400000 - 1)));
              break;
            case 'this_week':
              filtered = applyQuery(filtered, inDateRange(today, weekEnd));
              break;
            case 'this_month':
              filtered = applyQuery(filtered, inDateRange(today, monthEnd));
              break;
            default:
              filtered = applyQuery(filtered, hasTag(filter));
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              total: filtered.length,
              events: filtered.map(e => ({
                uid: e.uid,
                summary: e.summary,
                start: e.start.date.toISOString(),
                end: e.end.date.toISOString(),
                duration_minutes: e.duration,
                categories: e.categories,
                status: e.status,
                location: e.location,
                has_rrule: !!e.rrule,
              })),
            }, null, 2),
          }],
        };
      }

      // ─── create_mission ─────────────────────────────────────
      case 'create_mission': {
        const missionType = args?.mission_type as string;
        const calendarPath = args?.calendar_path as string;
        const commit = args?.commit === true;

        if (!missionType || !calendarPath) {
          throw new Error('mission_type and calendar_path are required');
        }

        const validTypes = ['planting', 'scouting', 'chemical', 'equipment', 'compliance'];
        if (!validTypes.includes(missionType)) {
          throw new Error(`Invalid mission_type. Must be one of: ${validTypes.join(', ')}`);
        }

        const now = new Date();
        let summary = '';
        let start: Date;
        let end: Date;
        const xProps = new Map<string, string>();

        switch (missionType) {
          case 'planting': {
            const crop = args?.crop as string;
            const variety = args?.variety as string;
            const field = args?.field as string;
            const windowStart = args?.window_start as string;
            const windowEnd = args?.window_end as string;

            if (!crop || !variety || !field || !windowStart || !windowEnd) {
              throw new Error('planting requires: crop, variety, field, window_start, window_end');
            }

            start = new Date(windowStart);
            end = new Date(windowEnd);
            summary = `${crop} planting (${variety}) - ${field}`;
            xProps.set('X-CLOCKWORK-AGRICAL-CROP', crop);
            xProps.set('X-CLOCKWORK-AGRICAL-VARIETY', variety);
            xProps.set('X-CLOCKWORK-AGRICAL-FIELD', field);
            xProps.set('X-CLOCKWORK-AGRICAL-WINDOW-START', windowStart);
            xProps.set('X-CLOCKWORK-AGRICAL-WINDOW-END', windowEnd);
            break;
          }

          case 'scouting': {
            const field = args?.field as string;
            const observationType = args?.observation_type as string;
            const windowStart = args?.window_start as string;

            if (!field || !observationType) {
              throw new Error('scouting requires: field, observation_type');
            }

            start = windowStart ? new Date(windowStart) : now;
            end = new Date(start.getTime() + 2 * 3600000);
            summary = `Scouting: ${observationType} on ${field}`;
            xProps.set('X-CLOCKWORK-AGRICAL-OBSERVATION-TYPE', observationType);
            xProps.set('X-CLOCKWORK-AGRICAL-FIELD', field);
            break;
          }

          case 'chemical': {
            const field = args?.field as string;
            const chemicalType = args?.chemical_type as string;
            const target = args?.target as string;

            if (!field || !chemicalType || !target) {
              throw new Error('chemical requires: field, chemical_type, target');
            }

            start = now;
            end = new Date(start.getTime() + 3 * 3600000);
            summary = `${chemicalType} application on ${field}`;
            xProps.set('X-CLOCKWORK-AGRICAL-CHEMICAL-TYPE', chemicalType);
            xProps.set('X-CLOCKWORK-AGRICAL-TARGET', target);
            xProps.set('X-CLOCKWORK-AGRICAL-FIELD', field);
            break;
          }

          case 'equipment': {
            const equipmentId = args?.equipment_id as string;
            const maintenanceType = args?.maintenance_type as string;

            if (!equipmentId || !maintenanceType) {
              throw new Error('equipment requires: equipment_id, maintenance_type');
            }

            start = now;
            end = new Date(start.getTime() + 2 * 3600000);
            summary = `Equipment ${maintenanceType}: ${equipmentId}`;
            xProps.set('X-CLOCKWORK-AGRICAL-EQUIPMENT-ID', equipmentId);
            xProps.set('X-CLOCKWORK-AGRICAL-MAINTENANCE-TYPE', maintenanceType);
            break;
          }

          case 'compliance': {
            const complianceType = args?.compliance_type as string;
            const jurisdiction = args?.jurisdiction as string;
            const filingDeadline = args?.filing_deadline as string;

            if (!complianceType || !jurisdiction || !filingDeadline) {
              throw new Error('compliance requires: compliance_type, jurisdiction, filing_deadline');
            }

            start = new Date(filingDeadline);
            end = new Date(start.getTime() + 60 * 60000);
            summary = `Compliance: ${complianceType} (${jurisdiction})`;
            xProps.set('X-CLOCKWORK-AGRICAL-COMPLIANCE-TYPE', complianceType);
            xProps.set('X-CLOCKWORK-AGRICAL-JURISDICTION', jurisdiction);
            xProps.set('X-CLOCKWORK-AGRICAL-FILING-DEADLINE', filingDeadline);
            break;
          }

          default:
            throw new Error(`Unknown mission type: ${missionType}`);
        }

        const event = buildEvent({
          summary,
          start: start!,
          end: end!,
          categories: [missionType],
          xProperties: xProps,
        });

        if (!commit) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                mode: 'dry-run',
                mission_type: missionType,
                summary: event.summary,
                start: event.start.date.toISOString(),
                end: event.end.date.toISOString(),
                x_properties: Object.fromEntries(xProps),
                message: 'Use commit=true to write this mission.',
              }, null, 2),
            }],
          };
        }

        // Commit
        const calendar = loadCalendar(calendarPath);
        calendar.events.push(event);
        saveCalendar(calendar, calendarPath);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              mode: 'committed',
              uid: event.uid,
              mission_type: missionType,
              summary: event.summary,
              start: event.start.date.toISOString(),
              end: event.end.date.toISOString(),
              calendar_path: calendarPath,
            }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true,
    };
  }
});

// ── Boot ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Clockwork MCP server failed to start:', err);
  process.exit(1);
});
