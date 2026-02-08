import { Modal } from "./Modal";
import { StatusBadge } from "./Badge";
import { AgentAvatar } from "./AgentAvatar";
import { timeAgo } from "@/lib/utils";

export function TaskDetailModal({ task, tasks, onClose, onAgentClick }) {
  if (!task) return null;

  const blockedByTasks = task.blockedBy
    ? tasks?.filter((t) => task.blockedBy.includes(t.id))
    : [];
  const blocksTasks = task.blocks
    ? tasks?.filter((t) => task.blocks.includes(t.id))
    : [];

  const timeline = [
    { label: "Created", time: task.createdAt, done: true },
    {
      label: "In Progress",
      time: task.startedAt,
      done: task.status === "in_progress" || task.status === "completed",
      active: task.status === "in_progress",
    },
    {
      label: "Completed",
      time: task.completedAt,
      done: task.status === "completed",
    },
  ];

  return (
    <Modal
      isOpen={!!task}
      onClose={onClose}
      title={task.subject}
      subtitle={`Task #${task.id}`}
      size="lg"
    >
      <div className="p-4 space-y-6">
        {/* Status and Assignee */}
        <div className="flex items-center justify-between">
          <StatusBadge status={task.status} />
          {task.assignee && (
            <button
              onClick={() => onAgentClick?.(task.assignee)}
              className="flex items-center gap-2 hover:bg-[var(--surface-3)] rounded-md px-2 py-1 transition-colors"
            >
              <AgentAvatar agent={task.assignee} size="sm" />
              <span className="text-sm font-medium capitalize">
                {task.assignee.split("-").join(" ")}
              </span>
            </button>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div>
            <h4 className="text-sm font-medium mb-2">Description</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        )}

        {/* Timeline */}
        <div>
          <h4 className="text-sm font-medium mb-3">Timeline</h4>
          <div className="flex items-center gap-2">
            {timeline.map((step, i) => (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full border-2 ${
                      step.done
                        ? step.active
                          ? "bg-[var(--status-info)] border-[var(--status-info)]"
                          : "bg-[var(--status-success)] border-[var(--status-success)]"
                        : "bg-background border-[var(--text-tertiary)]"
                    }`}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {step.label}
                  </p>
                  {step.time && (
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(step.time)}
                    </p>
                  )}
                </div>
                {i < timeline.length - 1 && (
                  <div
                    className={`w-16 h-0.5 mx-2 ${
                      timeline[i + 1].done ? "bg-[var(--status-success)]" : "bg-[var(--surface-3)]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dependencies */}
        {(blockedByTasks.length > 0 || blocksTasks.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blockedByTasks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <span className="text-[var(--status-error)]">&#8592;</span> Blocked by
                </h4>
                <div className="space-y-1">
                  {blockedByTasks.map((t) => (
                    <div
                      key={t.id}
                      className="text-sm p-2 bg-[var(--surface-3)] rounded-md flex items-center justify-between"
                    >
                      <span className="truncate">{t.subject}</span>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {blocksTasks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <span className="text-[var(--status-warn)]">&#8594;</span> Blocks
                </h4>
                <div className="space-y-1">
                  {blocksTasks.map((t) => (
                    <div
                      key={t.id}
                      className="text-sm p-2 bg-[var(--surface-3)] rounded-md flex items-center justify-between"
                    >
                      <span className="truncate">{t.subject}</span>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {task.createdAt && <span>Created {timeAgo(task.createdAt)}</span>}
            {task.completedAt && (
              <span>Completed {timeAgo(task.completedAt)}</span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
