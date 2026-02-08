const express = require("express");
const { readTasks, readSampleTasks } = require("../services/taskReader");
const { getWorkspaceContext } = require("../services/workspaceReader");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const {
      demoMode,
      tasksDir,
      workspacesDir,
      sampleDataDir,
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
        tasks: [],
        summary: {
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          blocked: 0,
        },
        lanes: [],
        requestedWorkspaceId,
        workspaceNotFound: Boolean(requestedWorkspaceId),
      });
    }

    const tasks = demoMode
      ? await readSampleTasks(sampleDataDir)
      : await readTasks(tasksDir, workspaceContext.workspacePath, workspaceContext.workspaceId);

    const summary = {
      total: tasks.length,
      completed: tasks.filter((task) => task.status === "completed").length,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      pending: tasks.filter((task) => task.status === "pending").length,
      blocked: tasks.filter(
        (task) =>
          task.status === "blocked" ||
          (task.status === "pending" && Array.isArray(task.blockedBy) && task.blockedBy.length > 0)
      ).length,
    };

    return res.json({
      tasks,
      summary,
      lanes: workspaceContext?.manifest?.workflowLanes || [],
      requestedWorkspaceId,
      workspaceNotFound: false,
    });
  } catch (error) {
    console.error("Error in tasks route:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
