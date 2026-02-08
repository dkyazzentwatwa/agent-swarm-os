# Agent Squad - Complete Technical Specification for Tauri Port

**Version:** 1.0
**Date:** 2026-02-06
**Target:** Tauri Desktop Application

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Core Components](#core-components)
4. [Data Models](#data-models)
5. [Backend Services](#backend-services)
6. [Frontend Application](#frontend-application)
7. [Special Features & "Magic"](#special-features--magic)
8. [API Endpoints](#api-endpoints)
9. [File System Conventions](#file-system-conventions)
10. [Real-time Updates](#real-time-updates)
11. [Theme System](#theme-system)
12. [CLI Integration](#cli-integration)
13. [Tauri Migration Strategy](#tauri-migration-strategy)

---

## Executive Summary

**Agent Squad** is a mission-driven, multi-agent orchestration dashboard for Claude Code teams. It provides:

- **AI-powered workspace initialization** - Uses Claude CLI to synthesize domain-specific agent teams from natural language mission descriptions
- **Live mission dashboard** - Real-time monitoring of agent activity, task progress, team communications, and artifacts
- **Template system** - 3 built-in templates (social-media, research, software-build) with extensible role-based agent definitions
- **File-based architecture** - All state persists in JSON/JSONL files for transparency and portability
- **Automatic agent orchestration** - Coordinates Claude Agent Teams with task assignment, workflow lanes, and comms

**Key Innovation:** The app uses Claude CLI's JSON schema output mode to generate fully-customized, domain-specific agent squads on-demand, then provides a live dashboard to monitor their execution.

---

## Architecture Overview

### Current Stack (Web)

```
┌─────────────────────────────────────────────────┐
│              Frontend (React + Vite)            │
│  - React 19 + React Router 7                    │
│  - TanStack Query (polling)                     │
│  - Tailwind CSS 4 + CSS Variables               │
│  - Recharts for analytics                       │
│  - React Markdown for content preview           │
└─────────────────────────────────────────────────┘
                       ↓ HTTP API
┌─────────────────────────────────────────────────┐
│            Backend (Express + Node)              │
│  - Express REST API (port 3001)                 │
│  - Chokidar file watchers                       │
│  - JSONL stream parsing                         │
│  - Workspace reader services                    │
└─────────────────────────────────────────────────┘
                       ↓ File I/O
┌─────────────────────────────────────────────────┐
│              File System Layer                   │
│  - workspaces/{date}-{slug}/                    │
│  - ~/.claude/teams/{teamName}/team-feed.jsonl   │
│  - ~/.claude/todos/                             │
│  - templates/agent-squad/{template-id}/         │
└─────────────────────────────────────────────────┘
```

### Target Stack (Tauri)

```
┌─────────────────────────────────────────────────┐
│          Frontend (React SPA)                    │
│  Same React app, invoke Tauri commands          │
└─────────────────────────────────────────────────┘
                       ↓ IPC
┌─────────────────────────────────────────────────┐
│           Rust Backend (Tauri)                   │
│  - Tauri commands (replaces Express routes)     │
│  - notify-rs file watchers (replaces chokidar)  │
│  - serde_json for JSON parsing                  │
│  - tokio for async                              │
└─────────────────────────────────────────────────┘
                       ↓ File I/O
┌─────────────────────────────────────────────────┐
│              File System (Same)                  │
│  All file paths remain unchanged                │
└─────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Workspace Initialization System

**Purpose:** Generate domain-specific agent teams using Claude CLI

**Files:**
- `scripts/init-workflow.js` (2012 lines)

**Flow:**
1. User provides mission topic (e.g., "Build a SaaS landing page")
2. Script auto-detects best template or uses AI synthesis
3. Calls `claude` CLI with JSON schema constraints:
   ```bash
   claude -p "<prompt>" \
     --output-format json \
     --json-schema "<schema>" \
     --tools "" \
     --permission-mode plan \
     --no-session-persistence
   ```
4. Validates blueprint against JSON schema (max 8 agents)
5. Falls back to template if AI synthesis fails (with retry)
6. Scaffolds workspace directory with agents, tasks, modules

**Key Features:**
- **Interactive wizard** (@clack/prompts) - Step-by-step UI
- **Smart defaults** - Auto-detects template/agent count from topic keywords
- **Custom agent roster** - Users can define roles manually
- **Fuzzy template matching** - "social" → "social-media"
- **Dry-run mode** - Preview without creating files
- **Config file support** - `.agentsquadrc` for defaults

**Blueprint Schema (BLUEPRINT_SCHEMA):**
```json
{
  "title": "Mission title",
  "dashboard": {
    "title": "Agent Squad",
    "subtitle": "...",
    "nav": ["mission", "summary", "tasks", "comms", "artifacts", "analytics", "help"]
  },
  "groups": [
    { "id": "lead", "label": "Lead", "description": "...", "color": "#60a5fa" }
  ],
  "agents": [
    {
      "id": "lead-coordinator",
      "displayName": "Lead Coordinator",
      "emoji": "🎯",
      "groupId": "lead",
      "roleSummary": "...",
      "prompt": "You are the Lead Coordinator...",
      "color": "#..."
    }
  ],
  "modules": [
    { "id": "brief", "label": "Brief", "emoji": "🧭", "description": "..." }
  ],
  "workflowLanes": [
    { "id": "question", "label": "Question", "description": "..." }
  ],
  "comms": {
    "types": ["update", "insight", "blocker"]
  },
  "tasks": [...]
}
```

### 2. Dashboard Backend (Express API)

**Files:**
- `dashboard/backend/server.js` - Main server
- `dashboard/backend/routes/*.js` - API routes (7 files)
- `dashboard/backend/services/*.js` - Business logic

**Port:** 3001
**CORS:** Enabled for localhost:5173

**Environment Variables:**
- `PORT` - API port (default: 3001)
- `TEAM_NAME` - Team directory name (default: agent-squad-team)
- `WORKSPACES_DIR` - Workspace root (default: ./workspaces)
- `TEAMS_DIR` - Claude teams directory (default: ~/.claude/teams/{teamName})
- `TASKS_DIR` - Claude todos (default: ~/.claude/todos)
- `DEMO_MODE` - Use sample data (default: false)

**Key Services:**

#### FileWatcher Service
```javascript
// dashboard/backend/services/fileWatcher.js
// Uses chokidar to watch directories for changes
// Tracks last modification timestamp for polling optimization
initWatchers({ teamsDir, tasksDir, workspacesDir })
getLastChanged() // returns { teams: timestamp, tasks: timestamp, workspaces: timestamp }
```

#### WorkspaceReader Service
```javascript
// dashboard/backend/services/workspaceReader.js
listWorkspaceEntries(workspacesDir) // returns array of workspace metadata
getWorkspaceContext({ workspacesDir, workspaceId, demoMode, sampleDataDir })
// Returns: { workspaceId, workspacePath, manifest }
```

#### TaskReader Service
```javascript
// Reads tasks.json from workspace
// Merges with ~/.claude/todos (filtered by workspaceId)
// Generates summary statistics
```

#### CommsReader Service
```javascript
// Parses team-feed.jsonl (newline-delimited JSON)
// Filters messages by workspaceId
// Supports ?since=timestamp queries
// Message types: update, insight, blocker
```

### 3. Dashboard Frontend (React SPA)

**Files:**
- `dashboard/frontend/src/App.jsx` - Root component
- `dashboard/frontend/src/pages/*.jsx` - 7 pages
- `dashboard/frontend/src/components/*.jsx` - 20+ components
- `dashboard/frontend/src/hooks/*.js` - Custom hooks

**Routing (React Router 7):**
- `/` - Mission Control (home)
- `/comms` - Team communications feed
- `/artifacts` - Content gallery (workspace files)
- `/analytics` - Charts and metrics
- `/tasks` - Task board with filters
- `/summary` - Final summary/handoff
- `/help` - Help documentation

**State Management:**
- **TanStack Query** for server state (no Redux/Zustand)
- **usePolling** hook - 1s interval for real-time updates
- **React Context** for workspace/theme data
- **localStorage** for theme persistence

**Key Pages:**

#### Mission Control (`pages/MissionControl.jsx`)
- Agent team grid (grouped by role)
- Task progress cards
- Activity timeline (tasks + comms merged)
- Weekly calendar (workflow lanes)
- Stat tiles (active agents, in-progress tasks, latest message, last activity)
- Runbook panel (suggested actions based on state)

#### Tasks (`pages/Tasks.jsx`)
- Filterable task list (by status, assignee, lane)
- Presets: "lead", "in_progress", "blocked"
- Task detail modal
- Agent click → agent detail modal
- Drag-drop lanes (visual only, not persistent)

#### Comms/Coffee Room (`pages/CoffeeRoom.jsx`)
- Reverse-chronological message feed
- Filter by type (update/insight/blocker)
- Filter by agent
- Markdown rendering in messages
- Agent avatars with emoji

#### Artifacts (`pages/ContentGallery.jsx`)
- Module-based file browser
- File preview modal (markdown rendering)
- Supports .md, .json, .txt files
- Download links

#### Analytics (`pages/Analytics.jsx`)
- Task status distribution (pie chart)
- Tasks by agent (bar chart)
- Tasks by lane (bar chart)
- Agent activity heatmap
- Comms type distribution

#### Summary (`pages/Summary.jsx`)
- Renders `artifacts/summary/summary.md` from workspace
- Markdown with GitHub flavored extensions
- Configurable path via `workspace.json` → `dashboard.summaryFile`

---

## Data Models

### Workspace Manifest (`workspace.json`)

```json
{
  "schemaVersion": "1.0",
  "workspace": {
    "id": "2026-02-06-build-saas-landing-page",
    "title": "Build a SaaS landing page",
    "slug": "build-saas-landing-page",
    "createdAt": "2026-02-06T19:00:00.000Z",
    "templateId": "software-build"
  },
  "team": {
    "name": "agent-squad-team",
    "maxAgents": 8
  },
  "dashboard": {
    "title": "Agent Squad",
    "subtitle": "Mission-driven multi-agent dashboard",
    "nav": ["mission", "summary", "tasks", "comms", "artifacts", "analytics", "help"],
    "workflowLanes": [
      { "id": "design", "label": "Design", "description": "..." },
      { "id": "build", "label": "Build", "description": "..." },
      { "id": "review", "label": "Review", "description": "..." }
    ],
    "summaryFile": "artifacts/summary/summary.md"
  },
  "groups": [
    { "id": "lead", "label": "Lead", "description": "...", "color": "#60a5fa" }
  ],
  "agents": [
    {
      "id": "tech-lead",
      "displayName": "Tech Lead",
      "emoji": "🎯",
      "color": "hsl(220 70% 45%)",
      "groupId": "lead",
      "roleSummary": "Coordinates execution and final quality checks",
      "promptFile": "agents/tech-lead.md",
      "active": true
    }
  ],
  "modules": [
    {
      "id": "design",
      "label": "Design",
      "emoji": "🎨",
      "description": "UI/UX designs and mockups",
      "path": "artifacts/design"
    }
  ],
  "workflowLanes": [
    { "id": "design", "label": "Design", "description": "..." }
  ],
  "comms": {
    "file": "~/.claude/teams/{teamName}/team-feed.jsonl",
    "types": ["update", "insight", "blocker"]
  }
}
```

### Tasks (`tasks.json`)

```json
[
  {
    "id": "task-001",
    "subject": "Mission intake: Build a SaaS landing page",
    "description": "Clarify scope, outcomes, and dependencies.",
    "status": "completed",
    "assignee": "tech-lead",
    "blockedBy": [],
    "blocks": ["task-002", "task-003"],
    "lane": "design",
    "createdAt": "2026-02-06T19:00:00.000Z",
    "completedAt": "2026-02-06T19:05:00.000Z"
  }
]
```

**Task Statuses:** `pending`, `in_progress`, `completed`, `blocked`

### Team Communications (`team-feed.jsonl`)

Newline-delimited JSON (JSONL):

```jsonl
{"timestamp":"2026-02-06T19:00:00.000Z","workspaceId":"2026-02-06-build-saas-landing-page","agent":"tech-lead","type":"update","message":"Starting mission intake"}
{"timestamp":"2026-02-06T19:05:00.000Z","workspaceId":"2026-02-06-build-saas-landing-page","agent":"ux-designer","type":"insight","message":"Users expect mobile-first design in 2026"}
{"timestamp":"2026-02-06T19:10:00.000Z","workspaceId":"2026-02-06-build-saas-landing-page","agent":"frontend-engineer","type":"blocker","message":"Need design system specs before starting implementation"}
```

**Message Types:** `update`, `insight`, `blocker`

### Template Definition (`templates/agent-squad/{id}/template.json`)

```json
{
  "id": "software-build",
  "label": "Software Build",
  "description": "Full-stack engineering team",
  "keywords": ["software", "app", "website", "build", "code", "api", "frontend", "backend"],
  "defaultAgentCount": 5,
  "groups": [...],
  "roles": [
    {
      "id": "tech-lead",
      "displayName": "Tech Lead",
      "emoji": "🎯",
      "groupId": "lead",
      "roleSummary": "...",
      "prompt": "You are the Tech Lead..." // fallback if .md file missing
    }
  ],
  "requiredRoles": ["tech-lead", "frontend-engineer", "backend-engineer"],
  "optionalRolePriority": ["ux-designer", "qa-engineer", "devops-engineer"],
  "modules": [...],
  "workflowLanes": [...]
}
```

**Prompt Loading Priority:**
1. `templates/agent-squad/{template-id}/prompts/{role-id}.md` (preferred)
2. Fallback to `template.json` → `roles[].prompt`

### Audit Files (`.agentsquad/`)

Created during workspace initialization:

- `blueprint.request.json` - Input to Claude CLI (prompt, schema, params)
- `blueprint.response.json` - Raw Claude CLI output
- `blueprint.validated.json` - Normalized blueprint after schema validation
- `synthesis.meta.json` - Metadata (synthesis mode, fallback info, model)
- `kickoff-prompt.txt` - Pre-written prompt to start the mission

---

## Backend Services

### Route: `/api/workspace`

**Returns:**
```json
{
  "workspaceId": "2026-02-06-build-saas-landing-page",
  "manifest": { /* workspace.json contents */ },
  "synthesisMode": "ai-synthesis" | "template-fallback",
  "fallbackUsed": false,
  "requestedAgents": 6,
  "appliedAgents": 6
}
```

### Route: `/api/agents`

**Returns:**
```json
{
  "agents": [
    {
      "id": "tech-lead",
      "displayName": "Tech Lead",
      "emoji": "🎯",
      "color": "hsl(220 70% 45%)",
      "groupId": "lead",
      "roleSummary": "...",
      "promptFile": "agents/tech-lead.md",
      "active": true,
      "status": "working" | "idle" | "unknown",
      "lastActivity": "2026-02-06T19:15:00.000Z",
      "taskCount": 3,
      "completedTaskCount": 1
    }
  ],
  "workspaceId": "..."
}
```

**Agent Status Inference:**
- `working` - Has tasks in `in_progress` status
- `idle` - Has pending tasks but none in progress
- `unknown` - No tasks assigned

### Route: `/api/tasks`

**Returns:**
```json
{
  "tasks": [ /* array of task objects */ ],
  "summary": {
    "total": 10,
    "pending": 3,
    "inProgress": 2,
    "completed": 4,
    "blocked": 1
  },
  "lanes": [
    { "id": "design", "label": "Design", "taskCount": 4 }
  ],
  "workspaceId": "..."
}
```

### Route: `/api/comms`

**Query Params:**
- `?since=<ISO8601>` - Only messages after timestamp
- `?workspaceId=<id>` - Filter by workspace (usually inferred from context)

**Returns:**
```json
{
  "messages": [
    {
      "timestamp": "2026-02-06T19:00:00.000Z",
      "workspaceId": "2026-02-06-build-saas-landing-page",
      "agent": "tech-lead",
      "type": "update",
      "message": "Starting mission intake"
    }
  ],
  "workspaceId": "...",
  "messageCount": 42
}
```

### Route: `/api/artifacts`

**GET `/api/artifacts`** - List all workspaces with file counts

**GET `/api/artifacts/:workspaceId`** - List modules and files

**GET `/api/artifacts/:workspaceId/:moduleId`** - List files in module

**Returns file metadata:**
```json
{
  "workspaceId": "...",
  "modules": [
    {
      "id": "design",
      "label": "Design",
      "emoji": "🎨",
      "path": "artifacts/design",
      "files": [
        {
          "name": "wireframes.md",
          "path": "artifacts/design/wireframes.md",
          "size": 1024,
          "modified": "2026-02-06T19:10:00.000Z",
          "type": "markdown"
        }
      ],
      "fileCount": 3
    }
  ]
}
```

### Route: `/api/summary`

**Returns:**
```json
{
  "workspaceId": "...",
  "content": "# Final Summary\n\n...",
  "path": "artifacts/summary/summary.md",
  "exists": true
}
```

### Route: `/api/health`

**Returns:**
```json
{
  "status": "ok",
  "appName": "Agent Squad",
  "teamName": "agent-squad-team",
  "demoMode": false,
  "workspaceId": "2026-02-06-build-saas-landing-page",
  "synthesisMode": "ai-synthesis",
  "fallbackUsed": false,
  "lastChanged": {
    "teams": 1738870000000,
    "tasks": 1738870010000,
    "workspaces": 1738870020000
  }
}
```

---

## Frontend Application

### Polling Architecture

**usePolling Hook** (`hooks/usePolling.js`):
```javascript
usePolling(key, url, { interval = 1000, enabled = true })
// Uses TanStack Query with refetchInterval
// Returns: { data, isLoading, error, refetch }
```

**Usage Pattern:**
```javascript
const { data: agents } = useAgents(workspaceId)
// Internally calls: usePolling(['agents', workspaceId], `/api/agents?workspaceId=${workspaceId}`)
```

**All Data Hooks:**
- `useWorkspace()` - Workspace manifest + synthesis metadata
- `useAgents(workspaceId)` - Agent list with status
- `useTasks(workspaceId)` - Task list + summary
- `useCoffeeRoom(workspaceId)` - Comms feed
- `useArtifacts(workspaceId)` - Module/file listings
- `useSummary(workspaceId)` - Summary markdown

### Component Architecture

**Layout Component** (`components/Layout.jsx`):
- Sidebar navigation
- Theme toggle button
- Outlet for page content
- Workspace selector (when multiple workspaces exist)

**Key Reusable Components:**

1. **AgentCard** - Agent display with emoji, status indicator, task count
2. **AgentGroup** - Grouped agent grid (by role groups)
3. **TaskProgress** - Progress bar with status breakdown
4. **WeeklyCalendar** - Workflow lanes as calendar view
5. **ActivityTimeline** - Merged timeline of tasks + comms
6. **AgentDetailModal** - Agent info, assigned tasks, recent messages
7. **TaskDetailModal** - Task details, blockers, agent info
8. **ContentPreviewModal** - File preview with markdown rendering
9. **CommandPalette** - Quick navigation (Cmd+K style)

### Stat Tiles (Mission Control)

Clickable tiles that navigate to relevant pages:
- **Active Agents** → `/tasks?preset=lead`
- **Tasks In Progress** → `/tasks?preset=in_progress`
- **Latest Message** → `/comms`
- **Last Activity** → `/summary` (or `/comms` if stale)

### Runbook Panel

AI-powered suggested actions based on current state:
- "Kick off at least one pending task to keep flow active" (if inProgress === 0)
- "Escalate blocker items and request unblock plans in Comms" (if blockers > 0)
- "Request a fresh status update in team feed" (if no recent comms)
- "System healthy: keep monitoring throughput and final summary quality"

---

## Special Features & "Magic"

### 1. AI-Powered Blueprint Synthesis

**The Core Innovation:** Instead of pre-defining agent teams, Agent Squad uses Claude CLI to generate domain-specific teams on-demand.

**Process:**
1. User: "Build a SaaS landing page"
2. Script builds prompt: "Generate a domain-specialized multi-agent squad blueprint for: Build a SaaS landing page. Target 6 agents. Include coordinator, frontend, backend, etc."
3. Claude CLI generates JSON matching schema
4. Script validates, normalizes, ensures coordinator exists
5. Falls back to template if synthesis fails

**Prompt Engineering:**
```javascript
const synthesisPrompt = [
  "Generate a domain-specialized multi-agent squad blueprint.",
  "Requirements:",
  "- Return strict JSON only that matches schema.",
  `- Target mission: ${task}`,
  `- Requested total agents: ${agents}`,
  "- Include exactly one coordinator/lead role.",
  "- Create highly domain-specific agents, modules, and workflow lanes.",
  "- Avoid generic assumptions unless mission requires them.",
  "- Use neutral dashboard labels suitable for Agent Squad.",
  "- Include per-agent roleSummary and executable prompt text."
].join("\n")
```

**Fallback Mechanism:**
- 2 retry attempts with interactive recovery
- Template scoring based on keyword matching
- Manual template picker on failure

### 2. Real-Time File Watching

**Chokidar Configuration:**
```javascript
{
  ignoreInitial: true,
  persistent: true,
  awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  ignorePermissionErrors: true
}
```

**Watched Locations:**
- `~/.claude/teams/{teamName}/` - Team feed
- `~/.claude/todos/` - Task updates
- `workspaces/` - All workspace changes

**Optimization:** Frontend only re-fetches when `lastChanged` timestamp increases (checked every 1s).

### 3. JSONL Stream Parsing

**Team Feed Format:**
```jsonl
{"timestamp":"...","workspaceId":"...","agent":"...","type":"...","message":"..."}
```

**Parser:**
```javascript
// Reads file, splits by newlines, parses each line as JSON
// Filters by workspaceId
// Sorts by timestamp
// Returns array of messages
```

**Efficiency:** Only reads file on change (via file watcher).

### 4. Agent Status Inference

**Algorithm:**
```javascript
function inferAgentStatus(agent, tasks) {
  const agentTasks = tasks.filter(t => t.assignee === agent.id)
  const inProgress = agentTasks.filter(t => t.status === 'in_progress')

  if (inProgress.length > 0) return 'working'
  if (agentTasks.some(t => t.status === 'pending')) return 'idle'
  return 'unknown'
}
```

**Last Activity:**
```javascript
const lastActivity = Math.max(
  ...agentTasks.map(t => new Date(t.completedAt || t.createdAt))
)
```

### 5. Workspace Isolation

**Strict Scoping:**
- Tasks must have `workspaceId` field to appear
- Comms must have `workspaceId` field to appear
- API never falls back to different workspace if requested workspace not found
- Returns `workspaceNotFound: true` in response

**Multi-Workspace Support:**
- Dashboard can switch between workspaces
- Each workspace has independent tasks, agents, comms
- Workspace selector in sidebar

### 6. Theme System

**CSS Variables Approach:**
```css
[data-theme="terminal"] {
  --background: #0a0e1a;
  --text-primary: #00ff00;
  --text-secondary: #66ff66;
  --border: #00ff0033;
  /* ... 20+ variables */
}
```

**12 Built-in Themes:**
- Default (blue/professional)
- Terminal (green on black)
- Sunset (orange/purple)
- Ocean (blue/teal)
- Forest (green/brown)
- Midnight (dark blue)
- Rose (pink/red)
- Lavender (purple)
- Mint (light green)
- Mocha (brown)
- Slate (gray)
- Arctic (light blue/white)

**Theme Cycling:** Click button in header to cycle through themes. Persists in localStorage.

### 7. Markdown Rendering

**Libraries:**
- `react-markdown` for rendering
- `remark-gfm` for GitHub Flavored Markdown (tables, strikethrough, task lists)

**Used In:**
- Comms messages
- Summary page
- Artifact previews
- Agent prompts (in detail modals)

### 8. Activity Timeline

**Merged View:**
- Combines tasks and comms into single chronological timeline
- Shows agent activity, task status changes, and messages
- Clickable events open detail modals
- Color-coded by type (task vs. comms)

**Event Types:**
- Task created
- Task status changed
- Task completed
- Comms message (update/insight/blocker)

### 9. Demo Mode

**Usage:** `DEMO_MODE=true npm run dashboard`

**Behavior:**
- Uses `dashboard/backend/sample-data/sample-workspace/` instead of real workspace
- Bundled sample data included in repo
- No file watchers (sample data is static)
- Perfect for demos, screenshots, development

### 10. Template Hot-Reloading

**Prompt Files:**
- Templates can have separate `.md` files for agent prompts
- Located in `templates/agent-squad/{template-id}/prompts/{role-id}.md`
- Loaded at init time, merged into blueprint
- Allows updating agent behavior without changing JSON schema

---

## API Endpoints

### Complete Endpoint Reference

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/health` | Health check + workspace status | - |
| GET | `/api/workspace` | Workspace manifest + synthesis metadata | `?workspaceId=<id>` |
| GET | `/api/agents` | Agent list with inferred status | `?workspaceId=<id>` |
| GET | `/api/tasks` | Task list + summary + lanes | `?workspaceId=<id>` |
| GET | `/api/comms` | Team communications feed | `?workspaceId=<id>&since=<ISO8601>` |
| GET | `/api/artifacts` | List all workspaces with file counts | - |
| GET | `/api/artifacts/:workspaceId` | List modules and files for workspace | - |
| GET | `/api/artifacts/:workspaceId/:moduleId` | List files in specific module | - |
| GET | `/api/summary` | Summary markdown content | `?workspaceId=<id>` |

**Legacy Aliases (Deprecated):**
- `/api/coffee-room` → `/api/comms`
- `/api/content` → `/api/artifacts`

---

## File System Conventions

### Workspace Structure

```
workspaces/
└── 2026-02-06-build-saas-landing-page/
    ├── workspace.json          # Manifest (schema version 1.0)
    ├── tasks.json              # Task list
    ├── source/
    │   └── mission.md          # Mission description
    ├── agents/
    │   ├── tech-lead.md        # Agent prompts (one per agent)
    │   ├── frontend-engineer.md
    │   └── backend-engineer.md
    ├── artifacts/
    │   ├── design/             # Module directories
    │   │   ├── wireframes.md
    │   │   └── design-system.md
    │   ├── code/
    │   │   ├── frontend/
    │   │   └── backend/
    │   └── summary/
    │       └── summary.md      # Final summary
    └── .agentsquad/            # Audit files (hidden)
        ├── blueprint.request.json
        ├── blueprint.response.json
        ├── blueprint.validated.json
        ├── synthesis.meta.json
        └── kickoff-prompt.txt
```

### Claude Integration Paths

**Team Feed:**
```
~/.claude/teams/{teamName}/team-feed.jsonl
```

**Global Todos:**
```
~/.claude/todos/
└── *.json  # Optional workspace tagging
```

### Template Structure

```
templates/agent-squad/
├── social-media/
│   ├── template.json
│   └── prompts/
│       ├── lead-coordinator.md
│       ├── content-strategist.md
│       ├── instagram-curator.md
│       └── ...
├── research/
│   ├── template.json
│   └── prompts/
│       ├── lead-researcher.md
│       ├── literature-analyst.md
│       └── ...
└── software-build/
    ├── template.json
    └── prompts/
        ├── tech-lead.md
        ├── frontend-engineer.md
        └── ...
```

---

## Real-time Updates

### Polling Strategy

**Frontend:**
- 1000ms interval (1 second)
- TanStack Query handles caching, deduplication, error retry
- Only re-renders when data changes
- Uses `lastChanged` timestamps to optimize server work

**Backend:**
- File watchers update `lastChanged` object
- API handlers check file timestamps before reading
- Returns cached data if file unchanged since last read

**Optimization Flow:**
```
Frontend (1s)  → GET /api/agents
                 ↓
Backend         → Check lastChanged.workspaces
                 ↓
                 If unchanged since last client fetch:
                   Return cached/stale response
                 Else:
                   Read workspace.json, tasks.json
                   Compute agent status
                   Return fresh response
```

### Event Flow

```
Agent writes to team-feed.jsonl
  ↓
Chokidar detects file change
  ↓
Updates lastChanged.teams = Date.now()
  ↓
Frontend polls /api/comms (1s later)
  ↓
Backend sees lastChanged.teams > last client fetch
  ↓
Reads team-feed.jsonl, parses JSONL
  ↓
Returns new messages
  ↓
Frontend updates UI
```

---

## Theme System

### Theme Definition Format

```javascript
// dashboard/frontend/src/theme/themes.js
export const THEME_OPTIONS = [
  {
    id: "default",
    label: "Default",
    vars: {
      "--background": "#f8fafc",
      "--surface-1": "#ffffff",
      "--surface-2": "#f1f5f9",
      "--text-primary": "#0f172a",
      "--text-secondary": "#475569",
      "--border": "#e2e8f0",
      "--accent": "#3b82f6",
      // ... 20+ variables
    }
  }
]
```

### CSS Variable Usage

All components use CSS variables:
```jsx
<div className="bg-[var(--surface-1)] text-[var(--text-primary)] border-[var(--border)]">
  {content}
</div>
```

### Theme Persistence

```javascript
// Stored in localStorage
localStorage.setItem('agent-squad-theme', 'terminal')

// Applied via data attribute
document.documentElement.setAttribute('data-theme', 'terminal')
```

---

## CLI Integration

### Claude CLI Requirements

**Required for Init:**
```bash
claude --help  # Must be in PATH and authenticated
```

**Init Command:**
```bash
claude \
  -p "<synthesis prompt>" \
  --output-format json \
  --json-schema '<blueprint schema>' \
  --tools "" \
  --permission-mode plan \
  --no-session-persistence \
  --setting-sources local
```

**Response Parsing:**
```javascript
// Tries multiple extraction strategies:
1. parsed.structured_output
2. parsed.result (string or object)
3. parsed.content (string)
4. Regex match for JSON block
```

### Claude Agent Teams Integration

**Required for Mission Execution:**
```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 \
claude --teammate-mode in-process
```

**Kickoff Workflow:**
1. Dashboard generates kickoff prompt in `.agentsquad/kickoff-prompt.txt`
2. User runs Claude with agent teams enabled
3. Pastes kickoff prompt to Claude
4. Claude spawns agent team, reads workspace files
5. Agents write to `team-feed.jsonl` and `artifacts/` as they work
6. Dashboard live-updates to show progress

---

## Tauri Migration Strategy

### 1. Backend Migration (Express → Tauri Commands)

**Target Architecture:**

```rust
// src-tauri/src/main.rs
use tauri::Manager;
use notify::Watcher;
use serde::{Deserialize, Serialize};

#[tauri::command]
async fn get_workspace(workspace_id: Option<String>) -> Result<WorkspaceResponse, String> {
    // Replace: dashboard/backend/routes/workspace.js
    // Read workspace.json, synthesis metadata
    // Return structured response
}

#[tauri::command]
async fn get_agents(workspace_id: String) -> Result<AgentsResponse, String> {
    // Replace: dashboard/backend/routes/agents.js
    // Read workspace manifest, infer agent status from tasks
}

#[tauri::command]
async fn get_tasks(workspace_id: String) -> Result<TasksResponse, String> {
    // Replace: dashboard/backend/routes/tasks.js
    // Read tasks.json, parse ~/.claude/todos
}

#[tauri::command]
async fn get_comms(workspace_id: String, since: Option<String>) -> Result<CommsResponse, String> {
    // Replace: dashboard/backend/routes/comms.js
    // Parse team-feed.jsonl (JSONL format)
}

#[tauri::command]
async fn get_artifacts(workspace_id: String, module_id: Option<String>) -> Result<ArtifactsResponse, String> {
    // Replace: dashboard/backend/routes/artifacts.js
    // List files in artifacts/ directory
}

#[tauri::command]
async fn get_summary(workspace_id: String) -> Result<SummaryResponse, String> {
    // Replace: dashboard/backend/routes/summary.js
    // Read summary.md file
}
```

**File Watching (notify-rs):**

```rust
use notify::{Watcher, RecursiveMode, watcher};

// Replace: dashboard/backend/services/fileWatcher.js
fn init_watchers(teams_dir: PathBuf, tasks_dir: PathBuf, workspaces_dir: PathBuf) {
    let (tx, rx) = channel();
    let mut watcher = watcher(tx, Duration::from_millis(300)).unwrap();

    watcher.watch(&teams_dir, RecursiveMode::Recursive).unwrap();
    watcher.watch(&tasks_dir, RecursiveMode::Recursive).unwrap();
    watcher.watch(&workspaces_dir, RecursiveMode::Recursive).unwrap();

    // Emit events to frontend via Tauri event system
    app.emit_all("file-changed", payload).unwrap();
}
```

### 2. Frontend Migration (fetch → Tauri invoke)

**Before (Web):**
```javascript
const res = await fetch('/api/agents?workspaceId=...')
const data = await res.json()
```

**After (Tauri):**
```javascript
import { invoke } from '@tauri-apps/api/tauri'

const data = await invoke('get_agents', { workspaceId: '...' })
```

**Polling Replacement (Tauri Events):**

```javascript
import { listen } from '@tauri-apps/api/event'

// Replace 1s polling with event-driven updates
listen('file-changed', (event) => {
  if (event.payload.type === 'workspace') {
    queryClient.invalidateQueries(['agents', workspaceId])
  }
})
```

### 3. CLI Integration (Node spawn → Tauri Command)

**Init Workflow (Tauri Command):**

```rust
#[tauri::command]
async fn init_workspace(
    topic: String,
    agents: u8,
    template_id: Option<String>,
    team_name: String
) -> Result<InitResponse, String> {
    // Replace: scripts/init-workflow.js
    // Call `claude` CLI via std::process::Command
    // Parse JSON response
    // Write workspace files
}
```

**Claude CLI Execution:**

```rust
use std::process::Command;

let output = Command::new("claude")
    .args(&[
        "-p", &synthesis_prompt,
        "--output-format", "json",
        "--json-schema", &schema_json,
        "--tools", "",
        "--permission-mode", "plan"
    ])
    .output()
    .expect("Failed to execute claude");

let stdout = String::from_utf8(output.stdout)?;
let parsed: Blueprint = serde_json::from_str(&stdout)?;
```

### 4. Data Models (JSON → Rust Structs)

**Example:**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct WorkspaceManifest {
    #[serde(rename = "schemaVersion")]
    schema_version: String,
    workspace: WorkspaceInfo,
    team: TeamInfo,
    dashboard: DashboardConfig,
    groups: Vec<Group>,
    agents: Vec<Agent>,
    modules: Vec<Module>,
    #[serde(rename = "workflowLanes")]
    workflow_lanes: Vec<WorkflowLane>,
    comms: CommsConfig,
}

#[derive(Debug, Serialize, Deserialize)]
struct Agent {
    id: String,
    #[serde(rename = "displayName")]
    display_name: String,
    emoji: String,
    color: String,
    #[serde(rename = "groupId")]
    group_id: String,
    #[serde(rename = "roleSummary")]
    role_summary: String,
    #[serde(rename = "promptFile")]
    prompt_file: String,
    active: bool,
}
```

### 5. File System Access

**Current (Node fs):**
```javascript
const fs = require('fs')
const manifest = JSON.parse(fs.readFileSync('workspace.json', 'utf-8'))
```

**Tauri (Rust std::fs):**
```rust
use std::fs;
use std::path::PathBuf;

let manifest_path = workspaces_dir.join(workspace_id).join("workspace.json");
let content = fs::read_to_string(manifest_path)?;
let manifest: WorkspaceManifest = serde_json::from_str(&content)?;
```

**Tauri Filesystem API (Frontend):**
```javascript
import { readTextFile } from '@tauri-apps/api/fs'
import { appDataDir } from '@tauri-apps/api/path'

const workspacesPath = await appDataDir()
const manifest = await readTextFile(`${workspacesPath}/workspaces/.../workspace.json`)
```

### 6. Configuration & Paths

**Replace Environment Variables:**

```rust
// Get app config directory
let config_dir = tauri::api::path::config_dir().unwrap();
let workspaces_dir = config_dir.join("agent-squad").join("workspaces");
let teams_dir = dirs::home_dir().unwrap().join(".claude").join("teams").join(team_name);
```

**Store Settings:**
```rust
use tauri::Manager;

// Use tauri-plugin-store for persistent settings
app.handle().plugin(tauri_plugin_store::Builder::default().build())?;
```

### 7. Window Management

**Main Window:**
```rust
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            window.set_title("Agent Squad")?;
            window.set_min_size(Some(LogicalSize::new(1200, 800)))?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_workspace,
            get_agents,
            get_tasks,
            get_comms,
            get_artifacts,
            get_summary,
            init_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 8. Build Configuration

**Tauri Config (`src-tauri/tauri.conf.json`):**

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "package": {
    "productName": "Agent Squad",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "fs": {
        "all": true,
        "scope": [
          "$HOME/.claude/**",
          "$APPDATA/agent-squad/**"
        ]
      },
      "shell": {
        "all": false,
        "execute": true,
        "sidecar": false,
        "scope": [
          { "name": "claude", "cmd": "claude", "args": true }
        ]
      }
    },
    "windows": [
      {
        "title": "Agent Squad",
        "width": 1400,
        "height": 900,
        "resizable": true,
        "fullscreen": false
      }
    ]
  }
}
```

### 9. Development Workflow

**Current:**
```bash
# Terminal 1: Backend
npm run dashboard:backend

# Terminal 2: Frontend
npm run dashboard:frontend
```

**Tauri:**
```bash
# Single command (runs Rust backend + Vite frontend)
npm run tauri dev

# Or
cargo tauri dev
```

### 10. Dependencies

**Rust Crates (Cargo.toml):**

```toml
[dependencies]
tauri = { version = "1.5", features = ["shell-execute"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
notify = "6.1"
tokio = { version = "1.35", features = ["full"] }
anyhow = "1.0"
chrono = { version = "0.4", features = ["serde"] }
dirs = "5.0"
```

**Frontend (No Changes Needed):**
```json
{
  "dependencies": {
    "@tauri-apps/api": "^1.5.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@tanstack/react-query": "^5.90.20",
    // ... all existing dependencies remain
  }
}
```

### 11. Migration Checklist

- [ ] **Phase 1: Project Setup**
  - [ ] Initialize Tauri project (`cargo tauri init`)
  - [ ] Configure `tauri.conf.json` with file/shell allowlist
  - [ ] Setup Rust project structure

- [ ] **Phase 2: Backend Migration**
  - [ ] Implement `get_workspace` command
  - [ ] Implement `get_agents` command
  - [ ] Implement `get_tasks` command
  - [ ] Implement `get_comms` command (JSONL parser)
  - [ ] Implement `get_artifacts` command
  - [ ] Implement `get_summary` command
  - [ ] Implement file watchers (notify-rs)
  - [ ] Implement `init_workspace` command (Claude CLI integration)

- [ ] **Phase 3: Frontend Adaptation**
  - [ ] Replace all `fetch()` calls with `invoke()`
  - [ ] Replace HTTP polling with Tauri event listeners
  - [ ] Update `usePolling` hook for Tauri
  - [ ] Test all pages with Tauri backend

- [ ] **Phase 4: Testing**
  - [ ] Test workspace initialization
  - [ ] Test real-time file updates
  - [ ] Test all dashboard pages
  - [ ] Test theme persistence
  - [ ] Test multi-workspace switching
  - [ ] Test Claude CLI integration
  - [ ] Cross-platform testing (macOS, Windows, Linux)

- [ ] **Phase 5: Build & Distribution**
  - [ ] Configure app icons
  - [ ] Setup code signing (macOS)
  - [ ] Build universal binaries (macOS: Intel + Apple Silicon)
  - [ ] Create installers (DMG for macOS, MSI for Windows, AppImage for Linux)
  - [ ] Test installation flows

---

## Key Insights for Tauri Port

### Advantages of Tauri

1. **Single Binary Distribution** - No separate Node backend process
2. **Native Performance** - Rust backend is faster than Node for file I/O
3. **Better Security** - Scoped file system access, no CORS issues
4. **Smaller Bundle Size** - ~10-20MB vs. >100MB Electron equivalent
5. **Event-Driven Updates** - Replace polling with native file system events
6. **Cross-Platform** - Single codebase for macOS, Windows, Linux

### Challenges to Address

1. **JSONL Parsing** - Need Rust JSONL parser (use `serde_json::from_str` per line)
2. **Claude CLI Integration** - Must spawn subprocess from Rust (std::process::Command)
3. **File Watching** - notify-rs has different API than chokidar
4. **Error Handling** - Rust Result<T, E> vs. JavaScript try/catch
5. **JSON Schema Validation** - Need Rust equivalent of Ajv (use `jsonschema` crate)

### Recommended Approach

**Incremental Migration:**

1. Start with read-only commands (`get_*`)
2. Keep init script in Node initially (Tauri can shell out to it)
3. Migrate init to Rust once core dashboard works
4. Add event-driven updates last (can start with polling)

**Testing Strategy:**

1. Run both implementations side-by-side during migration
2. Compare API responses for consistency
3. Use existing frontend as test harness
4. Focus on file system edge cases (permissions, missing files, malformed JSON)

---

## Additional Notes

### Code Statistics

- **Total Files:** ~100 source files (excluding node_modules)
- **Backend:** ~1,500 LOC (JavaScript)
- **Frontend:** ~3,500 LOC (React/JavaScript)
- **Init Script:** 2,012 LOC (JavaScript)
- **Templates:** 3 built-in, ~50 role definitions

### Performance Characteristics

- **Workspace Init:** 10-30 seconds (mostly Claude CLI call)
- **Dashboard Load:** <1 second (reads 5-10 JSON files)
- **Polling Overhead:** Minimal (file watcher only checks timestamps)
- **Memory Usage:** ~100MB for dashboard (current web app)

### Extensibility Points

1. **Template System** - Add new templates by creating `templates/agent-squad/{id}/` directory
2. **Dashboard Pages** - React Router makes adding new pages easy
3. **Theme System** - Add new themes by extending `THEME_OPTIONS` array
4. **Comms Types** - Add new message types in workspace manifest
5. **Workflow Lanes** - Customizable per template/workspace

---

## Conclusion

Agent Squad is a sophisticated multi-agent orchestration platform with:

- **Innovative AI-driven initialization** using Claude CLI's structured output
- **Real-time dashboard** with file-watching and JSONL streaming
- **Template-based extensibility** for different domains
- **Clean separation of concerns** between workspace data, backend logic, and frontend UI

The Tauri port should preserve all these features while gaining:
- Native performance
- Single-binary distribution
- Better security
- Cross-platform support

**Recommended Migration Timeline:** 2-3 weeks for experienced Rust developer.

**Critical Success Factors:**
1. Preserve file system conventions (no breaking changes to workspace structure)
2. Maintain Claude CLI integration (subprocess spawning)
3. Keep frontend largely unchanged (React app works as-is)
4. Ensure cross-platform file path handling (Windows vs. Unix)

Good luck with the port! 🚀
