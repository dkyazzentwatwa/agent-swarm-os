const express = require("express");
const fs = require("fs");
const path = require("path");
const { glob } = require("glob");
const { listWorkspaceEntries, getWorkspaceContext } = require("../services/workspaceReader");

const router = express.Router();

function getExtension(filePath) {
  const ext = path.extname(filePath || "").toLowerCase().replace(/^\./, "");
  return ext || "none";
}

function collectModuleMeta(workspacePath, moduleDef) {
  const modulePath = path.join(workspacePath, moduleDef.path || `artifacts/${moduleDef.id}`);
  if (!fs.existsSync(modulePath)) {
    return {
      files: [],
      meta: {
        fileCount: 0,
        folderCount: 0,
        lastModified: null,
        typeBreakdown: {},
        totalSize: 0,
      },
    };
  }

  const files = [];
  const folders = new Set();
  const typeBreakdown = {};
  let latestMtimeMs = 0;
  let totalSize = 0;

  const stack = [{ base: modulePath, current: modulePath }];
  while (stack.length > 0) {
    const node = stack.pop();
    const entries = fs.readdirSync(node.current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(node.current, entry.name);
      if (entry.isDirectory()) {
        const relativeFolderPath = path.relative(node.base, fullPath);
        if (relativeFolderPath && relativeFolderPath !== ".") {
          folders.add(relativeFolderPath);
        }
        stack.push({ base: node.base, current: fullPath });
        continue;
      }

      if (!entry.isFile()) continue;

      const relativeFilePath = path.relative(node.base, fullPath);
      files.push(relativeFilePath);

      try {
        const stat = fs.statSync(fullPath);
        const modifiedMs = stat.mtimeMs || 0;
        if (modifiedMs > latestMtimeMs) latestMtimeMs = modifiedMs;
        totalSize += Number.isFinite(stat.size) ? stat.size : 0;
      } catch {
        // Skip stat failures and keep scanning remaining files.
      }

      const extension = getExtension(relativeFilePath);
      typeBreakdown[extension] = (typeBreakdown[extension] || 0) + 1;
    }
  }

  files.sort((a, b) => a.localeCompare(b));

  return {
    files,
    meta: {
      fileCount: files.length,
      folderCount: folders.size,
      lastModified: latestMtimeMs ? new Date(latestMtimeMs).toISOString() : null,
      typeBreakdown,
      totalSize,
    },
  };
}

router.get("/", async (req, res) => {
  const { workspacesDir, demoMode, sampleDataDir } = req.app.locals;
  const requestedWorkspaceId = req.query.workspaceId || null;

  if (demoMode) {
    const context = getWorkspaceContext({
      workspacesDir,
      workspaceId: requestedWorkspaceId,
      demoMode,
      sampleDataDir,
    });
    if (!context) return res.json([]);

    const modules = {};
    const moduleMeta = {};
    for (const moduleDef of context.manifest.modules) {
      const result = collectModuleMeta(context.workspacePath, moduleDef);
      modules[moduleDef.id] = result.files;
      moduleMeta[moduleDef.id] = result.meta;
    }

    return res.json([
      {
        workspaceId: context.workspaceId,
        title: context.manifest.workspace.title,
        modules,
        moduleMeta,
        moduleCount: Object.keys(modules).length,
      },
    ]);
  }

  const entries = listWorkspaceEntries(workspacesDir);
  const filteredEntries = requestedWorkspaceId
    ? entries.filter((entry) => entry.id === requestedWorkspaceId)
    : entries;
  const summaries = [];

  for (const entry of filteredEntries) {
    try {
      const manifest = JSON.parse(fs.readFileSync(entry.manifestPath, "utf-8"));
      const modules = {};
      const moduleMeta = {};
      for (const moduleDef of manifest.modules || []) {
        const result = collectModuleMeta(entry.workspacePath, moduleDef);
        modules[moduleDef.id] = result.files;
        moduleMeta[moduleDef.id] = result.meta;
      }

      summaries.push({
        workspaceId: entry.id,
        title: manifest.workspace?.title || entry.id,
        modules,
        moduleMeta,
        moduleCount: Object.keys(modules).length,
      });
    } catch {
      // Skip malformed workspace manifests.
    }
  }

  return res.json(summaries);
});

router.get("/:workspaceId", async (req, res) => {
  const { workspacesDir, demoMode, sampleDataDir } = req.app.locals;
  const context = getWorkspaceContext({
    workspacesDir,
    workspaceId: req.params.workspaceId,
    demoMode,
    sampleDataDir,
  });

  if (!context) {
    return res.status(404).json({ error: "Workspace not found" });
  }

  const result = {};
  for (const moduleDef of context.manifest.modules || []) {
    const modulePath = path.join(context.workspacePath, moduleDef.path || `artifacts/${moduleDef.id}`);
    if (!fs.existsSync(modulePath)) {
      result[moduleDef.id] = [];
      continue;
    }

    const files = await glob("**/*", {
      cwd: modulePath,
      nodir: true,
      absolute: false,
    });

    result[moduleDef.id] = files;
  }

  return res.json(result);
});

router.get("/:workspaceId/:moduleId", async (req, res) => {
  const { workspacesDir, demoMode, sampleDataDir } = req.app.locals;
  const context = getWorkspaceContext({
    workspacesDir,
    workspaceId: req.params.workspaceId,
    demoMode,
    sampleDataDir,
  });

  if (!context) {
    return res.status(404).json({ error: "Workspace not found" });
  }

  const moduleDef = (context.manifest.modules || []).find((module) => module.id === req.params.moduleId);
  if (!moduleDef) {
    return res.status(404).json({ error: "Module not found" });
  }

  const modulePath = path.join(context.workspacePath, moduleDef.path || `artifacts/${moduleDef.id}`);
  if (!fs.existsSync(modulePath)) {
    return res.status(404).json({ error: "Module path not found" });
  }

  const files = await glob("**/*", {
    cwd: modulePath,
    nodir: true,
    absolute: true,
  });

  const response = files.map((filePath) => {
    const relativePath = path.relative(modulePath, filePath);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const stat = fs.statSync(filePath);
      return {
        name: relativePath,
        content,
        size: stat.size,
        lastModified: stat.mtime.toISOString(),
      };
    } catch {
      return {
        name: relativePath,
        content: null,
        error: "Could not read file",
      };
    }
  });

  response.sort((a, b) => a.name.localeCompare(b.name));

  return res.json(response);
});

module.exports = router;
