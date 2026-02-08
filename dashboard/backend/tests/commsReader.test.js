const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { readCommsFromFile } = require("../services/commsReader");

test("readCommsFromFile keeps only selected workspace messages and supports workspace key variants", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "comms-reader-test-"));
  const filePath = path.join(tmpRoot, "team-feed.jsonl");

  const lines = [
    {
      timestamp: "2026-02-06T10:00:00.000Z",
      workspaceId: "workspace-1",
      agent: "a",
      type: "update",
      message: "using workspaceId",
    },
    {
      timestamp: "2026-02-06T10:01:00.000Z",
      workspace_id: "workspace-1",
      agent: "b",
      type: "insight",
      message: "using workspace_id",
    },
    {
      timestamp: "2026-02-06T10:02:00.000Z",
      workspace: "workspace-1",
      agent: "c",
      type: "blocker",
      message: "using workspace",
    },
    {
      timestamp: "2026-02-06T10:03:00.000Z",
      agent: "d",
      type: "update",
      message: "unscoped should be excluded",
    },
    {
      timestamp: "2026-02-06T10:04:00.000Z",
      workspaceId: "workspace-2",
      agent: "e",
      type: "update",
      message: "different workspace",
    },
  ];

  fs.writeFileSync(filePath, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");

  const messages = readCommsFromFile(filePath, null, { workspaceId: "workspace-1" });

  assert.equal(messages.length, 3);
  assert.deepEqual(
    messages.map((msg) => msg.workspaceId),
    ["workspace-1", "workspace-1", "workspace-1"]
  );
  assert.equal(messages.some((msg) => msg.message.includes("unscoped")), false);
  assert.equal(messages.some((msg) => msg.message.includes("different workspace")), false);
});

test("readCommsFromFile respects since filtering", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "comms-reader-test-"));
  const filePath = path.join(tmpRoot, "team-feed.jsonl");

  const lines = [
    {
      timestamp: "2026-02-06T10:00:00.000Z",
      workspaceId: "workspace-1",
      agent: "a",
      type: "update",
      message: "old",
    },
    {
      timestamp: "2026-02-06T10:05:00.000Z",
      workspaceId: "workspace-1",
      agent: "b",
      type: "update",
      message: "new",
    },
  ];

  fs.writeFileSync(filePath, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");

  const messages = readCommsFromFile(filePath, "2026-02-06T10:02:00.000Z", { workspaceId: "workspace-1" });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].message, "new");
});

test("readCommsFromFile can map unscoped messages to selected workspace when fallback is enabled", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "comms-reader-test-"));
  const filePath = path.join(tmpRoot, "team-feed.jsonl");

  const lines = [
    {
      timestamp: "2026-02-06T10:00:00.000Z",
      agent: "a",
      type: "update",
      message: "unscoped message",
    },
    {
      timestamp: "2026-02-06T10:01:00.000Z",
      workspaceId: "workspaces/workspace-1",
      agent: "b",
      type: "update",
      message: "workspace path format",
    },
    {
      timestamp: "2026-02-06T10:02:00.000Z",
      workspaceId: "workspace-2",
      agent: "c",
      type: "update",
      message: "other workspace",
    },
  ];

  fs.writeFileSync(filePath, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");

  const withoutFallback = readCommsFromFile(filePath, null, { workspaceId: "workspace-1" });
  assert.equal(withoutFallback.length, 1);
  assert.equal(withoutFallback[0].message, "workspace path format");

  const withFallback = readCommsFromFile(filePath, null, {
    workspaceId: "workspace-1",
    allowUnscopedFallback: true,
    fallbackWorkspaceId: "workspace-1",
  });
  assert.equal(withFallback.length, 2);
  assert.equal(withFallback.some((message) => message.message === "unscoped message"), true);
  assert.equal(withFallback.every((message) => message.workspaceId === "workspace-1"), true);
});
