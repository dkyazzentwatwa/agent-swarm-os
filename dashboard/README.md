# Agent Squad Dashboard

> Real-time mission control interface for Claude multi-agent teams

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)
[![Quality Score](https://img.shields.io/badge/Quality-95%2F100-brightgreen.svg)](./QUALITY_IMPROVEMENT_COMPLETE.md)

A modern React + Express dashboard for monitoring and controlling Claude Agent Teams executing domain-specific missions.

---

## Features

- **Mission Control** - Real-time agent activity, task progress, workflow lanes
- **Task Management** - Kanban-style task board with filtering and bulk operations
- **Team Communications** - Live feed of agent updates, insights, and blockers
- **Artifacts Gallery** - Browse generated outputs across all modules
- **Analytics** - Charts and metrics for mission performance
- **Settings** - Configure workspace paths, Claude CLI integration

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### 1. Install Dependencies

**Option 1: npm script**
```bash
npm run install:all
```

**Option 2: Makefile**
```bash
make install
```

**Option 3: Manual**
```bash
npm install                # Root dependencies (concurrently)
cd backend && npm install  # Backend dependencies
cd ../frontend && npm install  # Frontend dependencies
```

### 2. Start Development Servers

**Option 1: npm script (recommended)**
```bash
npm run dev
```

**Option 2: Makefile**
```bash
make dev
```

**Option 3: Manual (two terminals)**
```bash
# Terminal 1 - Backend
cd backend
node server.js

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 3. Open Dashboard

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

---

## Architecture

### Frontend (Vite + React)

- **Port**: 5173 (development), configurable in production
- **Framework**: React 18 with Hooks
- **Styling**: Tailwind CSS with VS Code-inspired themes
- **State Management**: React Query for server state, React Context for UI state
- **Build Tool**: Vite with Hot Module Replacement (HMR)

**Key Dependencies:**
- `react` + `react-dom` - UI framework
- `react-router-dom` - Client-side routing
- `@tanstack/react-query` - Server state management
- `lucide-react` - Icon library
- `recharts` - Analytics charts
- `tailwindcss` - Utility-first CSS

### Backend (Express + Node.js)

- **Port**: 3001 (configurable via PORT env var)
- **Framework**: Express 4
- **Purpose**: REST API for workspace data, file system access, Tauri IPC bridge

**Key Dependencies:**
- `express` - Web framework
- `cors` - Cross-origin resource sharing
- `glob` - File pattern matching
- `winston` - Logging

### Project Structure

```
dashboard/
├── package.json          # Root package with dev scripts
├── Makefile             # Alternative command runner
├── backend/             # Express API server
│   ├── server.js        # Entry point
│   ├── routes/          # API endpoints
│   │   ├── workspace.js
│   │   ├── agents.js
│   │   ├── tasks.js
│   │   ├── comms.js
│   │   └── artifacts.js
│   ├── services/        # Business logic
│   │   └── workspaceReader.js
│   ├── middleware/      # Express middleware
│   └── tests/          # Backend tests
├── frontend/           # Vite + React SPA
│   ├── src/
│   │   ├── App.jsx     # Main app component + routing
│   │   ├── pages/      # Page components
│   │   ├── components/ # Reusable UI components
│   │   ├── hooks/      # Custom React hooks
│   │   └── utils/      # Helper functions
│   ├── public/         # Static assets
│   └── vite.config.js  # Vite configuration
└── ARCHITECTURE.md     # Detailed architecture docs
```

---

## Development

### Hot Reloading

Both servers support hot reloading:
- **Frontend**: Vite HMR updates React components instantly
- **Backend**: Restart manually after code changes (or use nodemon)

### Environment Variables

**Backend** (`backend/.env`):
```bash
PORT=3001
NODE_ENV=development
WORKSPACES_DIR=../workspaces
CLAUDE_TEAMS_DIR=~/.claude/teams
```

**Frontend** (vite.config.js handles proxy):
```javascript
server: {
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

### Debugging

**Backend logs:**
```bash
tail -f backend/logs/error.log
tail -f backend/logs/combined.log
```

**Frontend console:**
- Open DevTools (F12) in browser
- Check Network tab for API requests
- Check Console tab for React errors

### Common Issues

**Problem**: 500 errors on page load, "Failed to load resource"

**Solution**: Backend not running
```bash
# Check if backend is running
curl http://localhost:3001/api/health

# If not, start it:
cd backend && node server.js
```

---

**Problem**: Port 3001 or 5173 already in use

**Solution**: Stop existing servers
```bash
make stop
# or
lsof -ti:3001,5173 | xargs kill -9
```

---

**Problem**: Frontend shows "No workspaces found"

**Solution**: Create a workspace first
```bash
cd ..  # Go to root of agent-swarm-os
npm run init -- -t "your mission topic" -a 6
```

---

## Desktop App (Tauri)

The dashboard can run as a standalone desktop application using Tauri.

### Building

```bash
cd dashboard/frontend
npm run tauri:build
```

Output:
- macOS: `src-tauri/target/release/bundle/macos/Agent Swarm OS.app`
- DMG installer: `src-tauri/target/release/bundle/dmg/Agent Swarm OS_1.0.0_aarch64.dmg`

### First Launch

On first launch, the app prompts you to select your workspace directory. This setting persists in `.agentsquad.desktop-settings.json`.

### Configuration

The app uses the same settings system as dev mode (Settings page), but stores settings in the project root rather than relying on environment variables.

**Settings file location:** `<project-root>/.agentsquad.desktop-settings.json`

**Required setting:** `workspacesDir` - must point to a valid directory

**Optional settings:**
- `teamsDir` - Claude teams directory (defaults to `~/.claude/teams/<teamName>`)
- `tasksDir` - Tasks directory (defaults to `~/.claude/todos`)
- `teamName` - Team name (defaults to "agent-squad-team")

### Troubleshooting

**Modal appears on every launch:**
- Your `workspacesDir` setting points to a directory that doesn't exist or was deleted
- Solution: Select a valid directory or create the missing directory

**App shows "No workspaces found":**
- Your workspace directory is empty
- Solution: Use the Setup wizard to create your first workspace

**Settings not persisting:**
- Check file permissions on `.agentsquad.desktop-settings.json`
- Check that the file is not being deleted between launches

---

## API Endpoints

### Workspace

- `GET /api/workspace` - Get active workspace manifest
- `GET /api/workspace?workspaceId=<id>` - Get specific workspace

### Agents

- `GET /api/agents` - List all agents with inferred status
- `GET /api/agents?workspaceId=<id>` - Agents for specific workspace

### Tasks

- `GET /api/tasks` - List all tasks with summary
- `GET /api/tasks?workspaceId=<id>` - Tasks for specific workspace
- `GET /api/tasks?status=pending` - Filter by status
- `GET /api/tasks?lane=analysis` - Filter by workflow lane

### Communications

- `GET /api/comms` - Get team feed messages
- `GET /api/comms?since=<timestamp>` - Messages since timestamp
- `GET /api/comms?workspaceId=<id>` - Messages for specific workspace

### Artifacts

- `GET /api/artifacts` - List all workspace artifacts
- `GET /api/artifacts/:workspaceId` - Artifacts for specific workspace
- `GET /api/artifacts/:workspaceId/:moduleId` - Files for specific module

### Health

- `GET /api/health` - Server health check + workspace status

---

## Building for Production

### Frontend Build

```bash
npm run build
```

Output: `frontend/dist/` (optimized static files)

### Deployment Options

**Option 1: Tauri Desktop App (recommended)**
- Frontend bundled into Tauri app
- Backend runs as Tauri sidecar process
- See root README for `npm run tauri:build`

**Option 2: Static Hosting + API Server**
```bash
# Build frontend
cd frontend && npm run build

# Serve frontend (any static host)
npx serve dist -p 5173

# Run backend separately
cd ../backend && node server.js
```

**Option 3: Docker**
```dockerfile
# Example Dockerfile (not included)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY backend ./backend
COPY frontend/dist ./frontend/dist
EXPOSE 3001
CMD ["node", "backend/server.js"]
```

---

## Testing

### Backend Tests

```bash
cd backend
npm test
```

### E2E Tests

See `/tmp/e2e-test-report.md` for comprehensive test results.

**Run E2E tests:**
```bash
# Requires Chrome DevTools MCP
claude "Run E2E tests on dashboard"
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

### Code Quality Standards

- **ESLint**: Frontend linting with React rules
- **Prettier**: Code formatting (if configured)
- **Security**: See [SECURITY.md](./SECURITY.md)

### Pull Request Checklist

- [ ] All tests pass
- [ ] No console errors in browser
- [ ] Backend logs clean (no errors)
- [ ] README updated if API/commands changed
- [ ] Screenshots for UI changes

---

## License

MIT License - See [LICENSE](../LICENSE) file

---

## Support

- **Issues**: https://github.com/your-org/agent-squad-os/issues
- **Docs**: See ARCHITECTURE.md for detailed architecture
- **Security**: See SECURITY.md for vulnerability reporting

---

**Built with ❤️ by the Agent Squad Team**
