import { useEffect, useMemo, useRef, useState } from "react";
import { AgentAvatar } from "./AgentAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { cn, timeAgo } from "@/lib/utils";
import { storage } from "@/lib/storage";

export function ActivityTimeline({ tasks, coffeeMessages, onEventClick, scopeKey }) {
  const [seenIds, setSeenIds] = useState(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const [limit, setLimit] = useState(30);
  const [pinnedIds, setPinnedIds] = useState(() =>
    storage.get(`activity.${scopeKey || "global"}.pinned`, [])
  );
  const scrollRef = useRef(null);

  const eventsWithIds = useMemo(() => {
    const events = [];

    if (tasks) {
      tasks
        .filter((task) => task.status === "completed" && task.completedAt)
        .forEach((task) => {
          events.push({
            type: "task",
            variant: "completed",
            agent: task.assignee,
            text: `Completed: ${task.subject}`,
            timestamp: task.completedAt,
            taskId: task.id,
          });
        });

      tasks
        .filter((task) => task.status === "in_progress")
        .forEach((task) => {
          events.push({
            type: "task",
            variant: "working",
            agent: task.assignee,
            text: `Working on: ${task.subject}`,
            timestamp: task.createdAt || new Date().toISOString(),
            taskId: task.id,
          });
        });
    }

    if (coffeeMessages) {
      coffeeMessages.forEach((message) => {
        events.push({
          type: message.type || "update",
          variant: message.type || "update",
          agent: message.agent,
          text: message.message,
          timestamp: message.timestamp,
        });
      });
    }

    const sorted = events
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, Math.max(60, limit))
      .map((event, index) => ({
        ...event,
        id: `${event.timestamp}-${event.agent || "unknown"}-${event.type}-${index}`,
      }));

    const pinned = sorted.filter((event) => pinnedIds.includes(event.id));
    const remainder = sorted.filter((event) => !pinnedIds.includes(event.id));
    return pinned.concat(remainder).slice(0, limit);
  }, [coffeeMessages, tasks, limit, pinnedIds]);

  const newEventIds = useMemo(
    () => eventsWithIds.filter((event) => !seenIds.has(event.id)).map((event) => event.id),
    [eventsWithIds, seenIds]
  );

  const newEventsSignature = newEventIds.join("|");

  useEffect(() => {
    if (newEventIds.length > 0 && autoScroll && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }

    const timer = setTimeout(() => {
      setSeenIds((prev) => {
        const next = new Set(prev);
        eventsWithIds.forEach((event) => next.add(event.id));
        return next;
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [autoScroll, eventsWithIds, newEventsSignature, newEventIds.length]);

  function togglePinned(eventId) {
    setPinnedIds((prev) => {
      const next = prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [eventId].concat(prev).slice(0, 15);
      storage.set(`activity.${scopeKey || "global"}.pinned`, next);
      return next;
    });
  }

  if (eventsWithIds.length === 0) {
    return (
      <Panel title="Recent Activity">
        <EmptyState preset="activity" />
      </Panel>
    );
  }

  return (
    <Panel
      title="Recent Activity"
      headerAction={
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value) || 30)}
            className="rounded-md border border-border bg-[var(--surface-2)] px-2 py-1 text-xs"
          >
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              "rounded-md px-2 py-1 text-xs transition-colors",
              autoScroll
                ? "bg-[var(--surface-3)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]"
            )}
            aria-label="Toggle timeline auto-scroll"
          >
            Auto-scroll {autoScroll ? "on" : "off"}
          </button>
        </div>
      }
    >
      <div ref={scrollRef} className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
        {eventsWithIds.map((event) => {
          const isNew = !seenIds.has(event.id);
          const badgeClass =
            event.type === "insight"
              ? "bg-[color-mix(in_srgb,var(--status-warn)_18%,transparent)] text-[var(--status-warn)]"
              : event.type === "blocker"
              ? "bg-[color-mix(in_srgb,var(--status-error)_18%,transparent)] text-[var(--status-error)]"
              : event.type === "task"
              ? "bg-[color-mix(in_srgb,var(--status-info)_18%,transparent)] text-[var(--status-info)]"
              : "bg-[var(--surface-3)] text-[var(--text-secondary)]";

          const isPinned = pinnedIds.includes(event.id);

          return (
            <article
              key={event.id}
              className={cn(
                "rounded-md p-2 transition-colors",
                isPinned && "border border-[var(--status-warn)]/40",
                isNew && "bg-[color-mix(in_srgb,var(--status-info)_10%,transparent)]"
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => togglePinned(event.id)}
                  className={cn(
                    "mt-1 rounded px-1 text-xs",
                    isPinned ? "text-[var(--status-warn)]" : "text-[var(--text-tertiary)]"
                  )}
                  title={isPinned ? "Unpin event" : "Pin event"}
                >
                  {isPinned ? "★" : "☆"}
                </button>
                <button
                  onClick={() => onEventClick?.(event)}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left hover:bg-[var(--interactive-hover)]"
                >
                  <AgentAvatar agent={event.agent} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--text-primary)]">{event.text}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {event.timestamp ? timeAgo(event.timestamp) : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isNew ? <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--status-info)]" /> : null}
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px]", badgeClass)}>{event.type}</span>
                  </div>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
