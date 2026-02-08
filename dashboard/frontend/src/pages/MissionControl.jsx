import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAgents } from "@/hooks/useAgents";
import { useTasks } from "@/hooks/useTasks";
import { useCoffeeRoom } from "@/hooks/useCoffeeRoom";
import { TaskProgress } from "@/components/TaskProgress";
import { WeeklyCalendar } from "@/components/WeeklyCalendar";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ActivityDetailModal } from "@/components/ActivityDetailModal";
import { AgentDetailModal } from "@/components/AgentDetailModal";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { AgentGroup } from "@/components/AgentGroup";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatTile } from "@/components/ui/StatTile";
import { timeAgo } from "@/lib/utils";

function RunbookPanel({ tasks = [], messages = [] }) {
  const blockers = tasks.filter((task) => task.status === "blocked" || (task.blockedBy || []).length > 0).length;
  const inProgress = tasks.filter((task) => task.status === "in_progress").length;
  const staleComms = (() => {
    const latest = messages[messages.length - 1];
    return !latest?.timestamp;
  })();

  const actions = [];
  if (inProgress === 0) actions.push("Kick off at least one pending task to keep flow active.");
  if (blockers > 0) actions.push("Escalate blocker items and request unblock plans in Comms.");
  if (staleComms) actions.push("Request a fresh status update in team feed (no recent comms).");
  if (actions.length === 0) actions.push("System healthy: keep monitoring throughput and final summary quality.");

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Runbook: suggested next actions</h3>
      <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
        {actions.slice(0, 3).map((item) => (
          <li key={item} className="rounded-md border border-border bg-[var(--surface-2)] px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function MissionControl() {
  const navigate = useNavigate();
  const { workspaceId, workspaceData } = useOutletContext();
  const { data: agents, isLoading: agentsLoading, refetch: refetchAgents } = useAgents(workspaceId);
  const { data: taskData, refetch: refetchTasks } = useTasks(workspaceId);
  const { data: commsData, refetch: refetchComms } = useCoffeeRoom(workspaceId);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const manifest = workspaceData?.manifest;
  const safeAgents = agents || [];
  const tasks = taskData?.tasks || [];
  const messages = commsData?.messages || [];
  const workingAgents = safeAgents.filter((agent) => agent.status === "working").length;
  const inProgressTasks = taskData?.summary?.inProgress || 0;
  const latestMessage = messages[messages.length - 1];
  const lastActivityTime =
    latestMessage?.timestamp || tasks.find((task) => task.status === "in_progress")?.createdAt;

  const groups = manifest?.groups || [];
  const lanes = manifest?.workflowLanes || manifest?.dashboard?.workflowLanes || [];
  const missionTitle = manifest?.workspace?.title || "Mission";

  const staleComms = useMemo(() => {
    return !latestMessage?.timestamp;
  }, [latestMessage]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchAgents(),
        refetchTasks(),
        refetchComms()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mission"
        description={missionTitle}
        actions={
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-md border border-border bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] disabled:opacity-60"
            title="Refresh all data"
          >
            <RefreshIcon className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Active Agents"
          value={`${workingAgents}/${safeAgents.length}`}
          status={workingAgents > 0 ? "success" : "neutral"}
          icon={<UsersIcon />}
          helper="Click to open lead-focused tasks"
          onClick={() => navigate("/tasks?preset=lead")}
        />
        <StatTile
          label="Tasks In Progress"
          value={inProgressTasks}
          status={inProgressTasks > 0 ? "info" : "neutral"}
          icon={<SparkIcon />}
          helper="Click to open in-progress queue"
          onClick={() => navigate("/tasks?preset=in_progress")}
        />
        <StatTile
          label="Latest Message"
          value={latestMessage?.message?.slice(0, 32) + (latestMessage?.message?.length > 32 ? "..." : "") || "None yet"}
          status={latestMessage ? "info" : "neutral"}
          icon={<MessageIcon />}
          helper="Click to open comms"
          onClick={() => navigate("/comms")}
        />
        <StatTile
          label="Last Activity"
          value={lastActivityTime ? timeAgo(lastActivityTime) : "No activity"}
          status={lastActivityTime ? "success" : "neutral"}
          icon={<ClockIcon />}
          helper={staleComms ? "Comms may be stale, click to review" : "Click for summary/handoff"}
          onClick={() => navigate(staleComms ? "/comms" : "/summary")}
        />
      </div>

      <section>
        <SectionTitle title="Agent Team" subtitle="Grouped by role and workload" />
        {agentsLoading ? (
          <div className="space-y-3">
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-24" />
          </div>
        ) : (
          <AgentGroup agents={safeAgents} groups={groups} onAgentClick={(name) => setSelectedAgent(name)} />
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TaskProgress summary={taskData?.summary} />
        <WeeklyCalendar lanes={lanes} />
      </div>

      <RunbookPanel tasks={tasks} messages={messages} />

      <ActivityTimeline
        key={`timeline-${workspaceId || "latest"}`}
        tasks={tasks}
        coffeeMessages={messages}
        scopeKey={workspaceId}
        onEventClick={(event) => {
          setSelectedActivity(event);
          if (event?.taskId) {
            const task = tasks.find((item) => item.id === event.taskId);
            if (task) {
              setSelectedTask(task);
              return;
            }
          }
        }}
      />

      <AgentDetailModal
        agent={selectedAgent}
        agents={agents}
        tasks={tasks}
        coffeeMessages={messages}
        onClose={() => setSelectedAgent(null)}
        onTaskClick={(task) => {
          setSelectedAgent(null);
          setSelectedTask(task);
        }}
      />

      <TaskDetailModal
        task={selectedTask}
        tasks={tasks}
        onClose={() => setSelectedTask(null)}
        onAgentClick={(agentName) => {
          setSelectedTask(null);
          setSelectedAgent(agentName);
        }}
      />

      <ActivityDetailModal
        event={selectedActivity}
        tasks={tasks}
        onClose={() => setSelectedActivity(null)}
        onOpenTask={(task) => {
          setSelectedActivity(null);
          setSelectedTask(task);
        }}
      />
    </div>
  );
}

function UsersIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function RefreshIcon({ className = "" }) {
  return (
    <svg className={`h-4 w-4 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  );
}
