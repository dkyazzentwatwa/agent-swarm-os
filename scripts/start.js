#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const TEAM_NAME = process.env.TEAM_NAME || "agent-squad-team";
const TEAMS_DIR = path.join(process.env.HOME, ".claude/teams", TEAM_NAME);
const WORKSPACES_DIR = path.join(PROJECT_ROOT, "workspaces");

console.log("");
console.log("  Agent Squad — Live Dashboard");
console.log("  ============================");
console.log("");

if (!fs.existsSync(TEAMS_DIR)) {
  console.log("  Team directory not found yet.");
  console.log(`  Expected: ${TEAMS_DIR}`);
  console.log("  The dashboard will still run and auto-refresh when team files appear.");
  console.log("");
}

const workspaceFolders = fs.existsSync(WORKSPACES_DIR)
  ? fs
      .readdirSync(WORKSPACES_DIR)
      .filter((entry) => !entry.startsWith("."))
      .filter((entry) => fs.existsSync(path.join(WORKSPACES_DIR, entry, "workspace.json")))
  : [];

if (workspaceFolders.length === 0) {
  console.log("  No workspace found. Create one first:");
  console.log('    npm run init -- -t "Your mission topic" -a 6');
  console.log("");
}

console.log("  Starting dashboard (backend + frontend)...");
console.log("  Dashboard: http://localhost:5173");
console.log("  API:       http://localhost:3001");
console.log("");
console.log("  Start Claude team in another terminal:");
console.log("    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --teammate-mode in-process");
console.log("  Autonomous mode (dangerous):");
console.log("    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --teammate-mode in-process --dangerously-skip-permissions");
console.log("");

const child = spawn("npm", ["run", "dashboard"], {
  cwd: PROJECT_ROOT,
  stdio: "inherit",
  env: { ...process.env, DEMO_MODE: undefined },
});

child.on("exit", (code) => process.exit(code || 0));
