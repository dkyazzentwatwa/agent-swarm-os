const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { getWorkspaceContext } = require("../services/workspaceReader");

function writeWorkspace(root, id, title) {
  const workspacePath = path.join(root, id);
  fs.mkdirSync(workspacePath, { recursive: true });

  const manifest = {
    schemaVersion: "1.0",
    workspace: {
      id,
      title,
      createdAt: "2026-02-06T00:00:00.000Z",
      templateId: "software-build",
    },
    team: {
      name: "agent-squad-team",
    },
    agents: [],
    groups: [],
    modules: [],
    workflowLanes: [],
  };

  fs.writeFileSync(path.join(workspacePath, "workspace.json"), JSON.stringify(manifest, null, 2));
  return workspacePath;
}

test("getWorkspaceContext returns null for unknown explicit workspaceId", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-reader-test-"));

  writeWorkspace(tmpRoot, "workspace-a", "Workspace A");
  writeWorkspace(tmpRoot, "workspace-b", "Workspace B");

  const context = await getWorkspaceContext({
    workspacesDir: tmpRoot,
    workspaceId: "workspace-missing",
    demoMode: false,
    sampleDataDir: path.join(tmpRoot, "sample-data"),
  });

  assert.equal(context, null);
});

test("getWorkspaceContext still falls back to latest when workspaceId is omitted", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-reader-test-"));

  const wsAPath = writeWorkspace(tmpRoot, "workspace-a", "Workspace A");
  const wsBPath = writeWorkspace(tmpRoot, "workspace-b", "Workspace B");

  const older = new Date("2026-02-05T00:00:00.000Z");
  const newer = new Date("2026-02-06T00:00:00.000Z");
  fs.utimesSync(wsAPath, older, older);
  fs.utimesSync(wsBPath, newer, newer);

  const context = await getWorkspaceContext({
    workspacesDir: tmpRoot,
    workspaceId: null,
    demoMode: false,
    sampleDataDir: path.join(tmpRoot, "sample-data"),
  });

  assert.ok(context);
  assert.equal(context.workspaceId, "workspace-b");
});
