# Repository Guidelines

## Project Structure & Module Organization
`social-claude/` is a multi-agent content pipeline with a dashboard UI. Key paths:

- `agent-prompts/`: personality prompts for each agent role.
- `content/`: generated content by topic (`content/{YYYY-MM-DD}-{slug}/`).
- `dashboard/backend/`: Express API + chokidar watcher.
- `dashboard/frontend/`: React + Vite dashboard UI.
- `scripts/`: workflow scripts (`init`, `start`, `reset`).
- `templates/`: reusable content templates.

The `content/archive/` folder stores completed work. Avoid manual edits there unless updating historic assets.

## Build, Test, and Development Commands
Run installs separately for backend and frontend:

- `cd dashboard/backend && npm install`
- `cd dashboard/frontend && npm install`

Common commands from the repo root:

- `npm run dashboard:demo`: run backend + frontend with sample data.
- `npm run start`: run live mode (expects an active agent team).
- `npm run init "Idea title"`: create a new content workspace.
- `npm run reset`: archive current content to `content/archive/`.
- `npm run build`: build the frontend for production.

## Coding Style & Naming Conventions
- JavaScript/React uses 2-space indentation, semicolons, and double quotes (see `dashboard/frontend/src/`).
- Use `camelCase` for variables/functions and `PascalCase` for React components.
- Keep CSS in `dashboard/frontend/src/index.css` or component-level styling patterns already in use.
- Lint with `cd dashboard/frontend && npm run lint` (ESLint).

## Testing Guidelines
There are no automated tests in this repo yet. Use:

- `npm run lint` in `dashboard/frontend` for static checks.
- Manual verification via `npm run dashboard:demo` and `npm run start`.

If you add tests, colocate them next to modules (e.g., `Component.test.jsx`) and document the command in this file.

## Commit & Pull Request Guidelines
Git history uses short, imperative commit messages (e.g., “Build dashboard backend with Express API”).

- Keep the first line under ~72 characters.
- Include a concise PR description with what changed and why.
- Attach screenshots or short clips for dashboard UI changes.
- Link related issues or tasks if available.

## Content Workflow & Agent Rules
- Follow `brand-config.md` for voice and platform rules.
- Content lives under `content/{YYYY-MM-DD}-{slug}/` with platform subfolders.
- Each platform agent owns their subfolder; only Visual Designer/Content Librarian edit `shared-assets/`.
- Post updates to the coffee room log as described in `CLAUDE.md` after major tasks.
