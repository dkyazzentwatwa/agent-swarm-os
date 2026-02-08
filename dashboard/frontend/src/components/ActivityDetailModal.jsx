import { Modal } from "./Modal";
import { AgentAvatar } from "./AgentAvatar";
import { StatusBadge } from "./Badge";
import { timeAgo, titleFromId } from "@/lib/utils";

export function ActivityDetailModal({ event, tasks, onClose, onOpenTask }) {
  if (!event) return null;

  const task = event.type === "task" && tasks
    ? tasks.find((item) => item.id === event.taskId)
    : null;

  return (
    <Modal
      isOpen={!!event}
      onClose={onClose}
      title="Activity Detail"
      subtitle={event.timestamp ? timeAgo(event.timestamp) : "Recent activity"}
      size="lg"
    >
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AgentAvatar agent={event.agent} size="sm" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {event.agent ? titleFromId(event.agent) : "System"}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">{event.type}</p>
            </div>
          </div>
          <StatusBadge status={event.variant || event.type} />
        </div>

        <div className="rounded-md border border-border bg-[var(--surface-2)] p-3">
          <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{event.text}</p>
        </div>

        {task ? (
          <div className="rounded-md border border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-[var(--text-primary)]">Linked Task</h4>
              <button
                onClick={() => onOpenTask?.(task)}
                className="rounded-md border border-border px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
              >
                Open task
              </button>
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{task.subject}</p>
            {task.description ? (
              <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">{task.description}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
              {task.lane ? <span>Lane: {titleFromId(task.lane)}</span> : null}
              {task.status ? <span>Status: {task.status}</span> : null}
              {task.assignee ? <span>Assignee: {titleFromId(task.assignee)}</span> : null}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
