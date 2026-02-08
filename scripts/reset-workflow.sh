#!/usr/bin/env bash
set -euo pipefail

# Agent Squad — Reset workflow (archive previous workspaces)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TEAM_NAME="${TEAM_NAME:-agent-squad-team}"
WORKSPACES_DIR="${WORKSPACES_DIR:-$PROJECT_ROOT/workspaces}"
ARCHIVE_DIR="$WORKSPACES_DIR/archive"
TEAM_DIR="${TEAMS_DIR:-$HOME/.claude/teams/$TEAM_NAME}"

echo "Agent Squad — Workflow Reset"
echo ""

echo "NOTE: If a teammate process is running, stop/cleanup before reset."
echo ""

mkdir -p "$ARCHIVE_DIR"

ARCHIVED=0
for dir in "$WORKSPACES_DIR"/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  [ "$name" = "archive" ] && continue
  [ "${name#*.}" != "$name" ] && continue
  if [ ! -f "$dir/workspace.json" ]; then
    continue
  fi

  target="$ARCHIVE_DIR/$name"
  if [ -e "$target" ]; then
    target="$ARCHIVE_DIR/${name}-$(date +%H%M%S)"
  fi

  mv "$dir" "$target"
  echo "Archived: workspaces/$(basename "$target")/"
  ARCHIVED=$((ARCHIVED + 1))
done

if [ "$ARCHIVED" -eq 0 ]; then
  echo "No workspaces to archive."
else
  echo ""
  echo "Archived $ARCHIVED workspace(s) to workspaces/archive/."
fi

if [ -f "$TEAM_DIR/team-feed.jsonl" ]; then
  ts="$(date +%Y%m%d-%H%M%S)"
  mv "$TEAM_DIR/team-feed.jsonl" "$ARCHIVE_DIR/team-feed-${ts}.jsonl"
  echo "Archived team-feed.jsonl"
else
  echo "No team-feed.jsonl to archive."
fi

echo ""
echo "========================================"
echo "  Workflow reset complete"
echo "========================================"
echo ""
echo "To start a new workspace:"
echo "  npm run init -- -t \"Your mission topic\" -a 6"
echo ""
