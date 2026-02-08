const express = require("express");
const { getWorkspaceContext } = require("../services/workspaceReader");
const {
  resolveCommsFile,
  readCommsFromFile,
  readSampleComms,
} = require("../services/commsReader");

const router = express.Router();

router.get("/", (req, res) => {
  const { teamName, workspacesDir, demoMode, sampleDataDir } = req.app.locals;
  const since = req.query.since || null;
  const requestedWorkspaceId = req.query.workspaceId || null;

  if (demoMode) {
    const messages = readSampleComms(sampleDataDir, since);
    return res.json({
      messages,
      count: messages.length,
      requestedWorkspaceId,
      workspaceNotFound: false,
    });
  }

  const workspaceContext = getWorkspaceContext({
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

  const commsFile = resolveCommsFile({
    manifest: workspaceContext.manifest,
    teamName,
  });

  const scopedMessages = readCommsFromFile(commsFile, since, {
    workspaceId: workspaceContext.workspaceId,
  });
  return res.json({
    messages: scopedMessages,
    count: scopedMessages.length,
    requestedWorkspaceId,
    workspaceNotFound: false,
  });
});

module.exports = router;
