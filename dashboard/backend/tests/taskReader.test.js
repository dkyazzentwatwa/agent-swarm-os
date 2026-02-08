const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { readTasks } = require("../services/taskReader");

test("readTasks returns workspace tasks + matching tagged todos only", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "task-reader-test-"));
  const workspaceId = "workspace-1";

  const workspacePath = path.join(tmpRoot, workspaceId);
  fs.mkdirSync(workspacePath, { recursive: true });
  fs.writeFileSync(
    path.join(workspacePath, "tasks.json"),
    JSON.stringify(
      [
        {
          id: "workspace-task-1",
          label: "Workspace Label Subject",
          description: "workspace task from tasks.json",
        },
      ],
      null,
      2
    )
  );

  const todosDir = path.join(tmpRoot, "todos");
  fs.mkdirSync(todosDir, { recursive: true });

  fs.writeFileSync(
    path.join(todosDir, "matching.json"),
    JSON.stringify([
      {
        id: "todo-task-1",
        subject: "Tagged todo",
        workspaceId,
      },
    ])
  );

  fs.writeFileSync(
    path.join(todosDir, "matching-root-key.json"),
    JSON.stringify({
      workspace_id: workspaceId,
      tasks: [
        {
          id: "todo-task-2",
          subject: "Tagged via root workspace_id",
        },
      ],
    })
  );

  fs.writeFileSync(
    path.join(todosDir, "wrong-workspace.json"),
    JSON.stringify([
      {
        id: "todo-task-other",
        subject: "Wrong workspace",
        workspaceId: "workspace-2",
      },
    ])
  );

  fs.writeFileSync(
    path.join(todosDir, "unscoped.json"),
    JSON.stringify([
      {
        id: "todo-task-unscoped",
        subject: "Unscoped global todo",
      },
    ])
  );

  const tasks = await readTasks(todosDir, workspacePath, workspaceId);
  const ids = new Set(tasks.map((task) => task.id));

  assert.equal(ids.has("workspace-task-1"), true);
  assert.equal(ids.has("todo-task-1"), true);
  assert.equal(ids.has("todo-task-2"), true);
  assert.equal(ids.has("todo-task-other"), false);
  assert.equal(ids.has("todo-task-unscoped"), false);

  const workspaceTask = tasks.find((task) => task.id === "workspace-task-1");
  assert.ok(workspaceTask);
  assert.equal(workspaceTask.subject, "Workspace Label Subject");
  assert.equal(workspaceTask.status, "pending");
});
