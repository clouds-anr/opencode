---
description: "Read a codebase and generate C4-style architecture diagrams"
---

> **If this codebase is deployed on or being migrated to Cloud One (C1) or any DoD/Government GovCloud platform**, load the `anr-csp-knowledge` skill before proceeding. It will shape the Interface Inventory (port 443 compliance column, NIPRNet flags), the System Context diagram (GCDS as an external actor, C1 boundary), and the Open Questions section (interface partner C1 status, VPC boundary assumptions).

Analyze the codebase at: $ARGUMENTS

If no path is provided, analyze the current working directory.

## Your Task

Read the codebase and generate a set of C4-style architecture diagrams as a markdown file named `ARCHITECTURE.md` in the analyzed directory. No scoring, no recommendations — pure discovery and visualization. The goal is to give any engineer an accurate mental model of the system in under 5 minutes. The file should be committable and render natively in GitHub/GitLab.

---

## Phase 1: Discovery

Read the codebase to map the architecture:

1. **Services & processes** — what distinct runnable units exist? (web server, worker, cron job, Lambda function, CLI tool)
2. **Internal packages/modules** — for monorepos, what are the major packages and what does each own?
3. **Data stores** — databases, caches, object storage, search indexes; note the engine and whether it's managed or self-hosted
4. **Message infrastructure** — queues, topics, event buses, streams (SQS, SNS, Kafka, RabbitMQ, etc.)
5. **External services** — third-party APIs, SaaS integrations, identity providers, CDNs
6. **Users & actors** — who calls this system? (end users via browser, mobile app, other services, admin tools, scheduled jobs)
7. **Communication patterns** — HTTP/REST, GraphQL, gRPC, async/event-driven, file-based; note ports and protocols
8. **Infrastructure** — cloud provider signals, container orchestration, serverless platform, CDN, load balancer
9. **Authentication boundary** — where auth is enforced, what identity provider is used
10. **Deployment units** — what gets deployed together vs. independently

---

## Phase 2: Diagram Generation

Generate diagrams at three levels of detail:

### Level 1 — System Context
The system as a black box and everything it interacts with:
- The system itself (one box)
- All external users/actors
- All external systems and services it calls or is called by
- All external data stores not fully owned by this system

Use Mermaid `graph TD` or `C4Context` syntax.

### Level 2 — Container Diagram
Inside the system boundary, showing each deployable/runnable unit:
- Each service, worker, function, or job as a separate container
- Data stores owned by the system
- Message infrastructure
- How containers communicate with each other (label the protocol/mechanism)
- Which container handles which user-facing concern

Use Mermaid `graph LR` or `C4Container` syntax.

### Level 3 — Component Diagram
For the most important or complex container (the primary web/API service), show internal structure:
- Major modules, packages, or layers (controllers, services, repositories, etc.)
- Key internal data flows
- Where external calls originate from inside the codebase

Use Mermaid `graph TD` syntax. If the codebase is small enough that Level 2 already shows sufficient detail, note this and skip Level 3.

### Level 4 — Data Flow Diagram (when data movement is significant)
If the system processes, transforms, or moves data as a core function, generate a data flow diagram showing:
- Input sources
- Processing steps
- Output destinations
- Any data stores touched along the way

---

## Phase 3: Supporting Documentation

Alongside the diagrams, generate:

### Component Inventory Table
| Component | Type | Technology | Owned By | Description |
|-----------|------|------------|----------|-------------|

Types: `service`, `worker`, `function`, `job`, `database`, `cache`, `queue`, `external-api`, `cdn`, `user`

### Interface Inventory Table
| From | To | Protocol | Port | Direction | Port 443 Compliant? | Notes |
|------|----|----------|------|-----------|--------------------|

*C1 context:* Flag every interface not on port 443/HTTPS as **non-compliant**. Mark interfaces to NIPRNet services as **NIPRNet dependency — verify reachability**. Note any interfaces whose partner program's C1 migration status is unknown as **Open Question**.

### Key Architectural Decisions (observed, not recommended)
List non-obvious architectural choices visible in the code — patterns that explain structure but aren't obvious to a new engineer (e.g., "event sourcing with CQRS", "BFF pattern per client type", "saga pattern for distributed transactions").

### Open Questions
Things the diagrams couldn't determine from the code alone — where a human review is needed to complete the picture.

---

## Phase 4: Write the Architecture Document

**Filename:** Before writing, check whether `ARCHITECTURE.md` already exists in the analyzed directory. If it does, use `ARCHITECTURE-2.md`; if that exists too, use `ARCHITECTURE-3.md`, and so on — never overwrite an existing file.

Write the architecture document (using the resolved filename above) in the analyzed directory. Requirements:

- **Markdown** — standard CommonMark with a Table of Contents at the top
- **Mermaid diagrams** — use fenced ` ```mermaid ` blocks; one per diagram level; each preceded by a `##` heading with the level name
- **Section order** — Level 1 (System Context), Level 2 (Container), Level 3 (Component, if needed), Level 4 (Data Flow, if applicable), then Component Inventory, Interface Inventory, Architectural Decisions, Open Questions

- **File paths**: use forward slashes in all tool call `filePath` arguments, even on Windows. Use relative paths from the project root (e.g., `packages/app/ARCHITECTURE.md`), not absolute Windows paths.

After writing the file, confirm:
- The file path where the architecture document was written (include the resolved filename)
- Count of services/containers identified
- Count of external dependencies identified
- Count of data stores identified
- Any significant gaps or assumptions in the diagrams (e.g., "could not determine how Service A communicates with Service B")
