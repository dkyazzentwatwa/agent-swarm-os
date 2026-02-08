const chokidar = require("chokidar");
const fs = require("fs");
const path = require("path");

let lastChanged = {
  teams: 0,
  tasks: 0,
  workspaces: 0,
};

let watchers = [];

function watchDir(dir, key) {
  const options = {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    ignorePermissionErrors: true,
  };

  if (!fs.existsSync(dir)) {
    const parent = path.dirname(dir);
    const target = path.basename(dir);

    if (!fs.existsSync(parent)) {
      try {
        fs.mkdirSync(parent, { recursive: true });
      } catch {
        return null;
      }
    }

    const parentWatcher = chokidar.watch(parent, { ...options, depth: 1 });
    let childWatcher = null;

    parentWatcher.on("all", (_, filePath) => {
      if (filePath && filePath.startsWith(dir)) {
        lastChanged[key] = Date.now();
      }
    });

    parentWatcher.on("addDir", (addedPath) => {
      if (path.basename(addedPath) === target && !childWatcher) {
        childWatcher = chokidar.watch(dir, options);
        childWatcher.on("all", () => {
          lastChanged[key] = Date.now();
        });
        watchers.push(childWatcher);
      }
    });

    return parentWatcher;
  }

  const watcher = chokidar.watch(dir, options);
  watcher.on("all", () => {
    lastChanged[key] = Date.now();
  });
  return watcher;
}

function initWatchers({ teamsDir, tasksDir, workspacesDir }) {
  const teamWatcher = watchDir(teamsDir, "teams");
  const taskWatcher = watchDir(tasksDir, "tasks");
  const workspaceWatcher = watchDir(workspacesDir, "workspaces");

  watchers = [teamWatcher, taskWatcher, workspaceWatcher].filter(Boolean);
}

function getLastChanged() {
  return { ...lastChanged };
}

function cleanup() {
  watchers.forEach((watcher) => watcher.close());
}

module.exports = {
  initWatchers,
  getLastChanged,
  cleanup,
};
