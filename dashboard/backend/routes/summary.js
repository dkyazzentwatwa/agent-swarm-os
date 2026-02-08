const express = require("express");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { getWorkspaceContext } = require("../services/workspaceReader");
const { validatePathInWorkspace, isSuspiciousPath } = require("../lib/pathValidation");

const router = express.Router();

const DEFAULT_SUMMARY_PATH = "artifacts/summary/summary.md";
const FALLBACK_KEYWORDS = ["summary", "final", "overview", "handoff", "report", "executive", "brief"];
const ALLOWED_EXTENSIONS = new Set([".md", ".txt"]);

function resolveSummaryPath(workspacePath, manifest) {
  const summaryFile = manifest?.dashboard?.summaryFile || DEFAULT_SUMMARY_PATH;
  const normalized = summaryFile.replace(/^\/+/, "");
  return path.join(workspacePath, normalized);
}

function findFallbackSummary(workspacePath) {
  const artifactsDir = path.join(workspacePath, "artifacts");
  if (!fs.existsSync(artifactsDir)) return null;

  const stack = [artifactsDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      const nameLower = entry.name.toLowerCase();
      if (FALLBACK_KEYWORDS.some((keyword) => nameLower.includes(keyword))) {
        return fullPath;
      }
    }
  }

  return null;
}

function discoverSummaryCandidates(workspacePath, manifest) {
  const expectedSummaryPath = resolveSummaryPath(workspacePath, manifest);
  const candidates = [];
  const seen = new Set();

  function addCandidate(absolutePath, rank = 10) {
    if (!absolutePath || !fs.existsSync(absolutePath)) return;
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) return;

    const relativePath = path.relative(workspacePath, absolutePath);
    if (seen.has(relativePath)) return;
    seen.add(relativePath);

    const ext = path.extname(relativePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) return;

    const basename = path.basename(relativePath).toLowerCase();
    const fullLower = relativePath.toLowerCase();
    const keywordHits = FALLBACK_KEYWORDS.reduce((count, keyword) => count + (fullLower.includes(keyword) ? 1 : 0), 0);
    const isExpected = path.resolve(absolutePath) === path.resolve(expectedSummaryPath);
    const computedRank = isExpected ? -100 : rank - keywordHits;

    candidates.push({
      file: relativePath,
      lastModified: stat.mtime.toISOString(),
      size: stat.size,
      isExpected,
      keywordHits,
      rank: computedRank + (basename.includes("summary") ? -2 : 0),
    });
  }

  addCandidate(expectedSummaryPath, -50);

  const artifactsDir = path.join(workspacePath, "artifacts");
  if (fs.existsSync(artifactsDir)) {
    const stack = [artifactsDir];
    while (stack.length > 0) {
      const current = stack.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });
      entries.forEach((entry) => {
        if (entry.name.startsWith(".")) return;
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          return;
        }
        if (!entry.isFile()) return;
        const relativePath = path.relative(workspacePath, fullPath).toLowerCase();
        const ext = path.extname(relativePath);
        if (!ALLOWED_EXTENSIONS.has(ext)) return;
        if (!FALLBACK_KEYWORDS.some((keyword) => relativePath.includes(keyword))) return;
        addCandidate(fullPath, 20);
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const aTime = Date.parse(a.lastModified || "") || 0;
    const bTime = Date.parse(b.lastModified || "") || 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.file.localeCompare(b.file);
  });

  return candidates;
}

router.get("/", async (req, res) => {
  try {
    const { workspacesDir, demoMode, sampleDataDir } = req.app.locals;
    const requestedWorkspaceId = req.query.workspaceId || null;

    const workspaceContext = await getWorkspaceContext({
      workspacesDir,
      workspaceId: requestedWorkspaceId,
      demoMode,
      sampleDataDir,
    });

    if (!workspaceContext) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const requestedFile = String(req.query.file || "").replace(/^\/+/, "");

    // SECURITY: Validate path to prevent traversal attacks
    if (requestedFile && isSuspiciousPath(requestedFile)) {
      return res.status(400).json({
        error: 'Invalid file path: suspicious pattern detected'
      });
    }

    const summaryPath = resolveSummaryPath(workspaceContext.workspacePath, workspaceContext.manifest);
    const expectedRelativePath = path.relative(workspaceContext.workspacePath, summaryPath);
    const candidates = discoverSummaryCandidates(workspaceContext.workspacePath, workspaceContext.manifest);

    let resolvedPath = summaryPath;
    if (requestedFile) {
      try {
        // SECURITY: Use path validation utility
        const validatedPath = validatePathInWorkspace(
          workspaceContext.workspacePath,
          requestedFile
        );
        try {
          await fs.access(validatedPath);
          resolvedPath = validatedPath;
        } catch {
          // File doesn't exist, keep default
        }
      } catch (error) {
        return res.status(400).json({
          error: 'Path validation failed',
          message: error.message
        });
      }
    }

    try {
      await fs.access(resolvedPath);
    } catch {
      const candidateFallback = candidates[0]?.file ? path.join(workspaceContext.workspacePath, candidates[0].file) : null;
      const fallback = candidateFallback || findFallbackSummary(workspaceContext.workspacePath);
      if (fallback) resolvedPath = fallback;
    }

    try {
      await fs.access(resolvedPath);
    } catch {
      return res.json({
        workspaceId: workspaceContext.workspaceId,
        file: expectedRelativePath,
        content: "",
        expectedPath: expectedRelativePath,
        summaries: candidates,
      });
    }

    const content = await fs.readFile(resolvedPath, "utf-8");
    const selectedRelativePath = path.relative(workspaceContext.workspacePath, resolvedPath);
    return res.json({
      workspaceId: workspaceContext.workspaceId,
      file: selectedRelativePath,
      content,
      expectedPath: expectedRelativePath,
      summaries: candidates,
    });
  } catch (err) {
    console.error("Error in summary route:", err);
    return res.status(500).json({ error: "Unable to read summary file" });
  }
});

module.exports = router;
