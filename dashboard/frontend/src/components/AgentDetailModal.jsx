import { Modal } from "./Modal";
import { Tabs } from "./Tabs";
import { StatusBadge } from "./Badge";
import { AgentAvatar } from "./AgentAvatar";
import { timeAgo, titleFromId } from "@/lib/utils";

export function AgentDetailModal({ agent, agents, tasks, coffeeMessages, onClose, onTaskClick }) {
  if (!agent) return null;

  const agentData = agents?.find((item) => item.name === agent);
  const displayName = agentData?.display || titleFromId(agent);
  const status = agentData?.status || "idle";
  const currentTask = agentData?.currentTask;

  const agentTasks = tasks?.filter((task) => task.assignee === agent) || [];
  const completedTasks = agentTasks.filter((task) => task.status === "completed");
  const inProgressTasks = agentTasks.filter((task) => task.status === "in_progress");
  const pendingTasks = agentTasks.filter((task) => task.status === "pending");

  const agentMessages = coffeeMessages?.filter((message) => message.agent === agent) || [];

  const tabs = [
    {
      value: "overview",
      label: "Overview",
      content: (
        <OverviewTab
          currentTask={currentTask}
          completedCount={completedTasks.length}
          inProgressCount={inProgressTasks.length}
          pendingCount={pendingTasks.length}
          onTaskClick={onTaskClick}
          tasks={agentTasks}
        />
      ),
    },
    {
      value: "tasks",
      label: "Tasks",
      count: agentTasks.length,
      content: <TasksTab tasks={agentTasks} onTaskClick={onTaskClick} />,
    },
    {
      value: "comms",
      label: "Comms",
      count: agentMessages.length,
      content: <CommsTab messages={agentMessages} />,
    },
  ];

  return (
    <Modal isOpen={!!agent} onClose={onClose} size="lg">
      <div className="p-4 pb-0">
        <div className="mb-4 flex items-center gap-4">
          <AgentAvatar agent={agentData || { name: agent, emoji: "🤖" }} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{displayName}</h2>
              <span className="text-xl">{agentData?.emoji || "🤖"}</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{agentData?.roleSummary || "Specialized mission role"}</p>
          </div>
          <StatusBadge status={status} />
        </div>
      </div>

      <Tabs tabs={tabs} defaultTab="overview" tabsClassName="px-4" contentClassName="px-4 pb-4" />
    </Modal>
  );
}

function OverviewTab({ currentTask, completedCount, inProgressCount, pendingCount, onTaskClick, tasks }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md bg-[var(--surface-2)] p-3 text-center">
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{completedCount}</p>
          <p className="text-xs text-[var(--text-secondary)]">Completed</p>
        </div>
        <div className="rounded-md bg-[color-mix(in_srgb,var(--status-info)_14%,transparent)] p-3 text-center">
          <p className="text-2xl font-semibold text-[var(--status-info)]">{inProgressCount}</p>
          <p className="text-xs text-[var(--text-secondary)]">In Progress</p>
        </div>
        <div className="rounded-md bg-[var(--surface-2)] p-3 text-center">
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{pendingCount}</p>
          <p className="text-xs text-[var(--text-secondary)]">Pending</p>
        </div>
      </div>

      {currentTask ? (
        <div>
          <h4 className="mb-2 text-sm font-medium text-[var(--text-primary)]">Current Task</h4>
          <div className="rounded-md border border-[var(--status-info)]/30 bg-[color-mix(in_srgb,var(--status-info)_10%,transparent)] p-3">
            <p className="text-sm text-[var(--text-primary)]">{currentTask}</p>
          </div>
        </div>
      ) : null}

      {tasks.length > 0 ? (
        <div>
          <h4 className="mb-2 text-sm font-medium text-[var(--text-primary)]">Recent Activity</h4>
          <div className="space-y-2">
            {tasks.slice(0, 3).map((task) => (
              <button
                key={task.id}
                onClick={() => onTaskClick?.(task)}
                className="w-full rounded-md bg-[var(--surface-2)] p-2 text-left transition-colors hover:bg-[var(--interactive-hover)]"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm text-[var(--text-primary)]">{task.subject}</span>
                  <StatusBadge status={task.status} />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TasksTab({ tasks, onTaskClick }) {
  if (tasks.length === 0) {
    return <p className="py-8 text-center text-[var(--text-secondary)]">No tasks assigned yet</p>;
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    const order = { in_progress: 0, pending: 1, completed: 2 };
    return (order[a.status] || 3) - (order[b.status] || 3);
  });

  return (
    <div className="max-h-[300px] space-y-2 overflow-y-auto">
      {sortedTasks.map((task) => (
        <button
          key={task.id}
          onClick={() => onTaskClick?.(task)}
          className="w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-[var(--interactive-hover)]"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">#{task.id}</span>
            <StatusBadge status={task.status} />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{task.subject}</p>
          {task.completedAt ? (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Completed {timeAgo(task.completedAt)}</p>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function CommsTab({ messages }) {
  if (messages.length === 0) {
    return <p className="py-8 text-center text-[var(--text-secondary)]">No comms messages yet</p>;
  }

  const sortedMessages = [...messages].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="max-h-[300px] space-y-3 overflow-y-auto">
      {sortedMessages.map((message, index) => (
        <div key={index} className="rounded-md bg-[var(--surface-2)] p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="rounded px-1.5 py-0.5 text-xs bg-[var(--surface-3)] text-[var(--text-secondary)]">
              {message.type}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">{timeAgo(message.timestamp)}</span>
          </div>
          <p className="text-sm text-[var(--text-primary)]">{message.message}</p>
        </div>
      ))}
    </div>
  );
}
