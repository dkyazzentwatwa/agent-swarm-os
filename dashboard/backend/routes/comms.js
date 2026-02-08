const express = require("express");
const fs = require("fs").promises;
const { getWorkspaceContext, listWorkspaceEntries } = require("../services/workspaceReader");
const {
  resolveCommsFile,
  readCommsFromFile,
  readSampleComms,
} = require("../services/commsReader");

const router = express.Router();

/**
 * Counts workspaces for a specific team
 * @param {string} workspacesDir - Workspaces directory
 * @param {string} targetTeamName - Team name to count
 * @returns {Promise<number>} Count of workspaces
 */
async function countWorkspacesForTeam(workspacesDir, targetTeamName) {
  if (!targetTeamName) return 0;
  const entries = await listWorkspaceEntries(workspacesDir);
  let count = 0;

  for (const entry of entries) {
    try {
      const content = await fs.readFile(entry.manifestPath, "utf-8");
      const manifest = JSON.parse(content);
      const teamName = manifest?.team?.name || null;
      if (teamName === targetTeamName) {
        count += 1;
      }
    } catch {
      // Ignore malformed workspace manifests for team counting.
    }
  }

  return count;
}

router.get("/", async (req, res) => {
  try {
    const { teamName, workspacesDir, demoMode, sampleDataDir } = req.app.locals;
    const since = req.query.since || null;
    const requestedWorkspaceId = req.query.workspaceId || null;

    if (demoMode) {
      const messages = await readSampleComms(sampleDataDir, since);
      return res.json({
        messages,
        count: messages.length,
        requestedWorkspaceId,
        workspaceNotFound: false,
      });
    }

    const workspaceContext = await getWorkspaceContext({
      workspacesDir,
      workspaceId: requestedWorkspaceId,
      demoMode,
      sampleDataDir,
    });

    if (!workspaceContext) {
      return res.json({
        messages: [],
        count: 0,
        requestedWorkspaceId,
        workspaceNotFound: Boolean(requestedWorkspaceId),
      });
    }

    const workspaceTeamName = workspaceContext.manifest?.team?.name || teamName;
    const teamWorkspaceCount = await countWorkspacesForTeam(workspacesDir, workspaceTeamName);
    const allowUnscopedFallback = teamWorkspaceCount === 1;

    const commsFile = resolveCommsFile({
      manifest: workspaceContext.manifest,
      teamName: workspaceTeamName,
    });

    const scopedMessages = await readCommsFromFile(commsFile, since, {
      workspaceId: workspaceContext.workspaceId,
      allowUnscopedFallback,
      fallbackWorkspaceId: workspaceContext.workspaceId,
    });

    return res.json({
      messages: scopedMessages,
      count: scopedMessages.length,
      requestedWorkspaceId,
      workspaceNotFound: false,
    });
  } catch (error) {
    console.error("Error in comms route:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
