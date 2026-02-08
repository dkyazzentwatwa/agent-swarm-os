const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");

/**
 * Lists all workspace directories with their metadata
 * @param {string} workspacesDir - Root workspaces directory
 * @returns {Promise<Array>} Array of workspace entries
 */
async function listWorkspaceEntries(workspacesDir) {
  try {
    if (!workspacesDir || !fsSync.existsSync(workspacesDir)) return [];

    const entries = await fs.readdir(workspacesDir, { withFileTypes: true });
    const workspaces = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => entry.name !== "archive" && !entry.name.startsWith("."))
        .map(async (entry) => {
          const workspacePath = path.join(workspacesDir, entry.name);
          const manifestPath = path.join(workspacePath, "workspace.json");

          try {
            await fs.access(manifestPath);
            const stat = await fs.stat(workspacePath);
            return {
              id: entry.name,
              workspacePath,
              manifestPath,
              mtime: stat.mtimeMs,
            };
          } catch {
            return null;
          }
        })
    );

    return workspaces
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

/**
 * Gets the sample workspace for demo mode
 * @param {string} sampleDataDir - Sample data directory
 * @returns {Promise<Object|null>} Sample workspace entry
 */
async function getSampleWorkspace(sampleDataDir) {
  const workspacePath = path.join(sampleDataDir, "sample-workspace");
  const manifestPath = path.join(workspacePath, "workspace.json");

  try {
    await fs.access(manifestPath);
    const stat = await fs.stat(workspacePath);
    return {
      id: "sample-workspace",
      workspacePath,
      manifestPath,
      mtime: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

/**
 * Reads and parses workspace manifest file
 * @param {string} manifestPath - Path to workspace.json
 * @returns {Promise<Object|null>} Parsed manifest or null
 */
async function readManifest(manifestPath) {
  try {
    const content = await fs.readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(content);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Converts workspace entry to summary format
 * @param {Object} entry - Workspace entry
 * @returns {Promise<Object|null>} Workspace summary
 */
async function toWorkspaceSummary(entry) {
  try {
    const manifest = await readManifest(entry.manifestPath);
    if (!validateManifest(manifest)) return null;

    return {
      id: entry.id,
      title: manifest.workspace?.title || entry.id,
      createdAt: manifest.workspace?.createdAt || null,
      templateId: manifest.workspace?.templateId || null,
      mtime: entry.mtime,
    };
  } catch {
    return null;
  }
}

/**
 * Validates manifest structure
 * @param {Object} manifest - Manifest object
 * @returns {boolean} True if valid
 */
function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") return false;
  if (!manifest.workspace || !manifest.workspace.id) return false;
  if (!manifest.team || !manifest.team.name) return false;
  if (!Array.isArray(manifest.agents)) return false;
  if (!Array.isArray(manifest.groups)) return false;
  if (!Array.isArray(manifest.modules)) return false;
  if (!Array.isArray(manifest.workflowLanes)) return false;
  return true;
}

/**
 * Gets full workspace context including manifest
 * @param {Object} options - Configuration options
 * @returns {Promise<Object|null>} Workspace context
 */
async function getWorkspaceContext({ workspacesDir, workspaceId, demoMode, sampleDataDir }) {
  if (demoMode) {
    const sampleWorkspace = await getSampleWorkspace(sampleDataDir);
    if (!sampleWorkspace) {
      return null;
    }

    if (workspaceId && workspaceId !== sampleWorkspace.id) {
      return null;
    }

    const manifest = await readManifest(sampleWorkspace.manifestPath);
    if (!validateManifest(manifest)) return null;

    return {
      workspaceId: sampleWorkspace.id,
      workspacePath: sampleWorkspace.workspacePath,
      manifest,
    };
  }

  const entries = await listWorkspaceEntries(workspacesDir);
  if (entries.length === 0) return null;

  let selected = entries[0];
  if (workspaceId) {
    const match = entries.find((entry) => entry.id === workspaceId);
    if (!match) return null;
    selected = match;
  }

  const manifest = await readManifest(selected.manifestPath);
  if (!validateManifest(manifest)) return null;

  return {
    workspaceId: selected.id,
    workspacePath: selected.workspacePath,
    manifest,
  };
}

module.exports = {
  listWorkspaceEntries,
  getWorkspaceContext,
  toWorkspaceSummary,
};
