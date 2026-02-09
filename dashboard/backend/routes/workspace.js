const express = require("express");
const fs = require("fs").promises;
const path = require("path");
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

router.delete("/:workspaceId", async (req, res) => {
  try {
    const { workspacesDir, demoMode } = req.app.locals;
    const { workspaceId } = req.params;
    const { archive = false } = req.query;

    if (demoMode) {
      return res.status(403).json({ error: "Cannot delete workspaces in demo mode" });
    }

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace ID is required" });
    }

    const workspaceContext = await getWorkspaceContext({
      workspacesDir,
      workspaceId,
      demoMode: false,
    });

    if (!workspaceContext) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const workspacePath = workspaceContext.workspacePath;

    if (archive) {
      // Archive mode: move to archived directory
      const archiveDir = path.join(workspacesDir, ".archived");
      await fs.mkdir(archiveDir, { recursive: true });

      const archivedPath = path.join(archiveDir, workspaceId);
      await fs.rename(workspacePath, archivedPath);

      return res.json({
        ok: true,
        message: "Workspace archived successfully",
        workspaceId,
        archivedPath,
      });
    } else {
      // Delete mode: permanently remove
      await fs.rm(workspacePath, { recursive: true, force: true });

      return res.json({
        ok: true,
        message: "Workspace deleted successfully",
        workspaceId,
      });
    }
  } catch (error) {
    console.error("Error deleting workspace:", error);
    return res.status(500).json({
      error: "Failed to delete workspace",
      details: error.message
    });
  }
});

module.exports = router;
