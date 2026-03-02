# OpenCode Technical Breakdown

This document provides a comprehensive technical breakdown of the OpenCode project structure, architecture, and build process. It's designed to help developers understand the codebase and identify integration points for features like AWS Cognito SSO, OpenTelemetry tracking, token usage API, and backend database connections.

## Table of Contents

- [Local Development Setup](#local-development-setup)
- [Project Overview](#project-overview)
- [Repository Structure](#repository-structure)
- [Core Components](#core-components)
- [Build Process](#build-process)
- [Infrastructure & Deployment](#infrastructure--deployment)
- [Integration Points](#integration-points)

## Local Development Setup

This section provides a complete guide to setting up OpenCode for local development, from system prerequisites to running and debugging the application.

### Prerequisites

#### Required Software

1. **Bun 1.3+** (JavaScript runtime)
   ```bash
   # Install Bun
   curl -fsSL https://bun.sh/install | bash
   
   # Or on macOS
   brew install oven-sh/bun/bun
   
   # Verify installation
   bun --version  # Should be 1.3.10 or higher
   ```

2. **Git**
   ```bash
   # macOS
   brew install git
   
   # Ubuntu/Debian
   sudo apt-get install git
   ```

3. **Node.js (Optional)** - Not required for core development but useful for some tooling
   - Bun can replace Node.js for most operations

#### Optional (For Desktop App Development)

If you plan to work on the desktop app (`packages/desktop`), you'll need:

1. **Rust toolchain**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Platform-specific dependencies**
   - **macOS**: Xcode Command Line Tools
     ```bash
     xcode-select --install
     ```
   
   - **Linux (Ubuntu/Debian)**:
     ```bash
     sudo apt update
     sudo apt install libwebkit2gtk-4.0-dev \
       build-essential \
       curl \
       wget \
       file \
       libssl-dev \
       libgtk-3-dev \
       libayatana-appindicator3-dev \
       librsvg2-dev
     ```
   
   - **Windows**: 
     - Microsoft Visual Studio C++ Build Tools
     - WebView2 (usually pre-installed on Windows 10/11)

   See [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) for detailed platform-specific instructions.

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/anomalyco/opencode.git
   cd opencode
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```
   
   This installs all dependencies for the monorepo. The process may take a few minutes.

3. **Verify installation**
   ```bash
   bun turbo typecheck
   ```
   
   This will type-check all packages and ensure everything is set up correctly.

### Running Locally

#### CLI/TUI (Default Development Mode)

Run the OpenCode terminal interface:

```bash
# From repository root
bun dev

# Run in a specific directory
bun dev /path/to/your/project

# Run in the OpenCode repo itself
bun dev .
```

**What this does**: Starts the OpenCode TUI with hot reload enabled. Changes to TypeScript files will automatically reload.

#### API Server (Headless Mode)

Run just the API server without the TUI:

```bash
# Start server on default port (4096)
bun dev serve

# Start on custom port
bun dev serve --port 8080
```

**Access the API**: `http://localhost:4096` (or your custom port)

**API Documentation**: The server exposes OpenAPI specs at `/openapi.json`

#### Web UI

Run the web interface (browser-based UI):

**Option 1: Integrated (server + web)**
```bash
bun dev web
```
This starts the server and opens the web interface in your default browser.

**Option 2: Separate processes (for development)**

Terminal 1 - Start the server:
```bash
bun dev serve
```

Terminal 2 - Start the web dev server:
```bash
cd packages/app
bun dev
```

Access at: `http://localhost:5173` (default Vite port)

#### Desktop App

Run the native desktop application:

```bash
cd packages/desktop

# Development mode (hot reload enabled)
bun run tauri dev

# Just the web server without native shell
bun dev
```

**Note**: First run will be slower as Rust dependencies compile. Subsequent runs are faster.

#### Documentation Site

Run the docs website locally:

```bash
cd packages/web
bun dev
```

Access at: `http://localhost:4321` (default Astro port)

### Configuration

#### Environment Variables

OpenCode uses environment variables for configuration. Create a `.env` file in the repository root or set them in your shell:

**Common Variables:**
```bash
# API Configuration
OPENCODE_API_KEY=your_api_key_here

# Server Configuration
OPENCODE_SERVER_PASSWORD=your_password
OPENCODE_SERVER_USERNAME=opencode  # Optional, defaults to "opencode"

# LLM Provider Configuration
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_key

# Models API (defaults to https://models.dev)
OPENCODE_MODELS_URL=https://models.dev

# Feature Flags
OPENCODE_DISABLE_SHARE=true  # Disable share feature

# Debugging
OPENCODE_LOG_LEVEL=debug
```

**For Console Development:**
```bash
# Database (PlanetScale)
DATABASE_HOST=your_db_host
DATABASE_USERNAME=your_db_user
DATABASE_PASSWORD=your_db_password

# OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id

# Stripe
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_PUBLISHABLE_KEY=your_publishable_key
```

#### Configuration Files

- **`bunfig.toml`**: Bun configuration (package manager settings)
- **`turbo.json`**: Turborepo build configuration
- **`tsconfig.json`**: Root TypeScript configuration
- **`packages/*/tsconfig.json`**: Package-specific TypeScript configs
- **`.vscode/settings.json`**: VSCode editor settings (optional)

### Development Workflow

#### Typical Development Session

```bash
# 1. Pull latest changes
git pull origin dev

# 2. Install any new dependencies
bun install

# 3. Start development server
bun dev

# 4. Make your changes in src/

# 5. Type check (in another terminal)
bun turbo typecheck

# 6. Run tests for the package you're working on
cd packages/opencode
bun test

# 7. Commit your changes
git add .
git commit -m "feat: your feature description"
```

#### Hot Reload

Most components support hot reload:
- **CLI/TUI**: Automatic reload on file changes
- **Web UI**: Vite HMR (Hot Module Replacement)
- **Desktop**: Web portion uses HMR, native portion requires restart
- **API Server**: Automatic reload with `bun dev serve`

#### Working on Multiple Packages

When working across multiple packages (e.g., SDK + CLI):

```bash
# Terminal 1: Watch SDK changes
cd packages/sdk/js
bun --watch src/index.ts

# Terminal 2: Run CLI with changes
cd ../..
bun dev
```

### Debugging

#### VSCode Debugging

1. **Copy example configurations**:
   ```bash
   cp .vscode/settings.example.json .vscode/settings.json
   cp .vscode/launch.example.json .vscode/launch.json
   ```

2. **Start debugging**:
   - Open VSCode
   - Set breakpoints in your code
   - Run via `bun run --inspect=ws://localhost:6499/ dev`
   - Attach debugger using VSCode's "Attach" configuration

**Recommended approach** (most reliable):
```bash
# In terminal
bun run --inspect=ws://localhost:6499/ dev

# Then attach VSCode debugger to ws://localhost:6499/
```

#### Debugging Server Separately

For debugging server code:
```bash
# Terminal 1: Run server with debugging
bun run --inspect=ws://localhost:6499/ --cwd packages/opencode ./src/index.ts serve --port 4096

# Terminal 2: Attach TUI
opencode attach http://localhost:4096
```

#### Debugging TUI

```bash
bun run --inspect=ws://localhost:6499/ --cwd packages/opencode --conditions=browser ./src/index.ts
```

#### Debug Tips

- Use `--inspect-wait` to pause execution until debugger attaches
- Use `--inspect-brk` to break on first line
- Set `export BUN_OPTIONS=--inspect=ws://localhost:6499/` to avoid repeating the flag
- Check `bun dev spawn` if breakpoints aren't working in worker threads

### Testing

#### Unit Tests

```bash
# Run all tests in a package
cd packages/opencode
bun test

# Run specific test file
bun test src/storage/db.test.ts

# Watch mode
bun test --watch

# With coverage
bun test --coverage
```

#### E2E Tests

```bash
cd packages/app

# Run E2E tests
bun test:e2e

# Interactive UI mode
bun test:e2e:ui

# View test report
bun test:e2e:report
```

#### Important Testing Rules

- **DO NOT** run tests from repository root
- Tests include a guard: `do-not-run-tests-from-root`
- Always `cd` into the package directory first
- Each package has its own test configuration

### Database Development

#### Local Database

OpenCode uses SQLite for local development. The database is stored at:
- **Linux/macOS**: `~/.local/share/opencode/opencode.db`
- **Windows**: `%APPDATA%\opencode\opencode.db`

#### Database Migrations

```bash
cd packages/opencode

# Generate a new migration
bun db generate

# Apply migrations
bun db migrate

# Open Drizzle Studio (database GUI)
bun db studio
```

#### Schema Changes

1. Edit schema in `packages/opencode/src/storage/schema.sql.ts`
2. Generate migration: `bun db generate`
3. Review generated SQL in `migration/` directory
4. Apply migration: `bun db migrate`
5. Commit both schema and migration files

### Regenerating Generated Files

#### SDK Regeneration

After making API changes:
```bash
./script/generate.ts
```

This regenerates:
- JavaScript SDK (`packages/sdk/js/`)
- Type definitions
- API documentation

#### Models Snapshot

The models snapshot is auto-generated during build, but you can manually update:
```bash
cd packages/opencode
./script/build.ts
```

### Common Issues & Solutions

#### Issue: `bun: command not found`

**Solution**: Install Bun or add it to PATH
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or ~/.zshrc
```

#### Issue: Port 4096 already in use

**Solution**: Kill existing process or use different port
```bash
# Find process using port 4096
lsof -i :4096

# Kill it
kill -9 <PID>

# Or use different port
bun dev serve --port 8080
```

#### Issue: Type errors in IDE but builds succeed

**Solution**: Restart TypeScript server in VSCode
- Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
- Type "TypeScript: Restart TS Server"
- Select it

#### Issue: Desktop app won't build

**Solution**: Verify Tauri prerequisites
```bash
# Check Rust installation
rustc --version
cargo --version

# On Linux, ensure webkit2gtk is installed
dpkg -l | grep webkit2gtk
```

#### Issue: Bun version mismatch

**Solution**: Use exact version specified in package.json
```bash
# Check required version
grep packageManager package.json

# Update Bun
bun upgrade

# Or install specific version
curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.10"
```

#### Issue: Dependencies won't install

**Solution**: Clear cache and reinstall
```bash
rm -rf node_modules
rm bun.lockb
bun install
```

### Performance Tips

1. **Use Bun's cache**: Bun caches builds aggressively
2. **Parallel type checking**: `bun turbo typecheck` uses all CPU cores
3. **Incremental builds**: Turbo caches unchanged packages
4. **Watch mode**: More efficient than restarting for each change
5. **Use single build** for testing: `./packages/opencode/script/build.ts --single`

### IDE Setup

#### Recommended VSCode Extensions

- **Bun for VSCode**: Official Bun extension
- **TypeScript**: Built-in
- **SolidJS**: Solid language support
- **Tailwind CSS IntelliSense**: For styling
- **Prettier**: Code formatting (configured in package.json)
- **ESLint**: Linting (if enabled)

#### Settings

The repository includes example settings:
```bash
cp .vscode/settings.example.json .vscode/settings.json
```

Key settings:
- TypeScript version: Use workspace version
- Formatting: Prettier with semicolons disabled
- Line width: 120 characters

### Next Steps

Once your environment is set up:

1. **Read the style guide**: See `AGENTS.md` for coding conventions
2. **Explore the codebase**: Start with `packages/opencode/src/index.ts`
3. **Check existing issues**: Look for "good first issue" labels
4. **Join Discord**: Get help from the community
5. **Read CONTRIBUTING.md**: Understand the contribution workflow

### Useful Commands Reference

```bash
# Development
bun dev                              # Run CLI/TUI
bun dev serve                        # Run API server
bun dev web                          # Run web interface
bun dev <directory>                  # Run in specific directory

# Building
bun turbo build                      # Build all packages
bun turbo typecheck                  # Type check all packages
./packages/opencode/script/build.ts  # Build CLI binary

# Testing
bun test                             # Run tests (from package dir)
bun test --watch                     # Watch mode
bun test:e2e                         # E2E tests (app package)

# Database
bun db generate                      # Generate migration
bun db migrate                       # Apply migrations
bun db studio                        # Open database GUI

# Utilities
./script/generate.ts                 # Regenerate SDK
bun install                          # Install dependencies
bun upgrade                          # Update Bun
git pull origin dev                  # Pull latest changes
```

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
