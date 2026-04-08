# Clockwork Agent Onboarding Guide

Welcome, AI agent. This guide explains how to use Clockwork as a skill for calendar reasoning and agricultural mission management.

## Overview

Clockwork provides ICS-native calendar reasoning tools. It reads, writes, queries, and validates calendar data using the RFC 5545 ICS standard as the canonical format.

**Key Benefits:**
- No authentication required (file-based)
- Works offline
- Git-versionable calendar data
- Dry-run by default (safe exploration)
- Structured conflict detection

---

## Available Commands

### validate-rrule

Validates an RRULE string syntax and constraints.

```
clockwork validate-rrule "FREQ=MONTHLY;BYDAY=1MO;COUNT=12"
```

**Returns:** `valid: true/false` and any error messages.

**Example agent prompt:**
> "Validate this recurrence rule: FREQ=WEEKLY;BYDAY=TU,TH;INTERVAL=2;UNTIL=20260630"

---

### resolve-recurrence

Expands an RRULE to concrete occurrence dates within a date range.

```
clockwork resolve-recurrence --rrule "FREQ=WEEKLY;BYDAY=MO,WE,FR" --from 2026-04-01 --to 2026-06-30
```

**Example agent prompt:**
> "Show me all occurrences of the Monday/Wednesday/Friday weekly meeting between April 1 and June 30, 2026"

---

### find-conflicts

Detects overlapping events in a calendar.

```
clockwork find-conflicts --calendar ./missions.ics --on 2026-04-18
```

**Returns:** Structured conflict objects with severity levels and resolution options.

**Example agent prompt:**
> "Are there any scheduling conflicts on April 18th in the farm missions calendar?"

---

### plan-windows

Finds available time windows of a specified duration.

```
clockwork plan-windows --calendar ./missions.ics --on 2026-04-20 --duration 3h --count 3
```

**Example agent prompt:**
> "Find me 3 available 3-hour windows on April 20th for a chemical application"

---

### create-event

Creates a new calendar event (dry-run by default).

```
clockwork create-event --summary "Corn planting" --start 2026-04-15T08:00 --end 2026-04-15T18:00 --calendar ./missions.ics
```

Use `--commit` to actually write the event.

**Example agent prompt:**
> "Create a corn planting event for April 15th from 8am to 6pm in the farm calendar"

---

### query-events

Queries events using natural language or structured filters.

```
clockwork query-events --calendar ./missions.ics --filter "planting windows this month"
```

**Example agent prompt:**
> "Show me all scouting missions in the north-40 field"

---

### create-mission (Agrical Extension)

Creates an Agrical mission type with domain-specific validation.

```
clockwork create-mission planting --crop corn --variety "Pioneer P1197" --field north-40 --window 2026-04-15/2026-04-22 --calendar ./farm-missions.ics
```

**Mission types:**
- `planting` — Crop planting windows
- `scouting` — Field observation missions
- `chemical` — Chemical applications with temperature constraints
- `equipment` — Maintenance scheduling
- `compliance` — Regulatory deadlines

---

## Safety Model

### Dry-Run by Default

Every mutating command (create, update, delete) operates in dry-run mode unless you explicitly pass `--commit`.

**Dry-run output shows:**
- What would change
- Any conflicts detected
- Whether the operation can proceed

### Conflict Detection

Before any write, Clockwork checks for:
- Temporal overlaps (two events at the same time)
- Resource contention (same equipment/field)
- Constraint violations (temperature windows, pre-harvest intervals)

### Transaction System

Operations are held in a pending state with TTL:
- Default TTL: 5 minutes
- Can stack multiple dry-runs
- Explicit `--commit` or `--rollback` required

### Scope Limiter

Agents operate within enforced boundaries:
- `readPaths`: Glob patterns for readable files
- `writePaths`: Glob patterns for writable files
- `maxEventsPerWrite`: Prevents runaway writes

Scope is enforced at the engine level, not configurable by the agent.

---

## Extension Model

Clockwork uses ICS X-properties for domain extensions. These are:
- Round-trip safe (parse → serialize → parse = identical)
- Validated against domain rules
- Type-specific fields and constraints

### Agrical X-Property Prefix
All Agrical properties use: `X-CLOCKWORK-AGRICAL-*`

### Creating Custom Extensions

1. Define mission types with required/optional fields
2. Implement validators for domain constraints
3. Register with the MissionRegistry
4. X-properties ensure ICS round-trip compatibility

---

## Example Agent Prompts

### Agricultural Planning

> "Create a planting window for corn variety Pioneer P1197 in field north-40, scheduled for April 15-22. Then schedule a scouting mission for 14 days after the planting window ends."

> "Find all chemical application windows in May that have temperature constraints between 15-25°C and are not within pre-harvest intervals."

> "List all equipment maintenance tasks due this month and check if any conflict with active field operations."

### Calendar Reasoning

> "Find the next available 4-hour window for a team meeting that doesn't conflict with any existing events."

> "Validate that the FREQ=DAILY;INTERVAL=2 recurrence doesn't produce any conflicts with the existing schedule."

> "Show me all events in the compliance calendar that have deadlines in Q2 2026."

---

## Output Formats

| Flag | Output | Use Case |
|------|--------|----------|
| (default) | Human-readable with colors | Interactive exploration |
| `--json` | Structured JSON | Automation, API responses |
| `--quiet` | Minimal | Piping to other tools |

---

## Error Handling

Clockwork fails gracefully:
- LLM unavailable for NL queries → Falls back to structured date filters
- Timezone data missing → Uses UTC
- Invalid ICS → Returns parse errors with line numbers
- Scope violation → Rejects operation with clear reason

---

## File Structure

```
calendar.ics        # Your ICS calendar file
events.json         # Optional JSON export
conflicts.log       # Conflict detection output
transactions/       # Pending transaction state
```

---

## Getting Help

- CLI Help: `clockwork --help`
- Command Help: `clockwork <command> --help`
- Report issues: [github.com/farmfriend-labs/clockwork-ai/issues](https://github.com/farmfriend-labs/clockwork-ai/issues)
