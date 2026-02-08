import { memo } from "react";
import { cn, titleFromId } from "@/lib/utils";
import { AgentAvatar } from "./AgentAvatar";

const STATUS_STYLES = {
  working: { dot: "bg-[var(--status-success)] animate-pulse", label: "Working", text: "text-[var(--status-success)]" },
  idle: { dot: "bg-[var(--text-tertiary)]", label: "Idle", text: "text-[var(--text-secondary)]" },
  waiting: { dot: "bg-[var(--status-warn)] animate-pulse", label: "Waiting", text: "text-[var(--status-warn)]" },
};

/**
 * AgentCard component with memoization to prevent unnecessary re-renders
 * Only re-renders when agent status, name, or current task changes
 */
export const AgentCard = memo(function AgentCard({ agent, onClick }) {
  const statusStyle = STATUS_STYLES[agent.status] || STATUS_STYLES.idle;
  const activityClass =
    agent.status === "working"
      ? "border-[var(--status-success)]/70 shadow-[0_0_0_1px_color-mix(in_srgb,var(--status-success)_35%,transparent)]"
      : agent.status === "waiting"
      ? "border-[var(--status-warn)]/70 shadow-[0_0_0_1px_color-mix(in_srgb,var(--status-warn)_35%,transparent)]"
      : "";

  return (
    <button
      onClick={() => onClick?.(agent.name)}
      className={cn(
        "w-full cursor-pointer rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-[var(--interactive-hover)]",
        activityClass
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AgentAvatar agent={agent} size="md" />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{agent.display || titleFromId(agent.name)}</p>
            <p className="text-xs capitalize text-[var(--text-secondary)]">{agent.groupLabel || titleFromId(agent.role)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("h-2 w-2 rounded-full", statusStyle.dot)} />
          <span className={cn("text-xs font-medium", statusStyle.text)}>{statusStyle.label}</span>
        </div>
      </div>

      {agent.currentTask ? (
        <div className="mt-3 rounded-md bg-[var(--surface-2)] px-3 py-2">
          <p className="mb-0.5 text-xs text-[var(--text-secondary)]">Current task</p>
          <p className="truncate text-sm text-[var(--text-primary)]">{agent.currentTask}</p>
        </div>
      ) : (
        <div className="mt-3 rounded-md bg-[var(--surface-2)] px-3 py-2">
          <p className="text-xs text-[var(--text-secondary)]">No active task</p>
        </div>
      )}
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these specific props change
  return (
    prevProps.agent.name === nextProps.agent.name &&
    prevProps.agent.status === nextProps.agent.status &&
    prevProps.agent.currentTask === nextProps.agent.currentTask &&
    prevProps.agent.display === nextProps.agent.display &&
    prevProps.agent.role === nextProps.agent.role &&
    prevProps.agent.groupLabel === nextProps.agent.groupLabel
  );
});
