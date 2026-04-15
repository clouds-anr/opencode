# opencode-agents

Multi-agent AI development templates for [opencode](https://github.com/sst/opencode).

## What Is This?

A ready-to-use template for setting up **multi-agent AI development workflows** with opencode. Instead of a single AI assistant doing everything, work is delegated to specialized agents—each optimized for their role.

## The Agents

### Core Agents

| Agent | Role | Key Trait |
|-------|------|-----------|
| **Orchestrator** | Orchestrator | Coordinates, delegates, synthesizes—does not do the work directly |
| **Researcher** | Researcher + Planner | Digs deep into codebases, creates actionable implementation plans |
| **Implementor C++** | C++ Implementation Specialist | Ships modern C++ with strong safety/performance discipline |
| **Tester C++** | Testing Specialist | Validates with tests, sanitizers, and regression checks |
| **Documentation** | Documentation Specialist | Maintains PlantUML diagrams, ADRs, and technical docs |
| **Truth-Teller** | Truth-Teller (default) | Challenges assumptions, finds blind spots (called for risky changes) |

### Truth-Teller Variants

| Agent | Model | Use Case |
|-------|-------|----------|
| **truth_teller** | Claude Opus | Default truth-teller |
| **truth_teller_opus** | Claude Opus | Explicit Opus variant |
| **truth_teller_qwen** | Qwen3 Coder | Code-focused analysis |
| **truth_teller_grok** | Grok | Alternative perspective |

### The Orchestrator Pattern

```
User Request
    │
    ▼
  Orchestrator ──────────────────────────────────────────┐
    │                                                    │
    ├──→ Researcher (research + plan)                   │
    │         │                                          │
    │         ├──→ Truth-Teller (challenge)             │ ← optional
    │         ▼                                          │
    ├──→ Implementor C++ (code changes)                  │
    ├──→ Tester C++ (tests + sanitizers)                 │
    └──→ Documentation (PlantUML + docs) ──→ Done ◄─────┘
```

**Why this pattern?**

- **Context efficiency** — Orchestrator stays lean, delegating heavy lifting to specialists
- **Separation of concerns** — Research, planning, and implementation are distinct phases
- **Quality gates** — Truth-Teller provides adversarial review for risky changes
- **Verification gates** — Tester C++ validates behavior and sanitizer health
- **Documentation gates** — Documentation keeps PlantUML and ADR/API docs synchronized
- **Parallel execution** — Independent tasks can run simultaneously

## Truth-Teller Consensus Pattern

For high-stakes decisions, run all three Truth-Teller variants in parallel and synthesize their feedback:

```
Orchestrator
  │
  ├──→ @truth_teller_opus ──┐
  ├──→ @truth_teller_qwen ──┼──→ Synthesize → Decision
  └──→ @truth_teller_grok ──┘
```

**When to use Truth-Teller Consensus:**

- **Major architectural decisions** — Changing core abstractions, adding new patterns
- **Risky refactors** — Changes touching >5 files or critical paths
- **Diverse perspectives needed** — When you want multiple AI viewpoints on a problem
- **Breaking ties** — When the team is stuck or going in circles

**How it works:**

1. Orchestrator dispatches the same question to all three Truth-Tellers in parallel
2. Each Truth-Teller analyzes independently using their underlying model
3. Orchestrator synthesizes the responses, looking for:
   - **Agreement** — All three flag the same issue = high confidence
   - **Disagreement** — Different concerns = explore each angle
   - **Unique insights** — One Truth-Teller sees something others miss = investigate

Most of what any single Truth-Teller says is noise, but consensus across models is signal.

## Installation

### 1. Install opencode

```bash
curl -fsSL https://opencode.ai/install | bash
```

Or see [opencode installation docs](https://github.com/sst/opencode#installation).

### 2. Run the installer

```bash
# Clone this repo
git clone https://github.com/yourusername/opencode-agents.git
cd opencode-agents

# Run the installer script
./install.sh
```

The installer copies agent definitions to `~/.config/opencode/agent/`.

### 3. Configure opencode

```bash
# Copy the example configuration
cp opencode.json.example ~/.config/opencode/opencode.json

# Edit to customize models (optional)
nano ~/.config/opencode/opencode.json
```

### 4. Copy AGENTS.md to your project

```bash
# Copy and customize the template AGENTS.md
cp AGENTS.md /path/to/your/project/
```

Edit `AGENTS.md` in your project to add project-specific context.

### 5. Start using agents

```bash
# In your project directory
opencode
```

Then talk to Orchestrator:

```
@orchestrator: I need to add user authentication to the app
```

## Configuration

The `opencode.json.example` file contains the full agent configuration:

```json
{
  "model": "zen/claude-opus-4-5",
  "default_agent": "orchestrator",
  "agent": {
    "orchestrator": { ... },
    "researcher": { ... },
    "implementor_cpp": { ... },
    "tester_cpp": { ... },
    "documentation": { ... },
    "truth_teller": { "model": "zen/claude-opus-4-5", ... },
    "truth_teller_opus": { "model": "zen/claude-opus-4-5", ... },
    "truth_teller_qwen": { "model": "zen/qwen3-coder-480b", ... },
    "truth_teller_grok": { "model": "zen/grok-3", ... }
  }
}
```

### Customizing Models

Edit `~/.config/opencode/opencode.json` to:

- **Change the default model** — Update the top-level `"model"` field
- **Use different Truth-Teller models** — Swap model providers for each variant
- **Add new variants** — Create additional Truth-Teller entries with different models

### Why Multiple Truth-Tellers?

Different AI models have different strengths and blind spots:

- **Claude Opus** — Strong reasoning, good at finding logical flaws
- **Qwen3 Coder** — Code-focused, catches implementation issues
- **Grok** — Alternative perspective, different training data

Running all three in parallel for critical decisions gives you diverse viewpoints.

## File Structure

```
opencode-agents/
├── .opencode/
│   ├── agent/
│   │   ├── orchestrator.md          # Orchestrator
│   │   ├── researcher.md            # Researcher + Planner
│   │   ├── implementor_cpp.md       # Implementor C++
│   │   ├── tester_cpp.md            # Tester C++
│   │   ├── documentation.md         # Documentation
│   │   └── truth_teller.md          # Truth-Teller
│   └── skills/
│       ├── cpp-modern/           # Modern C++ patterns and ownership
│       ├── cmake-production/     # CMake target and preset practices
│       ├── cpp-testing/          # C++ test strategy and patterns
│       ├── cpp-sanitizers/       # ASan/UBSan/TSan execution guide
│       ├── ci-cmake-sanitizers/  # GitHub Actions CI + sanitizer matrix
│       ├── static-analysis/      # clang-tidy and quality checks
│       ├── plantuml-docs/        # PlantUML architecture documentation
│       ├── api-doco/             # API docs and migration guidance
│       ├── pr-review/            # Pull request review guidelines
│       ├── git-commit/           # Commit message conventions
│       ├── issue-triage/         # GitHub issue triage workflow
│       └── agent-tuning/         # Agent prompt optimization
├── AGENTS.md             # Template for project-specific context
├── README.md             # This file
├── install.sh            # Installer script
└── opencode.json.example # Example configuration
```

## Skills

Skills are reusable knowledge modules that agents can load on-demand using the `Skill` tool. Each skill contains domain-specific expertise in a `SKILL.md` file.

### C++ Core Skills

| Skill | Description |
|-------|-------------|
| **cpp-modern** | Modern C++ design and implementation patterns (C++20/23, ownership, RAII) |
| **cmake-production** | Target-based CMake, presets, and reproducible build configuration |
| **cpp-testing** | C++ testing patterns with GoogleTest/Catch2 and CTest orchestration |
| **cpp-sanitizers** | ASan/UBSan/TSan workflows and triage guidance |
| **ci-cmake-sanitizers** | GitHub Actions patterns for CMake presets and sanitizer matrices |
| **static-analysis** | clang-tidy oriented static analysis and warning triage |
| **plantuml-docs** | PlantUML diagram standards for architecture and flow documentation |
| **api-doco** | API documentation and migration-note discipline |

### Transferable Core Skills

| Skill | Description |
|-------|-------------|
| **pr-review** | Pull request review guidelines for thorough, constructive feedback |
| **git-commit** | Conventional commit message format and best practices |
| **issue-triage** | GitHub issue triage workflow for prioritization and labeling |
| **agent-tuning** | Agent prompt optimization and behavior refinement techniques |
| **5whys / premortem / redteam / swot** | Decision quality and risk-analysis frameworks |

### Legacy Optional Skills (Preserved, Non-Default)

These skills are intentionally preserved for multi-domain teams but are not part of the default C++ workflow.
See the canonical index: `.opencode/skills/LEGACY-OPTIONAL.md`.

| Skill | Notes |
|-------|-------|
| **using-git-worktrees / writing-plans** | Process-oriented helpers outside core C++ implementation |

### How Skills Work

Agents with `skill: true` in their frontmatter can load skills dynamically:

```yaml
---
tools: [Read, Write, Glob, Grep, Bash, Task]
skill: true
---
```

When an agent needs specialized knowledge, they call the Skill tool:

```
Agent: I need to validate this C++ module and its test gaps.
[Loads skill: cpp-testing]
Agent: Now applying the checklist...
```

### Creating Custom Skills

1. Create a directory under `.opencode/skills/` with your skill name
2. Add a `SKILL.md` file with the skill content
3. Skills are automatically available to agents with `skill: true`

```bash
mkdir -p ~/.config/opencode/skills/my-custom-skill
echo "# My Custom Skill\n\nSkill content here..." > ~/.config/opencode/skills/my-custom-skill/SKILL.md
```

## Key Principles

1. **Orchestrator delegates everything** — Coordinates but never reads files or writes code directly
2. **Researcher digs deep, plans lean** — Research flows naturally into actionable tasks
3. **Implementor C++ follows specs** — No improvisation; if the plan is unclear, ask
4. **Tester C++ verifies behavior** — Tests and sanitizers are required for risky C++ changes
5. **Documentation synchronizes understanding** — PlantUML and ADR/API docs must reflect implementation
6. **Truth-Teller challenges** — Called for complex refactors (>5 files) or risky changes

## When to Call Truth-Teller

Truth-Teller runs at high temperature (0.8) intentionally—he's a wildcard oracle. Call him when:

- Complex refactors touching >5 files
- Risky architectural changes
- The team is stuck or going in circles
- A plan feels "correct" but dead
- Everyone agrees too quickly (dangerous!)

Most of what Truth-Teller says is noise, but buried in there is golden insight. Pan for gold.

## Customization

The agent files are designed to be project-agnostic. Customize them by:

1. **Adjusting tool permissions** in the frontmatter
2. **Adding project-specific rules** to `AGENTS.md`
3. **Modifying code standards** in Implementor C++'s file for your language/framework

## License

MIT
