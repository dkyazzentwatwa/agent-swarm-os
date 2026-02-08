const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { glob } = require("glob");

/**
 * Reads tasks from workspace and todos directory
 * @param {string} tasksDir - Directory containing todo files
 * @param {string} workspacePath - Workspace directory path
 * @param {string|null} workspaceId - Optional workspace ID filter
 * @returns {Promise<Array>} Array of normalized tasks
 */
async function readTasks(tasksDir, workspacePath, workspaceId = null) {
  const tasks = [];

  if (workspacePath) {
    tasks.push(...(await readWorkspaceTasks(workspacePath)));
  }

  tasks.push(...(await readTodosDir(tasksDir, workspaceId)));

  const seen = new Set();
  return tasks.filter((task) => {
    if (!task.id) return true;
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

/**
 * Normalizes workspace ID from various formats
 * @param {any} value - Raw workspace ID value
 * @returns {string|null} Normalized workspace ID
 */
function normalizeWorkspaceId(value) {
  if (!value) return null;
  return String(value).trim();
}

/**
 * Extracts workspace ID from task item or parent data
 * @param {Object} item - Task item
 * @param {Object} parentData - Parent data object
 * @returns {string|null} Workspace ID
 */
function extractWorkspaceId(item, parentData) {
  return normalizeWorkspaceId(
    item.workspaceId ||
      item.workspace_id ||
      item.workspace ||
      parentData?.workspaceId ||
      parentData?.workspace_id ||
      parentData?.workspace ||
      null
  );
}

/**
 * Reads tasks from todos directory
 * @param {string} todosDir - Todos directory path
 * @param {string|null} selectedWorkspaceId - Optional workspace filter
 * @returns {Promise<Array>} Array of tasks
 */
async function readTodosDir(todosDir, selectedWorkspaceId = null) {
  try {
    if (!todosDir || !fsSync.existsSync(todosDir)) return [];

    const files = await glob("**/*.json", { cwd: todosDir, absolute: true });
    const tasks = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const data = JSON.parse(content);
        const items = Array.isArray(data) ? data : data.tasks || [data];

        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const itemWorkspaceId = extractWorkspaceId(item, data);
          if (!itemWorkspaceId) continue;
          if (selectedWorkspaceId && itemWorkspaceId !== selectedWorkspaceId) continue;
          if (item.id || item.subject || item.title || item.name) {
            tasks.push(normalizeTask(item));
          }
        }
      } catch {
        // Ignore malformed todo files.
      }
    }

    return tasks;
  } catch {
    return [];
  }
}

/**
 * Reads tasks from workspace tasks.json file
 * @param {string} workspacePath - Workspace directory path
 * @returns {Promise<Array>} Array of tasks
 */
async function readWorkspaceTasks(workspacePath) {
  try {
    const tasksPath = path.join(workspacePath, "tasks.json");

    try {
      await fs.access(tasksPath);
    } catch {
      return [];
    }

    const content = await fs.readFile(tasksPath, "utf-8");
    const data = JSON.parse(content);
    const items = Array.isArray(data) ? data : data.tasks || [data];

    return items
      .filter((item) => item && typeof item === "object")
      .map((item) => normalizeTask(item));
  } catch {
    return [];
  }
}

/**
 * Normalizes task object to standard format
 * @param {Object} task - Raw task object
 * @returns {Object} Normalized task
 */
function normalizeTask(task) {
  return {
    id: task.id || task.taskId || null,
    subject: task.subject || task.title || task.label || task.name || "Untitled",
    description: task.description || task.body || "",
    status: normalizeStatus(task.status || task.state),
    assignee: task.assignee || task.owner || task.agent || null,
    blockedBy: task.blockedBy || task.dependencies || [],
    blocks: task.blocks || task.dependents || [],
    lane: task.lane || task.laneId || task.phase || null,
    createdAt: task.createdAt || task.created_at || task.created || null,
    completedAt: task.completedAt || task.completed_at || task.completed || null,
  };
}

/**
 * Normalizes task status to standard values
 * @param {string} status - Raw status value
 * @returns {string} Normalized status
 */
function normalizeStatus(status) {
  if (!status) return "pending";
  const lower = String(status).toLowerCase();

  if (lower === "done" || lower === "complete" || lower === "finished") return "completed";
  if (lower === "active" || lower === "running" || lower === "in-progress") return "in_progress";
  if (lower === "blocked" || lower === "waiting") return "blocked";
  if (lower === "todo" || lower === "to-do" || lower === "open") return "pending";
  return lower;
}

/**
 * Reads sample tasks for demo mode
 * @param {string} sampleDataDir - Sample data directory
 * @returns {Promise<Array>} Array of sample tasks
 */
async function readSampleTasks(sampleDataDir) {
  try {
    const file = path.join(sampleDataDir, "sample-workspace", "tasks.json");
    const content = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : parsed.tasks || [];
    return items.map((item) => normalizeTask(item));
  } catch {
    return [];
  }
}

module.exports = {
  readTasks,
  readSampleTasks,
};
