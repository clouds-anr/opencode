# OpenCode Technical Breakdown

This document provides a comprehensive technical breakdown of the OpenCode project structure, architecture, and build process. It's designed to help developers understand the codebase and identify integration points for features like AWS Cognito SSO, OpenTelemetry tracking, token usage API, and backend database connections.

## Table of Contents

- [Project Overview](#project-overview)
- [Repository Structure](#repository-structure)
- [Core Components](#core-components)
- [Build Process](#build-process)
- [Infrastructure & Deployment](#infrastructure--deployment)
- [Integration Points](#integration-points)

## Project Overview

**OpenCode** is an open-source AI-powered coding agent with:
- **CLI Interface**: Terminal-based TUI (Terminal User Interface)
- **Web Application**: Browser-based interface
- **Desktop Application**: Native app built with Tauri
- **API Server**: Headless server for integration
- **Console**: Management dashboard (OpenCode Zen)

### Technology Stack

- **Runtime**: Bun 1.3+ (JavaScript runtime)
- **Language**: TypeScript
- **Build System**: Turbo (monorepo), Bun's native build
- **Frontend**: SolidJS
- **TUI**: OpenTUI (SolidJS-based terminal UI)
- **Backend**: Hono (web framework)
- **Database**: SQLite (local), PlanetScale MySQL (cloud)
- **Infrastructure**: SST (Serverless Stack), Cloudflare Workers
- **Desktop**: Tauri 2

## Repository Structure

```
opencode/
├── packages/                    # Monorepo packages
│   ├── opencode/               # Core CLI & server (main package)
│   ├── app/                    # Shared web UI components
│   ├── desktop/                # Tauri desktop application
│   ├── web/                    # Documentation website (Astro)
│   ├── console/                # OpenCode Zen dashboard
│   │   ├── app/               # Console frontend (SolidStart)
│   │   ├── core/              # Console business logic
│   │   ├── function/          # Serverless functions
│   │   └── resource/          # Shared resources
│   ├── sdk/js/                # JavaScript SDK
│   ├── plugin/                # Plugin system (@opencode-ai/plugin)
│   ├── script/                # Build scripts package
│   ├── util/                  # Shared utilities
│   ├── ui/                    # Shared UI components
│   ├── function/              # API serverless functions
│   ├── identity/              # Identity management
│   ├── enterprise/            # Enterprise features
│   ├── slack/                 # Slack integration
│   └── storybook/             # UI component documentation
├── infra/                      # Infrastructure as code (SST)
│   ├── app.ts                 # Main API & web deployment
│   ├── console.ts             # Console deployment
│   ├── enterprise.ts          # Enterprise features
│   └── stage.ts               # Stage configuration
├── script/                     # Root-level scripts
├── .github/                    # GitHub Actions workflows
└── sst.config.ts              # SST configuration
```

## Core Components

### 1. CLI Code (`packages/opencode/`)

**Location**: `/packages/opencode/`

**Entry Point**: `src/index.ts`

**Key Directories**:
- `src/cli/`: CLI commands and TUI
  - `src/cli/cmd/`: Command implementations
    - `run.ts`: Main TUI command (default)
    - `serve.ts`: Headless API server
    - `web.ts`: Web interface launcher
    - `tui/`: TUI-specific code
  - `src/cli/ui.ts`: CLI user interface utilities
- `src/server/`: API server implementation
  - `server.ts`: Hono server setup
  - `routes/`: API route handlers
    - `tui.ts`: TUI-specific endpoints
    - `session.ts`: Session management
    - `project.ts`: Project operations
    - `provider.ts`: LLM provider management
    - `config.ts`: Configuration endpoints
- `src/agent/`: AI agent logic
- `src/provider/`: LLM provider integrations
- `src/auth/`: Authentication logic
- `src/storage/`: Database layer
  - `db.ts`: Database setup
  - `schema.ts`: Schema definitions
  - `schema.sql.ts`: Drizzle ORM schema
- `src/lsp/`: Language Server Protocol integration
- `src/mcp/`: Model Context Protocol
- `src/skill/`: Agent skills/tools
- `src/session/`: Session management
- `src/project/`: Project management
- `src/control-plane/`: Control plane logic

**Build Scripts**: `script/build.ts` - Compiles standalone executables for all platforms

**Commands**:
```bash
# Development
bun dev                          # Run TUI in packages/opencode
bun dev <directory>              # Run TUI in specific directory
bun dev serve                    # Start headless server (port 4096)
bun dev web                      # Start server + open web UI

# Production (after building)
opencode                         # Run TUI
opencode serve                   # Start headless server
opencode web                     # Start server + web UI
```

### 2. Web Code (`packages/app/`)

**Location**: `/packages/app/`

**Purpose**: Shared web UI components used by both the web interface and desktop app

**Technology**: SolidJS + Vite

**Key Files**:
- `src/index.ts`: Main export
- `src/index.css`: Global styles
- `vite.config.ts`: Vite configuration

**Testing**:
- Unit tests: `bun test:unit` (HappyDOM)
- E2E tests: `bun test:e2e` (Playwright)

**Commands**:
```bash
cd packages/app
bun dev                          # Start dev server (port 5173)
bun build                        # Build for production
bun test                         # Run tests
```

### 3. Desktop Code (`packages/desktop/`)

**Location**: `/packages/desktop/`

**Purpose**: Native desktop application wrapper

**Technology**: Tauri 2 + SolidJS (wraps `packages/app`)

**Key Directories**:
- `src/`: Frontend code (imports from `@opencode-ai/app`)
- `src-tauri/`: Rust backend for native functionality
  - Window management
  - Deep linking
  - System notifications
  - File system access
  - Auto-updates

**Commands**:
```bash
cd packages/desktop
bun run tauri dev                # Run in development mode
bun run tauri build              # Build native app bundle
bun dev                          # Web dev server only (no native shell)
```

**Platform Builds**:
- macOS: `.dmg` (Apple Silicon & Intel)
- Windows: `.exe`
- Linux: `.deb`, `.rpm`, AppImage

### 4. Documentation Website (`packages/web/`)

**Location**: `/packages/web/`

**Purpose**: Documentation and marketing site (docs.opencode.ai)

**Technology**: Astro + Starlight

**Commands**:
```bash
cd packages/web
bun dev                          # Local dev server
bun build                        # Build static site
```

### 5. Console/Dashboard (`packages/console/`)

**Location**: `/packages/console/`

**Purpose**: OpenCode Zen management dashboard (hosted at opencode.ai)

**Sub-packages**:
- `app/`: Frontend (SolidStart)
- `core/`: Business logic & database schema
- `function/`: Serverless functions (Cloudflare Workers)
  - `auth.ts`: Authentication handler
  - `log-processor.ts`: Log aggregation
- `mail/`: Email templates
- `resource/`: Shared resources

**Database**: PlanetScale (MySQL)

### 6. SDK (`packages/sdk/js/`)

**Location**: `/packages/sdk/js/`

**Purpose**: JavaScript/TypeScript SDK for integrating with OpenCode

**Generation**: Auto-generated from server API
```bash
./script/generate.ts             # Regenerate SDK after API changes
```

## Build Process

### Development Workflow

1. **Install Dependencies**:
   ```bash
   bun install
   ```

2. **Start Development**:
   ```bash
   # CLI/TUI
   bun dev                       # From repo root
   
   # Web UI
   bun run --cwd packages/app dev
   
   # Desktop App
   bun run --cwd packages/desktop tauri dev
   ```

### Production Build

**CLI Binary**:
```bash
cd packages/opencode
./script/build.ts                # Build for current platform
./script/build.ts --single       # Single binary for current platform only
```

Output: `packages/opencode/dist/opencode-<platform>/bin/opencode`

**Web App**:
```bash
cd packages/app
bun build
```

**Desktop App**:
```bash
cd packages/desktop
bun run tauri build
```

### Turbo Build System

The project uses Turbo for monorepo builds:
```bash
bun turbo typecheck              # Type check all packages
bun turbo build                  # Build all packages
```

**Turbo Configuration** (`turbo.json`):
- Caches build outputs
- Manages dependencies between packages
- Parallelizes builds

### GitHub Actions

**Workflow**: `.github/workflows/publish.yml`

**Triggers**:
- Push to `dev`, `beta`, or `ci` branches
- Manual workflow dispatch with version bump

**Jobs**:
1. **version**: Determine version number
2. **build-cli**: Build CLI for all platforms
3. **build-desktop**: Build desktop apps
4. **publish**: Publish to npm, Homebrew, package managers

## Infrastructure & Deployment

### SST Configuration (`sst.config.ts`)

**Infrastructure Provider**: Cloudflare

**Environments**:
- `production`: Main production environment
- `thdxr`: Developer staging
- Feature branches: Ephemeral environments

### Deployed Services

#### 1. Main API (`infra/app.ts`)

**URL**: `api.opencode.ai`

**Type**: Cloudflare Worker

**Features**:
- Durable Objects (SyncServer)
- GitHub App integration
- Discord support bot
- Feishu integration
- S3 bucket for artifacts

#### 2. Console (`infra/console.ts`)

**URL**: `opencode.ai`

**Components**:
- **Frontend**: SolidStart app (Cloudflare Pages)
- **Auth API**: Separate worker (auth.opencode.ai)
  - GitHub OAuth
  - Google OAuth
- **Database**: PlanetScale MySQL
  - Per-stage branches
  - Automated migrations
- **Stripe Integration**: Payment processing
  - OpenCode Go (Zen Lite): $10/month
  - OpenCode Black (Zen Black): $20-200/month
- **Log Processing**: Honeycomb integration

#### 3. Documentation (`infra/app.ts`)

**URL**: `docs.opencode.ai`

**Type**: Astro static site on Cloudflare Pages

#### 4. Web App

**URL**: `app.opencode.ai`

**Type**: Static site (built from `packages/app`)

### Secrets Management

Managed via SST Secrets:
- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID_CONSOLE`
- `ZEN_MODELS1-30`: Model configurations
- `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`
- `HONEYCOMB_API_KEY`: Observability

## Integration Points

### For AWS Cognito SSO Login

**Current Auth Implementation**:
- Location: `packages/opencode/src/auth/index.ts`
- Uses GitHub & Google OAuth (console)
- OpenAuth library: `@openauthjs/openauth`

**Integration Approach**:
1. **Console Auth** (`packages/console/function/src/auth.ts`):
   - Add Cognito provider alongside GitHub/Google
   - Update auth worker to support Cognito token exchange
   
2. **CLI Auth** (`packages/opencode/src/cli/cmd/auth.ts`):
   - Add Cognito flow (device code or browser-based)
   - Store tokens in local storage (`~/.local/share/opencode/`)

3. **API Server** (`packages/opencode/src/server/server.ts`):
   - Add middleware to validate Cognito JWTs
   - Currently uses basic auth for server mode

**Files to Modify**:
- `packages/opencode/src/auth/index.ts`
- `packages/console/function/src/auth.ts`
- `packages/opencode/src/cli/cmd/auth.ts`
- `infra/console.ts` (add Cognito secrets)

### For OpenTelemetry Tracking

**Current Observability**:
- Logging: `packages/opencode/src/util/log.ts`
- Honeycomb: Console log processor (`packages/console/function/src/log-processor.ts`)

**Integration Approach**:
1. Add OTEL SDK dependencies:
   ```json
   "@opentelemetry/api": "^1.x",
   "@opentelemetry/sdk-node": "^0.x",
   "@opentelemetry/instrumentation": "^0.x"
   ```

2. **Server Instrumentation** (`packages/opencode/src/server/server.ts`):
   - Initialize OTEL tracer
   - Add Hono middleware for automatic tracing
   - Instrument database calls

3. **CLI Instrumentation** (`packages/opencode/src/index.ts`):
   - Add tracer initialization
   - Instrument command execution
   - Export to OTLP endpoint

4. **Provider Instrumentation** (`packages/opencode/src/provider/provider.ts`):
   - Track LLM request/response times
   - Monitor token usage
   - Track model performance

**Files to Modify**:
- `packages/opencode/src/server/server.ts` (add OTEL middleware)
- `packages/opencode/src/index.ts` (initialize tracer)
- `packages/opencode/src/provider/provider.ts` (instrument LLM calls)
- `packages/opencode/src/util/log.ts` (integrate with OTEL)

### For Token Usage API

**Current Token Tracking**:
- Provider integration: `packages/opencode/src/provider/`
- AI SDK usage: Multiple providers via Vercel AI SDK

**Integration Approach**:
1. **Add Token Counter** (`packages/opencode/src/provider/token-counter.ts`):
   - Track input/output tokens per request
   - Store usage in database
   - Aggregate by user/session/model

2. **Database Schema** (`packages/opencode/src/storage/schema.sql.ts`):
   ```typescript
   export const tokenUsage = sqliteTable("token_usage", {
     id: text().primaryKey(),
     session_id: text().notNull(),
     user_id: text(),
     model: text().notNull(),
     input_tokens: integer().notNull(),
     output_tokens: integer().notNull(),
     created_at: integer().notNull(),
   })
   ```

3. **API Endpoints** (`packages/opencode/src/server/routes/usage.ts`):
   - `GET /usage/session/:id` - Session usage
   - `GET /usage/user/:id` - User usage
   - `GET /usage/aggregate` - Aggregated stats

4. **Provider Wrapper** (`packages/opencode/src/provider/provider.ts`):
   - Intercept all LLM calls
   - Extract token counts from responses
   - Save to database

**Files to Create/Modify**:
- `packages/opencode/src/provider/token-counter.ts` (new)
- `packages/opencode/src/server/routes/usage.ts` (new)
- `packages/opencode/src/storage/schema.sql.ts` (modify)
- `packages/opencode/src/provider/provider.ts` (modify)

### For Backend Database Connection

**Current Database**:
- **Local**: SQLite (`~/.local/share/opencode/opencode.db`)
  - Schema: `packages/opencode/src/storage/schema.sql.ts`
  - Migrations: `packages/opencode/migration/`
  - ORM: Drizzle
  
- **Cloud (Console)**: PlanetScale MySQL
  - Schema: `packages/console/core/`
  - Managed via SST

**Integration Approach**:

#### Option 1: Shared Cloud Database

1. **Add Database Connection** (`packages/opencode/src/storage/db.ts`):
   ```typescript
   export const cloudDb = drizzle(
     mysql({ 
       host: process.env.DB_HOST,
       user: process.env.DB_USER,
       password: process.env.DB_PASSWORD,
     })
   )
   ```

2. **Configuration** (`packages/opencode/src/config/`):
   - Add `OPENCODE_DB_HOST`, `OPENCODE_DB_USER`, etc.
   - Support both local SQLite and remote MySQL
   - Auto-detect based on environment

3. **Schema Sync**:
   - Align schema between SQLite and MySQL
   - Use Drizzle migrations for both
   - Add migration runner for cloud DB

#### Option 2: Hybrid Approach

- Keep local SQLite for session/project data
- Use cloud DB for:
  - User authentication/profiles
  - Token usage tracking
  - Shared configurations
  - Telemetry data

**Files to Modify**:
- `packages/opencode/src/storage/db.ts` (add cloud connection)
- `packages/opencode/src/storage/schema.sql.ts` (sync schemas)
- `packages/opencode/drizzle.config.ts` (add cloud config)
- `infra/console.ts` (if extending console DB)

### Environment Variables

**Current Variables** (in `packages/opencode/src/flag/flag.ts`):
- `OPENCODE_API_KEY`: API key for OpenCode services
- `OPENCODE_SERVER_PASSWORD`: Server mode password
- `OPENCODE_MODELS_URL`: Models.dev API URL
- `OPENCODE_DISABLE_SHARE`: Disable sharing feature

**New Variables Needed**:
```bash
# AWS Cognito
OPENCODE_COGNITO_USER_POOL_ID=
OPENCODE_COGNITO_CLIENT_ID=
OPENCODE_COGNITO_REGION=

# OpenTelemetry
OPENCODE_OTEL_ENDPOINT=
OPENCODE_OTEL_SERVICE_NAME=opencode
OPENCODE_OTEL_ENABLED=true

# Backend Database
OPENCODE_DB_HOST=
OPENCODE_DB_USER=
OPENCODE_DB_PASSWORD=
OPENCODE_DB_NAME=
OPENCODE_DB_PORT=3306
OPENCODE_DB_SSL=true
```

## Testing

### Unit Tests
```bash
# CLI tests
cd packages/opencode
bun test

# App tests
cd packages/app
bun test:unit
```

### E2E Tests
```bash
cd packages/app
bun test:e2e              # Full E2E suite
bun test:e2e:ui           # Interactive UI mode
```

### Integration Tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`)
- Must run from specific package directories

## Key Dependencies

### Core Dependencies
- `hono`: Web framework (API server)
- `drizzle-orm`: Database ORM
- `solid-js`: Reactive UI framework
- `ai`: Vercel AI SDK (LLM integration)
- `@opentui/core`: Terminal UI framework
- `@tauri-apps/api`: Desktop app APIs
- `yargs`: CLI argument parsing

### Provider SDKs
- `@ai-sdk/anthropic`: Claude
- `@ai-sdk/openai`: OpenAI/Azure
- `@ai-sdk/google`: Gemini
- `@openrouter/ai-sdk-provider`: OpenRouter
- Multiple other LLM providers

### Infrastructure
- `sst`: Infrastructure as code
- Cloudflare Workers/Pages
- PlanetScale (MySQL)
- Stripe (payments)

## Development Tips

1. **Hot Reload**: Run `bun dev` from repo root for fastest iteration
2. **Type Checking**: Use `bun turbo typecheck` before committing
3. **SDK Generation**: After API changes, run `./script/generate.ts`
4. **Database Migrations**: 
   ```bash
   cd packages/opencode
   bun db generate     # Create migration
   bun db migrate      # Apply migration
   ```
5. **Style Guide**: See `AGENTS.md` for coding conventions

## Support & Resources

- **Discord**: https://discord.gg/opencode
- **Documentation**: https://opencode.ai/docs
- **Contributing**: See `CONTRIBUTING.md`
- **Agents**: See `AGENTS.md` for agent system details

---

*Last Updated*: 2026-03-02  
*OpenCode Version*: 1.2.15
