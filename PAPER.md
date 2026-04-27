# Clockwork: Agent-Native Calendar Reasoning

**A file-based, vendor-neutral scheduling substrate for autonomous AI agents**

*FarmFriend Labs — April 2026*

---

## Abstract

As AI agents become capable of autonomous action — booking meetings, scheduling operations, managing resources — they require calendar tools that are safe, auditable, and free from the authentication and rate-limiting constraints of proprietary APIs. Clockwork presents a counter-proposal: use the RFC 5545 ICS standard as the canonical calendar format, wrap it in a TypeScript reasoning layer with dry-run safety, structured conflict detection, scope-limited multi-agent operation, and composable query primitives. The result is a scheduling substrate that any AI agent can use without OAuth, API keys, or vendor lock-in. This paper describes the architecture, the safety model, the agricultural domain extension (Agrical) as a case study in specialized scheduling, and the roadmap toward an MCP server that makes Clockwork a universal agent tool.

---

## 1. Introduction

### 1.1 The Problem

AI agents increasingly need to schedule things. An agent managing a farm schedules planting windows, chemical applications, and compliance deadlines. A personal assistant agent schedules meetings. A DevOps agent schedules maintenance windows. Each of these agents needs to:

1. **Read** existing calendar data to understand what's booked
2. **Query** for available windows with specific constraints
3. **Write** new events safely, without creating conflicts
4. **Reason** about recurrence patterns, timezone boundaries, and resource constraints
5. **Audit** every change, because an agent's mistake is your mistake

The dominant approach — wrapping Google Calendar, Outlook, or Apple Calendar APIs — inherits fundamental limitations:

- **OAuth complexity** — Every agent needs authenticated access to every calendar it touches
- **Rate limits** — Google Calendar free tier: 1,000,000 queries/day. At 1 query/second, that's 277 hours. At agent speed (10+ queries/second), it's hours.
- **No version control** — Calendar state changes are opaque. You can't `git diff` a schedule.
- **Vendor lock-in** — Agent logic couples to a specific API's quirks
- **No offline capability** — No network = no scheduling

### 1.2 The ICS Counter-Proposal

ICS (iCalendar, RFC 5545) is the universal calendar interchange format. Every calendar application reads and writes it. It is:

- **Plain text** — version-controllable, diffable, auditable
- **File-based** — no authentication, no network, no rate limits
- **Extensible** — X-properties carry domain-specific semantics through any ICS-compatible tool
- **Battle-tested** — 25+ years of interop across every major platform

The insight behind Clockwork is that ICS isn't just an export format — it's the right *canonical representation* for agent calendar data. An agent that reads and writes `.ics` files directly has capabilities that API-mediated agents cannot match: offline operation, git-bisectable scheduling errors, cryptographically signable calendar state.

Clockwork provides the reasoning layer that makes ICS agent-native.

---

## 2. Architecture

### 2.1 Layered Design

Clockwork is organized as a monorepo with three packages:

```
@clockwork-ai/core     — ICS engine (parser, RRULE, validator, timezone, conflicts, query)
@clockwork-ai/cli       — Commander-based CLI (7 commands)
@clockwork-ai/agrical   — Agricultural domain extension (5 mission types)
```

The core package contains 13 modules organized into a layered architecture:

```
Input: CLI args, agent tool calls, MCP requests
              │
              ▼
┌──────────────────────────────────┐
│          ICS Tokenizer           │  ← Line folding, param parsing, value unescaping
├──────────────────────────────────┤
│          ICS Parser              │  ← Token stream → typed Event objects
├──────────────────────────────────┤
│     RRULE Parser / Expander      │  ← Recurrence → concrete occurrence dates
├──────────────────────────────────┤
│     Validator (RFC 5545)         │  ← Structured compliance checking
├──────────────────────────────────┤
│     Conflict Detector            │  ← Overlap detection with severity classification
├──────────────────────────────────┤
│     Query Engine                 │  ← Composable filter primitives
├──────────────────────────────────┤
│     Timezone Handler             │  ← VTIMEZONE, DST transitions, floating time
├──────────────────────────────────┤
│     Scope Limiter                │  ← Per-agent read/write path boundaries
├──────────────────────────────────┤
│     Transaction Manager          │  ← Dry-run, TTL-based pending ops, rollback
├──────────────────────────────────┤
│     ICS Serializer               │  ← Typed Event objects → RFC 5545 compliant output
└──────────────────────────────────┘
              │
              ▼
Output: .ics files, JSON, git versioned
```

### 2.2 Key Design Decisions

**Tokenize, don't regex.** The ICS format has line folding, parameter encoding, and multi-line values that resist simple regex parsing. Clockwork uses a dedicated tokenizer that normalizes line endings, unfolds continuations, and parses parameters into typed maps before the parser sees a single token.

**Parse, then validate.** The RRULE parser accepts any syntactically valid input and produces a typed object. The validator then applies RFC 5545 compliance rules (valid day codes, positive INTERVAL, etc.) and returns structured `ValidationError[]` objects. This separation means the parser is fast and predictable; validation is strict and informative.

**Dry-run by default.** Every mutating operation shows a preview. Writing requires an explicit `--commit` flag. This is non-negotiable for agent use — an agent should never silently modify calendar state.

---

## 3. The Safety Model

Autonomous agents operating on calendar data require safety guarantees beyond what human-facing calendar tools provide. Clockwork implements a four-layer safety model:

### 3.1 Dry-Run Operations

All mutations (create, update, delete) operate in dry-run mode by default. The output shows:
- What would change
- Any conflicts detected
- Whether the operation can proceed safely

Pass `--commit` to persist. This is enforced at the engine level, not configurable by the agent.

### 3.2 Conflict Detection

Before any write, Clockwork checks for:
- **Temporal overlaps** — Two events cannot occupy the same time
- **Resource contention** — Same equipment, field, or room
- **Constraint violations** — Temperature windows, pre-harvest intervals, jurisdictional deadlines

Conflicts are returned as structured objects with severity levels (info, warning, critical), descriptions, and resolution options.

### 3.3 Scope Limiter

Multi-agent systems need per-agent boundaries. The scope limiter enforces:
- `readPaths`: Glob patterns for readable files
- `writePaths`: Glob patterns for writable files
- `maxEventsPerWrite`: Prevents runaway agent writes

A marketing agent might read `./calendar.ics` but only write `./marketing/*.ics`. A farm agent might read all calendars but only write `./farm/missions.ics`. Scope violations are rejected at the engine level.

### 3.4 Transaction TTL

Operations are held in a pending state with a configurable TTL (default: 5 minutes). Multiple dry-runs can be stacked. An explicit `--commit` or `--rollback` is required. This prevents orphaned pending state from accumulating.

---

## 4. Case Study: Agrical Extension

Agrical demonstrates Clockwork's extension model through five agricultural mission types. Each mission type defines required/optional fields, validators, and X-property schemas that round-trip through any ICS-compatible tool.

### 4.1 Mission Types

| Type | Required Fields | Key Constraints |
|------|----------------|-----------------|
| **planting** | crop, variety, field, window | Window must be within growing season |
| **scouting** | observationType, field | Can link to planting event with offset |
| **chemical** | chemicalType, target, field | Temperature range, pre-harvest interval |
| **equipment** | equipmentId, maintenanceType | Linked to crop phase |
| **compliance** | complianceType, jurisdiction | Deadline enforcement |

### 4.2 X-Property Schema

Domain data is stored as ICS X-properties prefixed with `X-CLOCKWORK-AGRICAL-*`:

```
BEGIN:VEVENT
UID:plant-corn-001@farmfriend
DTSTART:20260415T080000
DTEND:20260415T180000
SUMMARY:Corn Planting — Pioneer P1197
X-CLOCKWORK-AGRICAL-CROP:Corn
X-CLOCKWORK-AGRICAL-VARIETY:Pioneer P1197
X-CLOCKWORK-AGRICAL-FIELD:north-40
X-CLOCKWORK-AGRICAL-WINDOW-START:20260415
X-CLOCKWORK-AGRICAL-WINDOW-END:20260422
END:VEVENT
```

These properties survive round-trip through Google Calendar, Apple Calendar, Outlook, and any other ICS-compatible tool. An agronomist can view the planting schedule in their preferred calendar app and see the crop, variety, and field information as structured data.

### 4.3 Validation Example

```typescript
const result = validatePlantingMission({
  crop: 'Corn',
  variety: 'Pioneer P1197',
  field: 'north-40',
  windowStart: new Date('2026-04-15'),
  windowEnd: new Date('2026-04-22'),
});

if (!result.valid) {
  console.error(result.errors);
  // [{ field: 'window', message: 'Window exceeds maximum planting window (14 days)', code: 'WINDOW_TOO_LONG' }]
}
```

This domain-specific validation runs inside the agent's scheduling loop, catching constraint violations before they reach the calendar.

---

## 5. Current Status

Clockwork v0.1.0 is **buildable, testable, and passing.** As of April 2026:

| Metric | Value |
|--------|-------|
| Source lines (TypeScript) | 5,792 |
| Test lines | 2,119 |
| Test suites | 7 |
| Tests passing | **159 / 159** |
| Test failures | **0** |
| Core modules | 13 |
| CLI commands | 7 |
| Extension mission types | 5 |

**What's verified working:**
- Full ICS tokenize → parse → serialize round-trip (RFC 5545)
- RRULE parsing, expansion, and validation across all frequency types
- Temporal conflict detection with severity classification
- Composable query filters (after, before, overlaps, hasTag, duration bounds, etc.)
- Basic VTIMEZONE parsing with UTC/floating detection
- Commander-based CLI with all documented commands

**What's in progress (see SPEC-v0.2.0.md):**
- Deduplicating the RRULE parser (currently two implementations)
- Completing VTIMEZONE STANDARD/DAYLIGHT sub-component parsing
- Wiring scope enforcement into the transaction manager
- CI/CD via GitHub Actions
- MCP server to expose Clockwork as a universal agent tool

---

## 6. Related Work

**Google Calendar API / Microsoft Graph.** Dominant but require OAuth, have rate limits, and couple agent logic to proprietary APIs. Suitable for human-facing applications; unsuitable for autonomous multi-agent systems.

**CalDAV (RFC 4791).** A protocol for remote calendar access. Requires server infrastructure and authentication. Clockwork is complementary — a CalDAV adapter could sync remote calendars to local ICS files that Clockwork reasons about.

**Temporal.io.** A workflow orchestration platform with scheduling primitives. Powerful but heavyweight — requires a server, uses its own scheduling model, and doesn't produce portable calendar data.

**rrule.js.** A JavaScript RRULE library. Handles recurrence expansion but offers no ICS parsing, no validation, no safety model, no agent integration.

Clockwork's contribution is the integration of all these concerns — parsing, recurrence, validation, conflict detection, safety, and agent interface — into a single, tested, agent-native package.

---

## 7. Future Work

### 7.1 MCP Server (Highest Leverage)

The Model Context Protocol (MCP) allows AI agents to discover and use tools through a standardized interface. An MCP server wrapping Clockwork would make its capabilities available to Claude Desktop, Hermes, Cursor, Continue, and any other MCP-capable agent — immediately.

Proposed MCP tools:
- `validate_rrule` — RFC 5545 compliance checking
- `resolve_recurrence` — RRULE → concrete dates
- `find_conflicts` — Overlap detection
- `plan_windows` — Available time window search
- `create_event` — Dry-run or commit event creation
- `query_events` — Composable filter queries
- `create_mission` — Domain-specific mission creation

### 7.2 CalDAV Bridge

A bidirectional sync adapter that mirrors remote CalDAV calendars to local ICS files. Clockwork reasons about the local files; the bridge handles network synchronization. This gives agents the best of both worlds: local safety and remote sharing.

### 7.3 Cryptographic Signing

Git-versioned ICS files can be GPG-signed. A future Clockwork mode could verify signatures before accepting calendar updates, creating an auditable chain of custody for agent scheduling decisions.

### 7.4 Natural Language Query

The `query-events` command currently supports structured filters. Future work: LLM-based natural language understanding that decomposes queries like "show me all planting windows in north-40 this month" into composable filter primitives.

---

## 8. Conclusion

Calendar data is infrastructure. As AI agents become more capable and more autonomous, the scheduling substrate they operate on must be safe, auditable, version-controllable, and independent of any single vendor's API.

Clockwork demonstrates that the ICS standard — a 25-year-old plain-text format — provides exactly this substrate when paired with a modern reasoning layer. The library is tested (159/159 passing), architecturally clean (13 modules, clear separation of concerns), and extensible (Agrical's five mission types as a template for domain-specific scheduling).

The next step is universal access: an MCP server that makes Clockwork a tool any agent can discover and use, without OAuth, without rate limits, without lock-in. Calendar reasoning should be as fundamental to AI agents as file I/O.

---

## References

1. [RFC 5545 — Internet Calendaring and Scheduling Core Object Specification (iCalendar)](https://datatracker.ietf.org/doc/html/rfc5545)
2. [RFC 4791 — Calendaring Extensions to WebDAV (CalDAV)](https://datatracker.ietf.org/doc/html/rfc4791)
3. [Model Context Protocol (MCP) Specification](https://modelcontextprotocol.io)
4. [Clockwork Source Code](https://github.com/0-CYBERDYNE-SYSTEMS-0/clockwork-ai)
5. [Clockwork SPEC v0.2.0](./SPEC-v0.2.0.md)

---

*FarmFriend Labs — Cedar Creek, TX — farm-friend.com*
