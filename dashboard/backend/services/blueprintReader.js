const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");

/**
 * Reads and parses JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<Object|null>} Parsed JSON or null
 */
async function readJson(filePath) {
  try {
    await fs.access(filePath);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Reads synthesis metadata (synchronous for backward compatibility)
 * @param {string} workspacePath - Workspace directory path
 * @returns {Object|null} Synthesis metadata
 */
function readSynthesisMeta(workspacePath) {
  try {
    const metaPath = path.join(workspacePath, ".agentsquad", "synthesis.meta.json");
    if (!fsSync.existsSync(metaPath)) return null;
    return JSON.parse(fsSync.readFileSync(metaPath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Reads synthesis metadata (async version)
 * @param {string} workspacePath - Workspace directory path
 * @returns {Promise<Object|null>} Synthesis metadata
 */
async function readSynthesisMetaAsync(workspacePath) {
  const metaPath = path.join(workspacePath, ".agentsquad", "synthesis.meta.json");
  return readJson(metaPath);
}

/**
 * Reads blueprint audit files (synchronous for backward compatibility)
 * @param {string} workspacePath - Workspace directory path
 * @returns {Object} Blueprint audit data
 */
function readBlueprintAudit(workspacePath) {
  const root = path.join(workspacePath, ".agentsquad");
  try {
    return {
      request: fsSync.existsSync(path.join(root, "blueprint.request.json"))
        ? JSON.parse(fsSync.readFileSync(path.join(root, "blueprint.request.json"), "utf-8"))
        : null,
      response: fsSync.existsSync(path.join(root, "blueprint.response.json"))
        ? JSON.parse(fsSync.readFileSync(path.join(root, "blueprint.response.json"), "utf-8"))
        : null,
      validated: fsSync.existsSync(path.join(root, "blueprint.validated.json"))
        ? JSON.parse(fsSync.readFileSync(path.join(root, "blueprint.validated.json"), "utf-8"))
        : null,
      meta: fsSync.existsSync(path.join(root, "synthesis.meta.json"))
        ? JSON.parse(fsSync.readFileSync(path.join(root, "synthesis.meta.json"), "utf-8"))
        : null,
    };
  } catch {
    return {
      request: null,
      response: null,
      validated: null,
      meta: null,
    };
  }
}

/**
 * Reads blueprint audit files (async version)
 * @param {string} workspacePath - Workspace directory path
 * @returns {Promise<Object>} Blueprint audit data
 */
async function readBlueprintAuditAsync(workspacePath) {
  const root = path.join(workspacePath, ".agentsquad");
  return {
    request: await readJson(path.join(root, "blueprint.request.json")),
    response: await readJson(path.join(root, "blueprint.response.json")),
    validated: await readJson(path.join(root, "blueprint.validated.json")),
    meta: await readJson(path.join(root, "synthesis.meta.json")),
  };
}

module.exports = {
  readSynthesisMeta,
  readSynthesisMetaAsync,
  readBlueprintAudit,
  readBlueprintAuditAsync,
};
