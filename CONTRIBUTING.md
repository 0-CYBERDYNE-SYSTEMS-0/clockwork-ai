# Contributing to Clockwork

Thank you for your interest in contributing to Clockwork! This document outlines the process for contributing to the project.

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/farmfriend-labs/clockwork-ai.git
cd clockwork-ai

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test
```

### Project Structure

```
clockwork-ai/
├── packages/
│   ├── core/                    # ICS engine (RFC 5545 parser, RRULE, etc.)
│   │   ├── src/
│   │   │   ├── parser/         # ICS tokenizer and parser
│   │   │   ├── rrule/          # RRULE expansion engine
│   │   │   ├── validator/      # RRULE and ICS validation
│   │   │   ├── timezone/       # VTIMEZONE handling
│   │   │   ├── conflicts/      # Overlap detection
│   │   │   ├── transaction/    # Transaction log, dry-run
│   │   │   ├── scope/          # Agent scope enforcement
│   │   │   ├── query/          # Filter primitives
│   │   │   └── index.ts
│   │   └── tests/
│   ├── cli/                    # Commander.js CLI
│   │   ├── src/
│   │   │   ├── commands/       # CLI commands
│   │   │   └── nl/            # Natural language wrapper
│   │   └── tests/
│   └── extensions/
│       └── agrical/           # Agricultural domain extension
│           ├── src/
│           │   ├── mission-types/
│           │   └── validators/
│           └── tests/
└── turbo.json                 # Build pipeline configuration
```

## Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Write your code following the existing style
- Add tests for new functionality
- Update documentation as needed

### 3. Test

```bash
# Run all tests
npm run test

# Run tests for a specific package
cd packages/core && npm run test
cd packages/cli && npm run test
cd packages/extensions/agrical && npm run test

# Build to check for type errors
npm run build
```

### 4. Commit

We use conventional commits. Please prefix your commits:

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `test:` — Adding or updating tests
- `refactor:` — Code refactoring
- `chore:` — Build process or tooling changes

Example:
```bash
git commit -m "feat(core): add BYDAY position support for RRULE expansion"
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Code Style

### TypeScript

- Strict mode enabled
- No `any` types
- Explicit return types on exported functions
- Use interfaces for object shapes
- Use type aliases for unions and intersections

### Naming Conventions

- PascalCase for types and interfaces
- camelCase for functions and variables
- UPPER_SNAKE_CASE for constants
- Prefix interfaces with `I` only when needed to avoid collision (e.g., `Event` vs `EventData`)

### File Organization

- One main export per directory (`index.ts`)
- Related utilities in separate files (e.g., `parser/tokenizer.ts`, `parser/vevent.ts`)
- Tests co-located with source (`src/parser/index.ts` → `tests/parser.test.ts`)

## Test Requirements

### Coverage Targets

- **Core package:** >= 80% coverage
- **CLI package:** Functional tests for all commands
- **Extensions:** Validation and round-trip tests

### Test Structure

```typescript
describe('RRULE Expansion', () => {
  it('should expand FREQ=DAILY;INTERVAL=2', () => {
    const rrule = parseRRule("FREQ=DAILY;INTERVAL=2");
    const occurrences = expandRRule(rrule, startDate, endDate);
    expect(occurrences).toHaveLength(/* expected count */);
  });

  it('should exclude dates from EXDATE', () => {
    // ...
  });
});
```

### ICS Round-Trip Testing

Every parser must pass round-trip testing:

```typescript
it('should round-trip ICS without data loss', () => {
  const original = `BEGIN:VCALENDAR...END:VCALENDAR`;
  const events = parseICS(original);
  const serialized = serializeICS(events);
  const reparsed = parseICS(serialized);
  
  expect(reparsed).toEqual(events);
});
```

## Pull Request Process

### PR Checklist

- [ ] Code follows the style guidelines
- [ ] Tests added or updated
- [ ] Documentation updated if needed
- [ ] All tests pass locally
- [ ] No merge conflicts with main branch

### Review Process

1. Automated checks (CI) must pass
2. At least one maintainer review required
3. Address reviewer feedback
4. Squash and merge when approved

## Reporting Issues

### Bug Reports

Include:
- Node.js version
- Package version
- Minimal reproduction case
- Expected vs actual behavior

### Feature Requests

Include:
- Problem you're trying to solve
- Proposed solution
- Alternative solutions considered

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Clockwork!
