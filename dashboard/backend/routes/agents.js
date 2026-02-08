const express = require("express");
const { readTasks, readSampleTasks } = require("../services/taskReader");
const { getWorkspaceContext } = require("../services/workspaceReader");

const router = express.Router();

function inferAgentStatus(agentTasks) {

  if (agentTasks.some((task) => task.status === "in_progress")) {
    return {
      status: "working",
      currentTask: agentTasks.find((task) => task.status === "in_progress")?.subject || null,
    };
  }

  const hasBlocked = agentTasks.some(
    (task) =>
      task.status === "blocked" ||
      (task.status === "pending" && Array.isArray(task.blockedBy) && task.blockedBy.length > 0)
  );
  const hasPending = agentTasks.some((task) => task.status === "pending");

  if (hasBlocked) {
    return { status: "waiting", currentTask: null };
  }

  if (hasPending) {
    return { status: "idle", currentTask: null };
  }

  if (agentTasks.length > 0 && agentTasks.every((task) => task.status === "completed")) {
    return { status: "idle", currentTask: null };
  }

  return { status: "idle", currentTask: null };
}

function normalizeEntity(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function matchesAssignee(task, agent) {
  const assignee = normalizeEntity(task.assignee);
  if (!assignee) return false;
  const agentId = normalizeEntity(agent.id);
  const agentName = normalizeEntity(agent.displayName);
  return assignee === agentId || assignee === agentName;
}

router.get("/", async (req, res) => {
  try {
    const {
      demoMode,
      sampleDataDir,
      tasksDir,
      workspacesDir,
    } = req.app.locals;
    const requestedWorkspaceId = req.query.workspaceId || null;

    const workspaceContext = await getWorkspaceContext({
      workspacesDir,
      workspaceId: requestedWorkspaceId,
      demoMode,
      sampleDataDir,
    });

    if (!workspaceContext) {
      return res.json({
        agents: [],
        requestedWorkspaceId,
        workspaceNotFound: Boolean(requestedWorkspaceId),
      });
    }

    const tasks = demoMode
      ? await readSampleTasks(sampleDataDir)
      : await readTasks(tasksDir, workspaceContext.workspacePath, workspaceContext.workspaceId);

    const agents = (workspaceContext.manifest.agents || []).map((agent) => {
      const assignedTasks = tasks.filter((task) => matchesAssignee(task, agent));
      const statusInfo = inferAgentStatus(assignedTasks);

      return {
        name: agent.id,
        display: agent.displayName,
        emoji: agent.emoji,
        color: agent.color,
        role: agent.groupId,
        roleSummary: agent.roleSummary,
        groupId: agent.groupId,
        status: statusInfo.status,
        currentTask: statusInfo.currentTask,
        active: agent.active !== false,
        agentId: agent.id,
        taskCount: assignedTasks.length,
      };
    });

    return res.json({
      agents,
      requestedWorkspaceId,
      workspaceNotFound: false,
    });
  } catch (error) {
    console.error("Error in agents route:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
