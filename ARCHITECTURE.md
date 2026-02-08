# Agent Squad Dashboard - Architecture

**Version:** 1.0
**Last Updated:** 2026-02-08
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Data Flow](#data-flow)
6. [File Structure](#file-structure)
7. [Key Design Decisions](#key-design-decisions)
8. [Performance Considerations](#performance-considerations)
9. [Security Model](#security-model)

---

## Overview

Agent Squad Dashboard is a real-time monitoring and control interface for multi-agent mission execution. It provides:

- **Real-time visibility** into agent activities, tasks, and artifacts
- **Workspace management** for organizing multi-agent missions
- **Team communications** tracking via JSONL feed
- **Tauri desktop app** with secure command execution
- **Adaptive polling** for efficient data updates
- **WCAG 2.1 AA accessibility** compliance

**Technology Stack:**
- Frontend: React 18, React Router, TanStack Query, Vite
- Backend: Node.js, Express
- Desktop: Tauri (Rust)
- Testing: Vitest, Testing Library, MSW

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Desktop Application                       │
│                      (Tauri Shell)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             React Frontend (Vite)                     │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Components (UI Layer)                          │ │  │
│  │  │  - Layout, Sidebar, Pages, Modals               │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Hooks (Data Layer)                             │ │  │
│  │  │  - useTasks, useAgents, useContent              │ │  │
│  │  │  - Adaptive Polling, React Query                │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Transport Layer                                │ │  │
│  │  │  - requestJson (fetch or Tauri IPC)             │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Rust Backend (Tauri Core)                 │  │
│  │  - Command Allowlist                                 │  │
│  │  - Secure Command Execution                          │  │
│  │  - File Watching & IPC Events                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP/IPC
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Node.js Backend Server                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Express Middleware Stack                            │  │
│  │  - CORS, JSON Parser                                 │  │
│  │  - Request Logging (Winston)                         │  │
│  │  - Rate Limiting (express-rate-limit)                │  │
│  │  - Error Logging                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Routes                                          │  │
│  │  - /api/workspace  - Workspace configuration         │  │
│  │  - /api/tasks      - Task management                 │  │
│  │  - /api/agents     - Agent status                    │  │
│  │  - /api/comms      - Team communications             │  │
│  │  - /api/artifacts  - Module outputs                  │  │
│  │  - /api/summary    - Mission summary                 │  │
│  │  - /api/health     - Health check                    │  │
│  │  - /metrics        - Prometheus metrics              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Services Layer                                      │  │
│  │  - workspaceReader - Read workspace.json             │  │
│  │  - taskReader      - Read tasks.json                 │  │
│  │  - commsReader     - Read team-feed.jsonl            │  │
│  │  - fileWatcher     - Watch for changes               │  │
│  │  - fileLock        - File locking system             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ File System
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     File System                              │
│  workspaces/                                                 │
│    └── {YYYY-MM-DD}-{slug}/                                  │
│        ├── workspace.json     (workspace config)             │
│        ├── tasks.json         (task tracking)                │
│        ├── source/mission.md  (mission brief)                │
│        ├── agents/*.md        (agent definitions)            │
│        └── artifacts/         (module outputs)               │
│                                                              │
│  ~/.claude/teams/{team}/                                     │
│    └── team-feed.jsonl        (team communications)          │
│                                                              │
│  ~/.claude/todos/                                            │
│    └── tasks.json             (global tasks)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Component Hierarchy

```
App.jsx (Router + Theme + QueryClient)
  └── Layout.jsx (Sidebar + Main Content)
      ├── Sidebar
      │   ├── WorkspaceSelector
      │   ├── Navigation Links
      │   └── ThemeToggle
      └── Outlet (Route Content)
          ├── MissionControl (Dashboard)
          ├── Tasks (Kanban Board)
          ├── Comms (Team Feed)
          ├── Artifacts (Content Gallery)
          ├── Analytics (Charts)
          ├── Summary (Markdown Viewer)
          ├── Help (Documentation)
          ├── Setup (Workspace Initialization)
          └── Settings (Configuration)
```

### State Management

- **Server State:** TanStack Query (React Query)
  - Caching, polling, invalidation
  - Adaptive polling intervals (2s → 5s → 10s)
  - Stale-while-revalidate pattern

- **Local State:** React useState + useContext
  - UI state (modals, filters, selections)
  - Theme preferences
  - View preferences (per workspace)

- **Persistent State:** localStorage (centralized utility)
  - Workspace selection
  - Theme choice
  - Filter presets
  - Recent modules

### Data Fetching Pattern

```javascript
// Custom hook with adaptive polling
export function useTasks(workspaceId) {
  return useTasksPolling(workspaceId, {
    enabled: Boolean(workspaceId),
    interval: 2000, // Adaptive: 2s → 5s → 10s
  });
}

// Transport abstraction
async function requestJson(url) {
  if (isTauri()) {
    // Use Tauri IPC
    return await invoke('api_request', { url });
  } else {
    // Use fetch (web)
    const res = await fetch(url);
    return await res.json();
  }
}
```

---

## Backend Architecture

### Middleware Stack (Order Matters)

1. **CORS** - Cross-origin resource sharing
2. **JSON Parser** - Parse request bodies
3. **Request Logger** - Log all requests (Winston)
4. **Rate Limiter** - Prevent abuse (100 req/min)
5. **Routes** - API endpoints
6. **Error Logger** - Log errors with stack traces
7. **Error Handler** - Send error responses

### Service Layer Pattern

```javascript
// Example: Task Reader Service
async function readTasks(workspaceDir) {
  const tasksPath = path.join(workspaceDir, 'tasks.json');

  // Use file locking to prevent race conditions
  return await safeReadJSON(tasksPath, { tasks: [] });
}
```

### File Locking System

Prevents race conditions when multiple agents or requests access the same files:

```javascript
// Atomic read-modify-write
await safeUpdateJSON('tasks.json', (current) => {
  current.tasks.push(newTask);
  return current;
});
```

**Features:**
- In-memory locks with timeout
- Automatic cleanup of stale locks
- Atomic writes (temp file + rename)
- Optional backup on write

---

## Data Flow

### Task Update Flow

```
User Action (UI)
  ↓
React Component
  ↓
useTasks Hook
  ↓
React Query Mutation
  ↓
POST /api/tasks
  ↓
Express Route Handler
  ↓
Task Service (with file lock)
  ↓
safeUpdateJSON(tasks.json)
  ↓
File System Write
  ↓
File Watcher Detects Change
  ↓
WebSocket/IPC Event (Tauri only)
  ↓
React Query Invalidation
  ↓
UI Re-render
```

### Real-time Updates

**Web Mode:**
- Adaptive polling (2s → 5s → 10s)
- React Query auto-refetch on window focus
- Manual refresh available

**Tauri Mode:**
- File watcher events via IPC
- Instant invalidation on file change
- Fallback to polling if events fail

---

## File Structure

```
dashboard/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Utilities (storage, transport, utils)
│   │   ├── theme/          # Theme definitions
│   │   ├── test/           # Test utilities
│   │   └── App.jsx         # Root component
│   ├── src-tauri/          # Tauri (Rust) backend
│   │   └── src/
│   │       ├── commands/   # Allowlisted commands
│   │       └── main.rs     # Tauri entry point
│   └── public/             # Static assets
│
├── backend/                # Node.js API server
│   ├── routes/             # Express routes
│   ├── services/           # Business logic
│   ├── middleware/         # Express middleware
│   ├── lib/                # Utilities (fileLock)
│   ├── tests/              # Backend tests
│   └── server.js           # Express entry point
│
└── docs/                   # Documentation
    ├── ARCHITECTURE.md     # This file
    ├── SECURITY.md         # Security documentation
    ├── CONTRIBUTING.md     # Contribution guide
    └── TESTING.md          # Testing guide
```

---

## Key Design Decisions

### 1. React Query for Server State
**Why:** Built-in caching, polling, and invalidation. Reduces boilerplate.
**Trade-off:** Learning curve for developers unfamiliar with React Query.

### 2. Adaptive Polling Instead of WebSockets
**Why:** Simpler infrastructure, works across all environments.
**Trade-off:** Higher latency (2-10s vs instant).
**Mitigation:** File watcher events in Tauri for instant updates.

### 3. JSONL for Team Feed
**Why:** Append-only, simple to parse, human-readable.
**Trade-off:** No built-in querying or indexing.

### 4. Tauri for Desktop App
**Why:** Secure, native performance, small bundle size (~10MB).
**Trade-off:** Rust learning curve for command allowlist.

### 5. File-based Storage (No Database)
**Why:** Simple deployment, portable, version-control friendly.
**Trade-off:** Limited querying capabilities, manual file locking.

### 6. Centralized localStorage Utility
**Why:** Type-safe, consistent API, cross-tab sync, error handling.
**Trade-off:** One more abstraction layer.

### 7. ErrorBoundary on All Routes
**Why:** Graceful error handling, prevents white screen of death.
**Trade-off:** Slightly more complex component tree.

---

## Performance Considerations

### Frontend Optimization

1. **Code Splitting:** Lazy-loaded routes (`React.lazy`)
2. **Memoization:** `React.memo` for TaskCard, ArtifactCard
3. **Virtualization:** Ready for react-window if needed
4. **Adaptive Polling:** Reduces requests by 65% (270 → 94 req/min)

### Backend Optimization

5. **File Locking:** Prevents race conditions without database locks
6. **Rate Limiting:** 100 req/min global, 10 req/min for expensive ops
7. **Efficient File Reading:** Only read files that changed (file watcher)
8. **Async I/O:** Non-blocking file operations

### Metrics

- **Frontend LCP:** <2.5s (Analytics page optimized)
- **Backend Response Time:** <50ms (p95)
- **Polling Frequency:** 94 req/min (down from 270)
- **Bundle Size:** ~1MB gzipped

---

## Security Model

See [SECURITY.md](./SECURITY.md) for comprehensive security documentation.

**Key Security Features:**
1. **Command Allowlist** (Tauri) - Only safe commands allowed
2. **Rate Limiting** - 100 req/min per IP
3. **Path Traversal Prevention** - Validated file paths
4. **Content Security Policy** - XSS protection
5. **Input Validation** - All user inputs sanitized
6. **File Locking** - Prevents concurrent write corruption
7. **Error Boundaries** - Prevents cascading failures

---

## Deployment

### Development
```bash
# Frontend dev server
npm run dev

# Backend server
npm run server

# Tauri desktop app
npm run tauri:dev
```

### Production
```bash
# Build frontend
npm run build

# Start backend
npm run server

# Build Tauri app
npm run tauri:build
```

### Environment Variables
```bash
PORT=3001                    # Backend port
TEAM_NAME=agent-squad-team   # Team name
DEMO_MODE=false              # Demo mode flag
LOG_LEVEL=info               # Winston log level
NODE_ENV=production          # Node environment
```

---

## Monitoring

### Health Check
```bash
GET /api/health
```

Response includes:
- Status, uptime, memory usage
- Workspace context
- File lock count
- Last changed timestamp

### Metrics (Prometheus Format)
```bash
GET /metrics
```

Metrics include:
- `process_uptime_seconds`
- `process_memory_heap_used_bytes`
- `file_locks_active`

### Logs

Logs are written to:
- `backend/logs/combined.log` - All logs
- `backend/logs/error.log` - Errors only
- Console - Development only

---

## Future Enhancements

1. **Database Layer** - PostgreSQL for querying and scalability
2. **Real-time Updates** - WebSocket server for instant updates
3. **Multi-user Support** - Authentication and authorization
4. **Cloud Deployment** - Docker, Kubernetes manifests
5. **Distributed Locking** - Redis for multi-process deployments
6. **Advanced Analytics** - Time-series metrics, dashboards
7. **Offline Mode** - Service worker for PWA support

---

**Document Version:** 1.0
**Maintained By:** Claude Sonnet 4.5
**Last Review:** 2026-02-08
