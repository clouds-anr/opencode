#!/bin/bash

# C++ Team Agents Installer
# Copies shared + cpp_team agent files to ~/.config/opencode/agent/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$SCRIPT_DIR/../shared/agent"
TEAM_DIR="$SCRIPT_DIR/agent"
TARGET_DIR="$HOME/.config/opencode/agent"

echo "C++ Team Agents Installer"
echo "========================="
echo ""
echo "Shared agents: $SHARED_DIR"
echo "Team agents:   $TEAM_DIR"
echo "Target:        $TARGET_DIR"
echo ""

# Check sources exist
if [ ! -d "$SHARED_DIR" ]; then
    echo "Error: Shared agent directory not found: $SHARED_DIR"
    exit 1
fi
if [ ! -d "$TEAM_DIR" ]; then
    echo "Error: Team agent directory not found: $TEAM_DIR"
    exit 1
fi

# Detect filename collisions that would overwrite shared agents
dupes=()
for f in "$SHARED_DIR"/*.md; do
    name="$(basename "$f")"
    if [ -f "$TEAM_DIR/$name" ]; then
        dupes+=("$name")
    fi
done

if [ ${#dupes[@]} -gt 0 ]; then
    echo "Error: Duplicate agent filenames detected:"
    for f in "${dupes[@]}"; do
        echo "  - $f"
    done
    echo ""
    echo "Resolve duplicates before installing to avoid overwriting shared agents."
    exit 1
fi

# Create target directory if needed
mkdir -p "$TARGET_DIR"

# List agents to install
echo "Agents to install:"
for agent in "$SHARED_DIR"/*.md "$TEAM_DIR"/*.md; do
    echo "  - $(basename "$agent")"
done
echo ""

# Confirm
read -p "Install these agents? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    cp "$SHARED_DIR"/*.md "$TARGET_DIR/"
    cp "$TEAM_DIR"/*.md "$TARGET_DIR/"
    echo ""
    echo "✓ C++ Team agents installed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Copy opencode.json.example to ~/.config/opencode/opencode.json"
    echo "  2. Edit it to configure your preferred models"
    echo "  3. Run 'opencode' in your project directory"
    echo "  4. Start with: @cpp_orchestrator: <your task>"
else
    echo "Installation cancelled."
    exit 0
fi
