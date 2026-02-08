# Agent Swarm OS

Agent Swarm OS is a Tauri desktop app for managing Claude Code Agent Teams in swarm mode with minimal setup friction.

It initializes a mission workspace, synthesizes a domain-specific team from your topic using Claude CLI, scaffolds prompts/tasks/modules, and provides a live dashboard for mission execution.

## Claude Agent Teams (Required)

This project expects Claude Agent Teams to be enabled for all runs.

Use:
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --teammate-mode in-process

Reference: https://code.claude.com/docs/en/agent-teams.md

## Quick Start (Desktop / Tauri)

### Prerequisites

- Node.js 18+
- Rust toolchain (`rustc` + `cargo`)
- Claude CLI installed and authenticated (`claude --help` works)

### 1) Install dependencies

```bash
npm install
cd dashboard/backend && npm install
cd ../frontend && npm install
```

### 2) Launch desktop app

```bash
npm run tauri:dev
```

### 3) Setup Agent Teams (first run)

From inside the app:

1. Open `Setup` page.
2. Confirm Claude CLI and Agent Teams readiness.
3. Open `Settings` to set team/path defaults and Claude kickoff command once.
4. Create a workspace from natural language.
5. Run Claude kickoff directly from `Settings` (no terminal required).

Or use terminal:

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --teammate-mode in-process
```

### 4) Start a mission workspace manually (optional)

```bash
npm run init -- -t "legal team agents to handle contracts" -a 6
```

Optional flags:

- `--template <social-media|research|software-build>` fallback hint
- `--team-name <name>`
- `--wizard`

## Legacy Web Mode

You can still run the old split backend/frontend web dashboard:

```bash
npm run start
```

- Dashboard: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:3001](http://localhost:3001)

## How Init Works

`npm run init` does the following:

1. Collects mission input (`topic`, `agent count`, optional `template hint`, `team name`).
2. Calls Claude CLI in JSON mode with schema constraints.
3. Validates/normalizes blueprint (`<= 8` agents, unique IDs, coordinator presence).
4. Falls back to nearest built-in template if synthesis fails.
5. Scaffolds workspace under `workspaces/{date}-{slug}/`.
6. Writes audit artifacts under `.agentsquad/`.

## Prompt Source Of Truth

- Built-in template role prompts are loaded from:
  - `templates/agent-squad/{template-id}/prompts/{role-id}.md`
- During init, prompt markdown is preferred over `template.json` inline prompt text.
- If a role prompt markdown file is missing, init falls back to that role's `template.json` prompt.
- This allows role prompt depth and behavior updates without changing template schema.

## Workspace Structure

```text
workspaces/{YYYY-MM-DD}-{slug}/
  workspace.json
  tasks.json
  source/mission.md
  agents/*.md
  artifacts/{module-id}/
  .agentsquad/
    blueprint.request.json
    blueprint.response.json
    blueprint.validated.json
    synthesis.meta.json
```

## Dashboard API

- `GET /api/workspace` active manifest + synthesis metadata
- `GET /api/agents` manifest agents with inferred runtime status
- `GET /api/tasks` task list + summary + workflow lanes
- `GET /api/comms` team feed messages (`?since=` supported)
- `GET /api/artifacts` workspace/module file summaries
- `GET /api/artifacts/:workspaceId` module file listing for workspace
- `GET /api/artifacts/:workspaceId/:moduleId` file contents for module
- `GET /api/health` health + workspace/synthesis status

### Workspace Isolation Behavior

- Workspace queries are strict:
  - If `workspaceId` is provided and not found, the API returns an empty, workspace-safe payload.
  - The API does not fall back to the latest workspace when an explicit `workspaceId` is invalid.
- Missing workspace responses include:
  - `requestedWorkspaceId`
  - `workspaceNotFound` (boolean)
- Tasks and comms are workspace-scoped only:
  - `tasks.json` in the selected workspace is always included.
  - `~/.claude/todos` items must include matching workspace tagging to appear.
  - Comms feed lines must include matching workspace tagging to appear.

### Required Workspace Tagging

- Todo/task payloads should include one of:
  - `workspaceId`
  - `workspace_id`
  - `workspace`
- Comms feed lines should include one of:
  - `workspaceId`
  - `workspace_id`
  - `workspace`
- Unscoped/global entries are ignored in workspace-scoped dashboard views.

Legacy aliases are still available for compatibility:

- `/api/coffee-room` -> `/api/comms`
- `/api/content` -> `/api/artifacts`

## Scripts

- `npm run init` initialize workspace with AI synthesis
- `npm run start` run dashboard in live mode
- `npm run dashboard:demo` run dashboard using bundled sample workspace
- `npm run reset` archive active workspaces and team feed
- `npm run build` build frontend
- `npm run tauri:dev` run the desktop app in development
- `npm run tauri:build` build desktop binaries

## Reset Behavior

`npm run reset` moves workspace folders to `workspaces/archive/` and archives `team-feed.jsonl`.

## Built-in Fallback Templates

- `social-media`
- `research`
- `software-build`

These are used when AI synthesis fails or as template hints during initialization.
