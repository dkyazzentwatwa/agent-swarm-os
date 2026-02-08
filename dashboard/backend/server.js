const express = require("express");
const cors = require("cors");
const path = require("path");
const { initWatchers, getLastChanged } = require("./services/fileWatcher");
const { getWorkspaceContext } = require("./services/workspaceReader");
const { readSynthesisMeta } = require("./services/blueprintReader");
const { apiLimiter, strictLimiter, initLimiter } = require("./middleware/rateLimiter");
const { logger, requestLogger, errorLogger } = require("./middleware/logger");
const { fileLock } = require("./lib/fileLock");

const workspaceRouter = require("./routes/workspace");
const agentsRouter = require("./routes/agents");
const tasksRouter = require("./routes/tasks");
const commsRouter = require("./routes/comms");
const artifactsRouter = require("./routes/artifacts");
const summaryRouter = require("./routes/summary");
const coffeeRoomRouter = require("./routes/coffeeRoom");

const app = express();
const PORT = process.env.PORT || 3001;
const TEAM_NAME = process.env.TEAM_NAME || "agent-squad-team";

const PROJECT_ROOT = path.resolve(__dirname, "../..");

app.use(cors());
app.use(express.json());

// Logging: Log all requests
app.use(requestLogger);

// SECURITY: Apply rate limiting to all API routes
app.use("/api/", apiLimiter);

app.locals.teamName = TEAM_NAME;
app.locals.workspacesDir =
  process.env.WORKSPACES_DIR || path.join(PROJECT_ROOT, "workspaces");
app.locals.teamsDir =
  process.env.TEAMS_DIR || path.join(process.env.HOME, ".claude/teams", TEAM_NAME);
app.locals.tasksDir =
  process.env.TASKS_DIR || path.join(process.env.HOME, ".claude/todos");
app.locals.demoMode = process.env.DEMO_MODE === "true";
app.locals.sampleDataDir = path.join(__dirname, "sample-data");

app.use("/api/workspace", workspaceRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/comms", commsRouter);
app.use("/api/artifacts", artifactsRouter);
app.use("/api/summary", summaryRouter);

// Backward compatibility aliases
app.use("/api/coffee-room", coffeeRoomRouter);
app.use("/api/content", artifactsRouter);

app.get("/api/health", async (req, res) => {
  try {
    const workspaceContext = await getWorkspaceContext({
      workspacesDir: app.locals.workspacesDir,
      demoMode: app.locals.demoMode,
      sampleDataDir: app.locals.sampleDataDir,
    });

    const synthesisMeta = workspaceContext
      ? readSynthesisMeta(workspaceContext.workspacePath)
      : null;

    const lockStatus = fileLock.getStatus();

    res.json({
      status: "ok",
      appName: "Agent Squad",
      teamName: TEAM_NAME,
      demoMode: app.locals.demoMode,
      workspaceId: workspaceContext?.workspaceId || null,
      synthesisMode: synthesisMeta?.synthesisMode || null,
      fallbackUsed: synthesisMeta?.fallbackUsed || false,
      lastChanged: getLastChanged(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      fileLocks: lockStatus.totalLocks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message, stack: error.stack });
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

// Prometheus-compatible metrics endpoint
app.get("/metrics", (req, res) => {
  try {
    const mem = process.memoryUsage();
    const lockStatus = fileLock.getStatus();

    // Prometheus text format
    const metrics = [
      '# HELP process_uptime_seconds Process uptime in seconds',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime()}`,
      '',
      '# HELP process_memory_heap_used_bytes Process heap memory used in bytes',
      '# TYPE process_memory_heap_used_bytes gauge',
      `process_memory_heap_used_bytes ${mem.heapUsed}`,
      '',
      '# HELP process_memory_heap_total_bytes Process total heap memory in bytes',
      '# TYPE process_memory_heap_total_bytes gauge',
      `process_memory_heap_total_bytes ${mem.heapTotal}`,
      '',
      '# HELP process_memory_rss_bytes Process resident set size in bytes',
      '# TYPE process_memory_rss_bytes gauge',
      `process_memory_rss_bytes ${mem.rss}`,
      '',
      '# HELP file_locks_active Number of active file locks',
      '# TYPE file_locks_active gauge',
      `file_locks_active ${lockStatus.totalLocks}`,
      '',
    ].join('\n');

    res.type('text/plain').send(metrics);
  } catch (error) {
    logger.error('Metrics endpoint failed', { error: error.message });
    res.status(500).send('# Error generating metrics\n');
  }
});

// Error logging middleware (must be after routes)
app.use(errorLogger);

initWatchers({
  teamsDir: app.locals.teamsDir,
  tasksDir: app.locals.tasksDir,
  workspacesDir: app.locals.workspacesDir,
});

app.listen(PORT, () => {
  logger.info('Agent Squad backend started', {
    port: PORT,
    team: TEAM_NAME,
    demoMode: app.locals.demoMode,
    nodeEnv: process.env.NODE_ENV || 'development',
  });

  // Also log to console for backwards compatibility
  console.log(`Agent Squad backend running on port ${PORT}`);
  console.log(`Team: ${TEAM_NAME}`);
  console.log(`Demo mode: ${app.locals.demoMode}`);
});
