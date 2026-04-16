#!/bin/bash

# Master All-Teams Agents Installer
# Installs shared agents + all team agents to ~/.config/opencode/agent/
# Use this to get all teams available simultaneously in the project-level opencode.jsonc.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$SCRIPT_DIR/shared/agent"
TARGET_DIR="$HOME/.config/opencode/agent"

TEAMS=(cpp_team csp_team dev_ops_team hr_team tech_team)

echo "All-Teams Agents Installer"
echo "=========================="
echo ""
echo "This installs agents for ALL teams:"
echo "  cpp_team, csp_team, dev_ops_team, hr_team, tech_team"
echo ""
echo "Target: $TARGET_DIR"
echo ""

# Collect all files to install
ALL_FILES=()

if [ ! -d "$SHARED_DIR" ]; then
    echo "Error: Shared agent directory not found: $SHARED_DIR"
    exit 1
fi

for f in "$SHARED_DIR"/*.md; do
    ALL_FILES+=("$f")
done

for team in "${TEAMS[@]}"; do
    TEAM_DIR="$SCRIPT_DIR/$team/agent"
    if [ ! -d "$TEAM_DIR" ]; then
        echo "Warning: Skipping $team — agent directory not found: $TEAM_DIR"
        continue
    fi
    for f in "$TEAM_DIR"/*.md; do
        ALL_FILES+=("$f")
    done
done

echo "Agents to install (${#ALL_FILES[@]} total):"
for f in "${ALL_FILES[@]}"; do
    echo "  - $(basename "$f")"
done
echo ""

# Confirm
read -p "Install all agents? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    mkdir -p "$TARGET_DIR"
    for f in "${ALL_FILES[@]}"; do
        cp "$f" "$TARGET_DIR/"
    done
    echo ""
    echo "✓ All team agents installed successfully!"
    echo ""
    echo "Available orchestrators:"
    echo "  @cpp_orchestrator    — C++ feature work, refactors, testing"
    echo "  @csp_orchestrator    — Cloud architecture, DB migrations, Azure"
    echo "  @devops_orchestrator — Terraform, CI/CD, deployments"
    echo "  @hr_orchestrator     — AI governance, compliance, triage, translation"
    echo "  @tech_orchestrator   — General software engineering"
    echo ""
    echo "The project-level .opencode/opencode.jsonc already references the"
    echo "installed agent files — no further config copy needed."
    echo ""
    echo "Run 'opencode' in your project directory to start."
else
    echo "Installation cancelled."
    exit 0
fi
