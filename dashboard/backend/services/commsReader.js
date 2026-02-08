const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");

/**
 * Resolves comms file path from manifest
 * @param {Object} options - Configuration
 * @param {Object} options.manifest - Workspace manifest
 * @param {string} options.teamName - Team name
 * @returns {string} Resolved file path
 */
function resolveCommsFile({ manifest, teamName }) {
  const template = manifest?.comms?.file || "~/.claude/teams/{teamName}/team-feed.jsonl";
  const withTeam = template.replaceAll("{teamName}", teamName);

  if (withTeam.startsWith("~/")) {
    return path.join(process.env.HOME, withTeam.slice(2));
  }

  return withTeam;
}

/**
 * Extracts workspace ID from message
 * @param {Object} raw - Raw message object
 * @returns {string|null} Workspace ID
 */
function readWorkspaceId(raw) {
  const value = raw?.workspaceId || raw?.workspace_id || raw?.workspace || null;
  if (!value) return null;
  return normalizeWorkspaceId(value);
}

/**
 * Normalizes workspace ID from various formats
 * @param {any} value - Raw workspace ID
 * @returns {string|null} Normalized workspace ID
 */
function normalizeWorkspaceId(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  // Accept either workspace ids directly or workspace paths like workspaces/<id>/...
  const workspacePathMatch = raw.match(/(?:^|\/)workspaces\/([^/]+)/);
  if (workspacePathMatch?.[1]) return workspacePathMatch[1];

  const cleaned = raw.replace(/^\.?\//, "").replace(/\/+$/, "");
  if (cleaned.includes("/")) {
    const parts = cleaned.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  }
  return cleaned;
}

/**
 * Normalizes message object to standard format
 * @param {Object} raw - Raw message object
 * @returns {Object} Normalized message
 */
function normalizeMessage(raw) {
  return {
    timestamp: raw.timestamp || new Date().toISOString(),
    agent: raw.agent || "system",
    type: raw.type || "update",
    message: raw.message || "",
    workspaceId: readWorkspaceId(raw),
  };
}

/**
 * Converts value to timestamp
 * @param {any} value - Value to convert
 * @returns {number|null} Timestamp or null
 */
function toTimestamp(value) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

/**
 * Reads and filters comms messages from JSONL file
 * @param {string} filePath - Path to JSONL file
 * @param {string|null} since - Optional timestamp filter
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Array of messages
 */
async function readCommsFromFile(filePath, since = null, options = {}) {
  try {
    if (!filePath) return [];

    // Check file existence
    try {
      await fs.access(filePath);
    } catch {
      return [];
    }

    const text = await fs.readFile(filePath, "utf-8");
    const lines = text.split("\n").filter(Boolean);
    const sinceTs = toTimestamp(since);
    const selectedWorkspaceId = normalizeWorkspaceId(options.workspaceId || null);
    const allowUnscopedFallback = options.allowUnscopedFallback === true;
    const fallbackWorkspaceId = normalizeWorkspaceId(options.fallbackWorkspaceId || selectedWorkspaceId || null);

    const messages = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const message = normalizeMessage(parsed);
        const messageTs = toTimestamp(message.timestamp);

        if (sinceTs && messageTs && messageTs <= sinceTs) {
          continue;
        }

        if (selectedWorkspaceId) {
          if (message.workspaceId) {
            if (message.workspaceId !== selectedWorkspaceId) {
              continue;
            }
          } else if (allowUnscopedFallback && fallbackWorkspaceId === selectedWorkspaceId) {
            message.workspaceId = selectedWorkspaceId;
          } else {
            continue;
          }
        }

        if (!message.message) {
          continue;
        }
        messages.push(message);
      } catch {
        // Ignore malformed lines.
      }
    }

    return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  } catch {
    return [];
  }
}

/**
 * Reads sample comms for demo mode
 * @param {string} sampleDataDir - Sample data directory
 * @param {string|null} since - Optional timestamp filter
 * @returns {Promise<Array>} Array of messages
 */
async function readSampleComms(sampleDataDir, since = null) {
  const samplePath = path.join(sampleDataDir, "sample-comms.jsonl");
  return readCommsFromFile(samplePath, since);
}

module.exports = {
  resolveCommsFile,
  readCommsFromFile,
  readSampleComms,
};
