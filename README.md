# Clockwork

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/0-CYBERDYNE-SYSTEMS-0/clockwork-ai?style=flat)](https://github.com/0-CYBERDYNE-SYSTEMS-0/clockwork-ai/stargazers)

**ICS-native reasoning layer for AI agents**

Clockwork is an open-source TypeScript library and CLI tool that gives AI agents first-class, safe tools to read, write, query, edit, and reason about calendar data using the ICS standard (RFC 5545) as the canonical format.

GitHub: [github.com/0-CYBERDYNE-SYSTEMS-0/clockwork-ai](https://github.com/0-CYBERDYNE-SYSTEMS-0/clockwork-ai)

---

## Why ICS?

The ICS standard (RFC 5545) is the vendor-neutral, offline-capable, git-versionable calendar format that every major calendar application understands. Unlike proprietary APIs (Google Calendar, Microsoft Outlook), ICS allows AI agents to work with calendar data without authentication overhead, rate limiting, or vendor lock-in.

| Feature | Google Calendar | Outlook | ICS + Clockwork |
|---------|----------------|---------|-----------------|
| Authentication | OAuth required | OAuth required | None (file-based) |
| Rate Limits | Yes | Yes | No |
| Offline Support | Limited | Limited | Full |
| Git-versionable | No | No | Yes |
| Agent-native | No | No | Yes |
| Vendor Lock-in | High | High | None |

## Core Capabilities

- **RFC 5545 Compliant ICS Parser** — Parse and serialize any standard ICS file
- **Full RRULE Support** — Complex recurrence patterns (INTERVAL, UNTIL, COUNT, BYDAY, BYMONTHDAY, BYMONTH, EXDATE, RDATE)
- **Timezone Handling** — VTIMEZONE support, DST transitions, floating time events
- **Conflict Detection** — Structured conflict objects with resolution options
- **Transaction System** — Dry-run by default, TTL-based pending operations, rollback support
- **Scope Limiter** — Per-agent read/write boundaries for safe multi-agent operation
- **Query Engine** — Composable filter primitives for calendar reasoning
- **Domain Extensions** — Agrical (agriculture), and extensible plugin model
- **Dry-Run by Default** — Every mutation shows a preview before committing

---

## Quick Start

### Installation

```bash
# From source (monorepo)
git clone https://github.com/0-CYBERDYNE-SYSTEMS-0/clockwork-ai.git
cd clockwork-ai
npm install
npm run build
```

### CLI Usage

```bash
# Validate an RRULE
clockwork validate-rrule "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=52"

# Resolve recurrence to concrete dates
clockwork resolve-recurrence --rrule "FREQ=DAILY;INTERVAL=2" --from 2026-04-01 --to 2026-04-30

# Find conflicts in a calendar
clockwork find-conflicts --calendar ./missions.ics --on 2026-04-18

# Plan available time windows
clockwork plan-windows --calendar ./missions.ics --on 2026-04-20 --duration 3h --count 3

# Create an event (dry-run by default)
clockwork create-event --summary "Corn planting" --start 2026-04-15T08:00 --end 2026-04-15T18:00 --calendar ./missions.ics

# Query events with natural language
clockwork query-events --calendar ./missions.ics --filter "planting windows this month"

# Create an Agrical mission
clockwork create-mission planting --crop corn --variety "Pioneer P1197" --field north-40 --window 2026-04-15/2026-04-22 --calendar ./farm-missions.ics
```

### Library Usage

```typescript
import { parseICS, CalendarStore, composeFilters, after, hasTag } from '@clockwork-ai/core';
import { findConflicts } from '@clockwork-ai/core';
import { validateRRule } from '@clockwork-ai/core';

// Parse an ICS file
const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:123@example.com
SUMMARY:Team Meeting
DTSTART:20260415T090000
DTEND:20260415T100000
END:VEVENT
END:VCALENDAR`;

const events = parseICS(icsContent);

// Query events
const store = new CalendarStore(events);
const filtered = store.query(composeFilters(
  after(new Date('2026-04-01')),
  hasTag('planting')
));

// Validate RRULE
const result = validateRRule("FREQ=MONTHLY;BYDAY=1MO;COUNT=12");
console.log(result.valid); // true/false
```

---

## Architecture

```
Input Layer (CLI, AI Agent, MCP Server, subprocess)
         |
         v
  +------------------------------------------------------+
  |                      CORE ICS ENGINE                  |
  |  +----------+  +--------+  +-----------+  +---------+ |
  |  |  Parser  |  | RRULE  |  | Validator |  | Timezone| |
  |  +----------+  +--------+  +-----------+  +---------+ |
  |  +----------+  +--------+  +-----------+  +---------+ |
  |  | Conflicts |  |  Query |  |Transaction|  |  Scope  | |
  |  +----------+  +--------+  +-----------+  +---------+ |
  +------------------------------------------------------+
         |
         v
  +------------------------------------------------------+
  |                    EXTENSION MODEL                     |
  |  Plugin Interface  |  Mission Types  |  X-Properties  |
  +------------------------------------------------------+
         |
         v
  +------------------------------------------------------+
  |                   DOMAIN EXTENSIONS                   |
  |        Agrical       |        Legal        | ...     |
  +------------------------------------------------------+
         |
         v
Output: .ics files, JSON, git-versioned
```

---

## Extension Model

Clockwork supports domain-specific extensions via X-properties that round-trip through ICS:

### Agrical Extension

Agricultural mission types for farming operations:

- **Planting Windows** — Crop-specific planting schedules with variety tracking
- **Scouting Missions** — Field observation missions linked to plantings
- **Chemical Application** — Herbicide, insecticide, fungicide with temperature constraints
- **Equipment Maintenance** — Scheduled maintenance linked to crop phases
- **Compliance Deadlines** — Regulatory deadlines with jurisdiction tracking

---

## License

MIT License - Copyright (c) 2026 FarmFriend Labs

---

## Links

- GitHub: [github.com/0-CYBERDYNE-SYSTEMS-0/clockwork-ai](https://github.com/0-CYBERDYNE-SYSTEMS-0/clockwork-ai)
- Documentation: [github.com/0-CYBERDYNE-SYSTEMS-0/clockwork-ai#readme](https://github.com/0-CYBERDYNE-SYSTEMS-0/clockwork-ai#readme)
- Issues: [github.com/0-CYBERDYNE-SYSTEMS-0/clockwork-ai/issues](https://github.com/0-CYBERDYNE-SYSTEMS-0/clockwork-ai/issues)
