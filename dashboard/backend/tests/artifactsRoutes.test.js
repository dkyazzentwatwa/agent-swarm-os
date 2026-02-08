const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");

const artifactsRouter = require("../routes/artifacts");

function createWorkspace(rootDir, workspaceId) {
  const workspacePath = path.join(rootDir, workspaceId);
  fs.mkdirSync(workspacePath, { recursive: true });

  const manifest = {
    schemaVersion: "1.0",
    workspace: {
      id: workspaceId,
      title: "Artifacts Test Workspace",
      createdAt: "2026-02-06T00:00:00.000Z",
      templateId: "software-build",
    },
    team: { name: "agent-squad-team" },
    agents: [],
    groups: [],
    modules: [
      { id: "module-a", label: "Module A", path: "artifacts/module-a" },
      { id: "module-empty", label: "Module Empty", path: "artifacts/module-empty" },
    ],
    workflowLanes: [],
  };

  fs.writeFileSync(path.join(workspacePath, "workspace.json"), JSON.stringify(manifest, null, 2));
  return workspacePath;
}

function createApp(workspacesDir) {
  const app = express();
  app.locals.workspacesDir = workspacesDir;
  app.locals.demoMode = false;
  app.locals.sampleDataDir = path.join(workspacesDir, "__sample__");
  app.use("/api/artifacts", artifactsRouter);
  return app;
}

async function withServer(app, callback) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET /api/artifacts includes module metadata from recursive files", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "artifacts-routes-test-"));
  const workspaceId = "workspace-meta";
  const workspacePath = createWorkspace(tmpRoot, workspaceId);

  const modulePath = path.join(workspacePath, "artifacts/module-a");
  fs.mkdirSync(path.join(modulePath, "docs"), { recursive: true });
  fs.mkdirSync(path.join(modulePath, "data/nested"), { recursive: true });
  fs.writeFileSync(path.join(modulePath, "README.md"), "# hello");
  fs.writeFileSync(path.join(modulePath, "docs/guide.md"), "guide");
  fs.writeFileSync(path.join(modulePath, "data/nested/report.json"), "{\"ok\":true}");

  const app = createApp(tmpRoot);
  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/artifacts?workspaceId=${workspaceId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(Array.isArray(data), true);
    assert.equal(data.length, 1);

    const summary = data[0];
    assert.ok(summary.modules["module-a"]);
    assert.ok(summary.moduleMeta["module-a"]);

    assert.equal(summary.moduleMeta["module-a"].fileCount, 3);
    assert.equal(summary.moduleMeta["module-a"].folderCount, 3);
    assert.equal(summary.moduleMeta["module-a"].typeBreakdown.md, 2);
    assert.equal(summary.moduleMeta["module-a"].typeBreakdown.json, 1);
    assert.equal(typeof summary.moduleMeta["module-a"].lastModified, "string");

    assert.equal(summary.moduleMeta["module-empty"].fileCount, 0);
    assert.equal(summary.moduleMeta["module-empty"].folderCount, 0);
    assert.equal(summary.moduleMeta["module-empty"].lastModified, null);
  });
});

test("GET /api/artifacts/:workspaceId/:moduleId returns content plus metadata fields", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "artifacts-module-test-"));
  const workspaceId = "workspace-module";
  const workspacePath = createWorkspace(tmpRoot, workspaceId);

  const modulePath = path.join(workspacePath, "artifacts/module-a");
  fs.mkdirSync(modulePath, { recursive: true });
  fs.writeFileSync(path.join(modulePath, "notes.txt"), "artifact content");

  const app = createApp(tmpRoot);
  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/artifacts/${workspaceId}/module-a`);
    assert.equal(res.status, 200);
    const files = await res.json();
    assert.equal(Array.isArray(files), true);
    assert.equal(files.length, 1);

    const file = files[0];
    assert.equal(file.name, "notes.txt");
    assert.equal(typeof file.size, "number");
    assert.equal(typeof file.lastModified, "string");
    assert.equal(typeof file.content === "string" || typeof file.error === "string", true);
  });
});
