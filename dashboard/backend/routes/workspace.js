const express = require("express");
const {
  getWorkspaceContext,
  listWorkspaceEntries,
  toWorkspaceSummary,
} = require("../services/workspaceReader");
const { readSynthesisMeta, readBlueprintAudit } = require("../services/blueprintReader");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { workspacesDir, demoMode, sampleDataDir } = req.app.locals;
    const requestedWorkspaceId = req.query.workspaceId || null;

    // Build workspaces list async
    let workspaces = [];
    if (!demoMode) {
      const entries = await listWorkspaceEntries(workspacesDir);
      const summaries = await Promise.all(
        entries.map((entry) => toWorkspaceSummary(entry))
      );
      workspaces = summaries.filter(Boolean);
    }

    // Get workspace context async
    const workspaceContext = await getWorkspaceContext({
      workspacesDir,
      workspaceId: requestedWorkspaceId,
      demoMode,
      sampleDataDir,
    });

    if (!workspaceContext) {
      if (demoMode) {
        return res.json({
          error: "No workspace found",
          manifest: null,
          workspaceId: null,
          workspaces: [],
          requestedWorkspaceId,
          workspaceNotFound: Boolean(requestedWorkspaceId),
        });
      }

      return res.json({
        error: requestedWorkspaceId ? "Workspace not found" : "No workspace found",
        manifest: null,
        workspaceId: null,
        workspaces,
        requestedWorkspaceId,
        workspaceNotFound: Boolean(requestedWorkspaceId),
      });
    }

    const meta = readSynthesisMeta(workspaceContext.workspacePath);
    const resolvedWorkspaces = demoMode
      ? [{ id: workspaceContext.workspaceId, title: workspaceContext.manifest.workspace?.title || "Sample Workspace" }]
      : workspaces;

    return res.json({
      workspaceId: workspaceContext.workspaceId,
      manifest: workspaceContext.manifest,
      synthesis: meta,
      workspaces: resolvedWorkspaces,
      requestedWorkspaceId,
      workspaceNotFound: false,
    });
  } catch (error) {
    console.error("Error in workspace route:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:workspaceId/blueprint", async (req, res) => {
  try {
    const { workspacesDir, demoMode, sampleDataDir } = req.app.locals;
    const workspaceContext = await getWorkspaceContext({
      workspacesDir,
      workspaceId: req.params.workspaceId,
      demoMode,
      sampleDataDir,
    });

    if (!workspaceContext) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    return res.json(readBlueprintAudit(workspaceContext.workspacePath));
  } catch (error) {
    console.error("Error in blueprint route:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
