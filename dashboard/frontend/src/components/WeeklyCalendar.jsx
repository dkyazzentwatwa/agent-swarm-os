import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export function WeeklyCalendar({ lanes = [], tasks = [] }) {
  const safeLanes = lanes.length > 0
    ? lanes
    : [{ id: "execute", label: "Execute", description: "Run mission tasks" }];

  // Calculate current lane based on active tasks
  const cycleIndex = useMemo(() => {
    if (!tasks || tasks.length === 0 || safeLanes.length === 0) {
      return 0; // Default to first lane if no tasks
    }

    // Group tasks by lane
    const laneTaskCounts = safeLanes.map((lane, index) => {
      const laneTasks = tasks.filter((task) => task.lane === lane.id);
      const inProgressCount = laneTasks.filter((t) => t.status === "in_progress").length;
      const pendingCount = laneTasks.filter((t) => t.status === "pending").length;
      return { index, inProgressCount, pendingCount };
    });

    // Find lane with most in_progress tasks
    const activeLane = laneTaskCounts.reduce((max, current) =>
      current.inProgressCount > max.inProgressCount ? current : max
    );

    if (activeLane.inProgressCount > 0) {
      return activeLane.index;
    }

    // If no in_progress tasks, find first lane with pending tasks
    const pendingLane = laneTaskCounts.find((lane) => lane.pendingCount > 0);
    if (pendingLane) {
      return pendingLane.index;
    }

    // Default to first lane
    return 0;
  }, [tasks, safeLanes]);

  const [expandedLanes, setExpandedLanes] = useState(new Set([cycleIndex]));

  const toggleLane = (index) => {
    setExpandedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-medium">Workflow Lanes</h3>
      <div className="space-y-2">
        {safeLanes.map((lane, index) => {
          const isExpanded = expandedLanes.has(index);
          const isCurrent = index === cycleIndex;
          const isPast = index < cycleIndex;

          return (
            <div
              key={lane.id}
              className={cn(
                "rounded-md border transition-all duration-200",
                isCurrent
                  ? "border-[var(--text-primary)] bg-[var(--interactive-active)]"
                  : isPast
                  ? "border-border bg-[var(--surface-2)]"
                  : "border-border bg-[var(--surface-1)] opacity-75"
              )}
            >
              <button
                onClick={() => toggleLane(index)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--interactive-hover)] rounded-md transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-tertiary)] shrink-0">
                    {lane.id}
                  </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {lane.label}
                  </span>
                  {!isExpanded && (
                    <span className="text-xs text-[var(--text-secondary)] truncate">
                      {lane.description}
                    </span>
                  )}
                </div>
                <svg
                  className={cn(
                    "h-4 w-4 text-[var(--text-secondary)] shrink-0 transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && (
                <div className="px-4 pb-3 pt-1">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {lane.description}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
