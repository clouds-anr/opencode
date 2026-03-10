# AGENTS.md

## Build/Lint/Test Commands

- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Test**: `npm run test`
- **Run a single test**: `npm run test -- -t <test_name>`

## Code Style Guidelines

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

```ts
// Good
const foo = 1
function journal(dir: string) {}

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Surface/Flavor Rules

This codebase serves multiple surfaces that share core code. **Changes to shared code must not break any surface.**

### Surfaces

| Surface | Entry Point | Activated By |
|---------|-------------|-------------|
| **CLI** (default) | `packages/opencode/src/index.ts` → `main()` | No env var needed |
| **ANR** (enterprise) | Same `index.ts` → `initializeANR()` | `OPENCODE_FLAVOR=anr` |
| **Desktop** | `packages/desktop/` → Tauri sidecar spawns `opencode serve` | Tauri app launch |
| **Web** | `packages/app/` → connects to `opencode serve` | `opencode web` command |

### Hard Rules

1. **Never assume `process.env` values are available at module load time.** ANR sets credentials and config vars (`AWS_ACCESS_KEY_ID`, `OPENCODE_API_ENDPOINT`, `OPENCODE_ANR_ID_TOKEN`) during `initializeANR()`, which runs AFTER module imports. Use dynamic getters (like `Flag.OPENCODE_API_ENDPOINT`) or read env vars at call time, not import time.

2. **Never remove or rename a field from `packages/anr-core/src/config/types.ts` without updating all consumers in `packages/opencode/src/index.ts`.** The ANR config type is the contract between the config loader and the CLI initialization. Breaking this type breaks the enterprise surface silently.

3. **Never change auth or credential logic in `packages/opencode/src/provider/provider.ts` without testing both ANR and CLI modes.** The Bedrock provider has separate credential paths: ANR uses `fromEnv()` with STS tokens, CLI uses `fromNodeProviderChain()` with profiles. Changing one path can break the other.

4. **Never change API routes in `packages/anr-core/src/integrations/` without verifying against the actual API Gateway.** Routes like `/model`, `/quota` are defined server-side and cannot be assumed from code alone.

5. **Guard all flavor-specific code with `process.env.OPENCODE_FLAVOR === "anr"` checks, not env var presence checks.** Env vars like `OPENCODE_API_ENDPOINT` may or may not be set depending on timing. The flavor check is always reliable.

6. **`Env.get()` reads a shallow copy of `process.env` taken at Instance creation time.** Values set via `process.env.X = ...` after Instance creation are NOT visible through `Env.get()`. For runtime-set values (ANR credentials, tokens), read `process.env` directly or use `Flag` dynamic getters.

7. **The `~/.local/share/opencode/auth.json` file persists across sessions.** If the CLI prompts for an API key and the user enters garbage, it gets saved and will override proper credential flows on every subsequent run until manually cleared.

### Danger Zone Files (shared across surfaces)

These files contain flavor-branching logic. Extra care required when editing:

- `packages/opencode/src/index.ts` — CLI + ANR entry, auth init, env var setup
- `packages/opencode/src/provider/models.ts` — model loading (API endpoint vs models.dev)
- `packages/opencode/src/provider/provider.ts` — Bedrock credential chains (ANR vs CLI)
- `packages/opencode/src/session/processor.ts` — token usage telemetry (ANR-only)
- `packages/opencode/src/cli/cmd/tui/worker.ts` — TUI worker (re-initializes ANR context)
- `packages/opencode/src/env/index.ts` — env var access (shallow copy caveat)
- `packages/opencode/src/flag/flag.ts` — dynamic getters for runtime env vars

### Testing Surfaces

When modifying any danger zone file:
- **CLI**: `bun run --cwd packages/opencode src/index.ts` (should start TUI normally)
- **ANR**: `OPENCODE_FLAVOR=anr bun run --cwd packages/opencode --conditions=browser src/index.ts` (should auth → fetch models → check quota → start TUI)
- **Desktop**: Build and launch Tauri app, verify sidecar starts
- **Web**: `opencode web` → verify browser UI connects

## Cursor Rules

- No specific Cursor rules found.

## Copilot Rules

- No specific Copilot rules found.
