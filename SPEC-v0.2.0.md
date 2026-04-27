# Clockwork AI v0.2.0 — Production Build Spec

**Repository:** 0-CYBERDYNE-SYSTEMS-0/clockwork-ai
**Current:** v0.1.0 (proof-of-concept)  
**Target:** v0.2.0 (agent-trustable)

---

## Guiding Principle

For an AI agent to delegate scheduling to a tool, that tool must be **demonstrably correct**. v0.1.0 has the right architecture. v0.2.0 must close the trust gap.

---

## Task 1: Fix All 24 Failing Tests (CRITICAL)

5 test suites failing, 24/141 tests (17%). These are in the CORE scheduling modules — the worst place for failures.

### Files involved:
- `packages/core/tests/ics-parser.test.ts`
- `packages/core/tests/rrule.test.ts`
- `packages/core/tests/rrule-expander.test.ts`
- `packages/core/tests/rrule-parser.test.ts`
- `packages/core/tests/query.test.ts`

### Approach:
1. Run the failing tests, capture exact failure output
2. Diagnose each failure — most are likely:
   - `findAvailableWindows()` off-by-one in gap math (business hours 8am-6pm boundary cases)
   - RRULE expander edge cases for WEEKLY/MONTHLY with BYDAY positions
   - ICS parser round-trip fidelity for edge case formats
3. Fix the implementation code (NOT the tests — tests define correct behavior)
4. Re-run until all 141 pass, all 7 suites green

### Acceptance:
```bash
npm test   # ALL GREEN, zero failures
```

---

## Task 2: Deduplicate RRULE Parser (ARCHITECTURE)

`ICSParser` has a private `parseRRule()` method (lines 229-263 of `ics-parser.ts`) that duplicates the logic in `RRuleParser.parse()`. Two implementations of the same RFC 5545 spec.

### What to do:
1. In `ics-parser.ts`, remove the private `parseRRule()` and `parseByDay()` and `parseRRuleDate()` methods
2. Import `RRuleParser` from `../rrule/rrule-parser.js`
3. Replace all internal `this.parseRRule(value)` calls with a `RRuleParser` instance call
4. Delete dead code
5. Run tests to verify nothing broke

### Acceptance:
- Only ONE RRULE parsing implementation in the codebase
- All tests still pass (Task 1 must be complete first)
- No change in behavior

---

## Task 3: Add Real CLI Binary (DISTRIBUTION)

The README and AGENTS.md document `clockwork validate-rrule ...` as a CLI command, but there is no binary entry point.

### What to do:
1. Add `"bin": { "clockwork": "./dist/index.js" }` to `packages/cli/package.json`
2. Add `#!/usr/bin/env node` shebang to `packages/cli/src/index.ts` (first line)
3. Add `"type": "module"` if not already present
4. Verify: `npm run build && node packages/cli/dist/index.js --help` works
5. Optionally add `npm link` instructions to README

### Acceptance:
```bash
cd packages/cli && npm run build
node dist/index.js --version   # outputs "0.1.0" or similar
node dist/index.js --help      # lists available commands
```

---

## Task 4: Complete VTIMEZONE Parsing (CORRECTNESS)

The parser reads TZID but never parses STANDARD/DAYLIGHT sub-components. Without this, recurring events across DST boundaries produce wrong times.

### What to do:
1. In `ics-parser.ts`, the `parseTimezone()` method currently sets `standard` and `daylight` to `undefined`
2. Implement proper parsing:
   - When encountering `BEGIN:STANDARD` inside VTIMEZONE, parse the sub-component
   - Extract DTSTART, TZOFFSETFROM, TZOFFSETTO, TZNAME, RRULE (if present)
   - Same for `BEGIN:DAYLIGHT`
3. Return a populated `VTimezone` object with actual standard/daylight data

### Acceptance:
- Parsing ICS with VTIMEZONE returns populated timezone data
- Test: feed a real VTIMEZONE block (e.g., America/Chicago), verify standard/daylight are populated

---

## Task 5: Wire Scope Enforcement into Transaction Manager (SAFETY)

The `ScopeLimiter` class exists but `TransactionManager.createDryRun()` never calls it. Operations proceed regardless of scope — defeating the multi-agent safety model.

### What to do:
1. In `packages/core/src/transaction/transaction.ts`:
   - Import `ScopeLimiter` from `../scope/scope.js`
   - Accept an optional `AgentScope` parameter in `createDryRun()`
   - Before processing operations, run each through `scopeLimiter.enforce()`
   - Reject operations that violate scope (return error in DryRunResult)
2. Update `DryRunResult` type to include scope violations if needed
3. Add tests for scoped vs unscoped operations

### Acceptance:
- Transaction with scoped agent rejects writes outside scope
- Default behavior (no scope passed) remains unchanged (backward compatible)

---

## Task 6: GitHub Actions CI (INFRASTRUCTURE)

The repo has tests but no CI. Every push should run tests.

### What to do:
Create `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

### Acceptance:
- CI file exists
- Push triggers test run on GitHub

---

## Bonus: MCP Server (HIGH LEVERAGE)

This is the highest-impact improvement. If Clockwork exposes an MCP server, *any* MCP-capable agent (Claude Desktop, Hermes, Continue, Cursor) can use it as a calendar reasoning tool immediately.

### What to do:
Create a new package `packages/mcp/` with:
1. A lightweight MCP server using `@modelcontextprotocol/sdk`
2. Expose these tools:
   - `validate_rrule(rrule: string)` → validation result
   - `resolve_recurrence(rrule: string, from: string, to: string)` → date list
   - `find_conflicts(calendar_path: string, date: string)` → conflict list
   - `plan_windows(calendar_path: string, date: string, duration_minutes: number, count: number)` → windows
   - `create_event(summary, start, end, calendar_path, commit?)` → dry-run or create
   - `query_events(calendar_path: string, filter: string)` → matching events
   - `create_mission(mission_type, ...params)` → mission event

3. Each MCP tool calls the core library directly
4. Add `"bin"` entry for standalone startup

### Acceptance:
- MCP server starts and responds to `list_tools`
- Each tool returns structured JSON matching core library output
- Can be tested with any MCP inspector

---

## Execution Order

1. **Task 1** (fix tests) — must be first, everything else depends on a green suite
2. **Task 2** (deduplicate parser) — safe refactor after tests are green
3. **Task 3** (CLI binary) — quick win
4. **Task 4** (timezone parsing) — correctness fix
5. **Task 5** (scope enforcement) — safety fix
6. **Task 6** (CI) — infrastructure
7. **Bonus** (MCP server) — highest leverage for adoption

Estimated: 4-6 hours total. Commit after each task.
