import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { useTasks } from "@/hooks/useTasks";
import { cn, titleFromId } from "@/lib/utils";
import { AgentAvatar } from "@/components/AgentAvatar";
import { StatusBadge } from "@/components/Badge";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { SearchInput } from "@/components/ui/SearchInput";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { storage } from "@/lib/storage";

const COLUMNS = [
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "blocked", label: "Blocked" },
];

const PRESETS = [
  { id: "blocked", label: "Blocked" },
  { id: "lead", label: "Mine / Lead" },
  { id: "in_progress", label: "In Progress" },
  { id: "needs_assignment", label: "Needs Assignment" },
];

function detectLeadAssignee(tasks = []) {
  const lead = tasks.find((task) => (task.assignee || "").includes("lead") || (task.assignee || "").includes("coordinator"));
  return lead?.assignee || "";
}

export default function Tasks() {
  const { workspaceId } = useOutletContext();
  const { data: taskData, isLoading } = useTasks(workspaceId);
  const [searchParams, setSearchParams] = useSearchParams();
  const presetFromUrl = searchParams.get("preset") || "";

  const [selectedTask, setSelectedTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [laneFilter, setLaneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mobileColumn, setMobileColumn] = useState("in_progress");
  const [preset, setPreset] = useState(
    () => presetFromUrl || storage.workspaceGet(workspaceId, "tasks.preset", "")
  );
  const [density, setDensity] = useState(
    () => storage.workspaceGet(workspaceId, "tasks.density", "comfortable")
  );
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  const searchInputRef = useRef(null);

  // Refs for keyboard navigation - one ref array per column
  const taskRefsMap = useRef({
    pending: [],
    in_progress: [],
    completed: [],
    blocked: [],
  });

  // Track focused task index per column
  const [focusedIndexMap, setFocusedIndexMap] = useState({
    pending: 0,
    in_progress: 0,
    completed: 0,
    blocked: 0,
  });

  const tasks = useMemo(() => taskData?.tasks ?? [], [taskData?.tasks]);
  const lanes = taskData?.lanes || [];

  useEffect(() => {
    function onFocusSearch() {
      searchInputRef.current?.focus();
    }

    window.addEventListener("agent-squad:focus-search", onFocusSearch);
    return () => window.removeEventListener("agent-squad:focus-search", onFocusSearch);
  }, []);

  useEffect(() => {
    if (preset) {
      storage.workspaceSet(workspaceId, "tasks.preset", preset);
    }
  }, [workspaceId, preset]);

  const filteredTasks = useMemo(() => {
    const leadAssignee = detectLeadAssignee(tasks);

    return tasks.filter((task) => {
      const taskStatus = task.blockedBy?.length > 0 && task.status !== "completed" ? "blocked" : task.status;
      const matchesSearch =
        !searchQuery ||
        task.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(task.id).includes(searchQuery);

      const matchesAssignee = assigneeFilter === "all" || task.assignee === assigneeFilter;
      const matchesLane = laneFilter === "all" || task.lane === laneFilter;
      const matchesStatus = statusFilter === "all" || taskStatus === statusFilter;

      let matchesPreset = true;
      if (preset === "blocked") matchesPreset = taskStatus === "blocked";
      if (preset === "in_progress") matchesPreset = taskStatus === "in_progress";
      if (preset === "needs_assignment") matchesPreset = !task.assignee;
      if (preset === "lead") matchesPreset = !!leadAssignee && task.assignee === leadAssignee;

      return matchesSearch && matchesAssignee && matchesLane && matchesStatus && matchesPreset;
    });
  }, [tasks, searchQuery, assigneeFilter, laneFilter, statusFilter, preset]);

  const tasksByStatus = useMemo(() => {
    const grouped = { pending: [], in_progress: [], completed: [], blocked: [] };

    filteredTasks.forEach((task) => {
      const status = task.blockedBy?.length > 0 && task.status !== "completed" ? "blocked" : task.status;
      grouped[status]?.push(task);
    });

    return grouped;
  }, [filteredTasks]);

  const uniqueAssignees = useMemo(() => {
    const assignees = new Set(tasks.map((task) => task.assignee).filter(Boolean));
    return Array.from(assignees).sort();
  }, [tasks]);

  const filteredSummary = useMemo(() => {
    return {
      total: filteredTasks.length,
      pending: tasksByStatus.pending.length,
      inProgress: tasksByStatus.in_progress.length,
      completed: tasksByStatus.completed.length,
      blocked: tasksByStatus.blocked.length,
    };
  }, [filteredTasks.length, tasksByStatus]);

  const selectedTasks = useMemo(
    () => filteredTasks.filter((task) => selectedTaskIds.includes(task.id)),
    [filteredTasks, selectedTaskIds]
  );

  function setPresetAndQuery(nextPreset) {
    setPreset(nextPreset);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextPreset) next.set("preset", nextPreset);
      else next.delete("preset");
      return next;
    });
  }

  function toggleDensity(nextDensity) {
    setDensity(nextDensity);
    storage.workspaceSet(workspaceId, "tasks.density", nextDensity);
  }

  async function copySelectedTaskData() {
    if (selectedTasks.length === 0) return;
    const payload = selectedTasks.map((task) => `#${task.id} ${task.subject}`).join("\n");
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      window.prompt("Copy selected tasks:", payload);
    }
  }

  /**
   * Handles keyboard navigation within task columns
   * @param {KeyboardEvent} e - Keyboard event
   * @param {string} columnId - Column identifier (pending, in_progress, completed, blocked)
   * @param {number} taskIndex - Current task index within the column
   * @param {Object} task - Task data
   */
  const handleTaskKeyDown = useCallback((e, columnId, taskIndex, task) => {
    const columnTasks = tasksByStatus[columnId];
    const currentFocusedIndex = focusedIndexMap[columnId];

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (taskIndex < columnTasks.length - 1) {
          const nextIndex = taskIndex + 1;
          setFocusedIndexMap((prev) => ({ ...prev, [columnId]: nextIndex }));
          // Focus next task card
          setTimeout(() => {
            taskRefsMap.current[columnId][nextIndex]?.focus();
          }, 0);
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (taskIndex > 0) {
          const prevIndex = taskIndex - 1;
          setFocusedIndexMap((prev) => ({ ...prev, [columnId]: prevIndex }));
          // Focus previous task card
          setTimeout(() => {
            taskRefsMap.current[columnId][prevIndex]?.focus();
          }, 0);
        }
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        setSelectedTask(task);
        break;

      case "Home":
        e.preventDefault();
        setFocusedIndexMap((prev) => ({ ...prev, [columnId]: 0 }));
        setTimeout(() => {
          taskRefsMap.current[columnId][0]?.focus();
        }, 0);
        break;

      case "End":
        e.preventDefault();
        const lastIndex = columnTasks.length - 1;
        setFocusedIndexMap((prev) => ({ ...prev, [columnId]: lastIndex }));
        setTimeout(() => {
          taskRefsMap.current[columnId][lastIndex]?.focus();
        }, 0);
        break;
    }
  }, [tasksByStatus, focusedIndexMap]);

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Operator triage and execution board" />

      <div className="sticky top-0 z-20 rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span>Filtered: {filteredSummary.total}</span>
          <span>•</span>
          <span>Pending {filteredSummary.pending}</span>
          <span>•</span>
          <span>In Progress {filteredSummary.inProgress}</span>
          <span>•</span>
          <span>Blocked {filteredSummary.blocked}</span>
          <span>•</span>
          <span>Completed {filteredSummary.completed}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPresetAndQuery(item.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs",
                preset === item.id
                  ? "border-[var(--status-info)]/50 bg-[color-mix(in_srgb,var(--status-info)_16%,transparent)] text-[var(--text-primary)]"
                  : "border-border text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
              )}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => setPresetAndQuery("")}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
          >
            Clear preset
          </button>

          <div className="ml-auto flex items-center gap-1 rounded-md border border-border bg-[var(--surface-2)] p-0.5">
            <button
              onClick={() => toggleDensity("comfortable")}
              className={cn("rounded px-2 py-1 text-xs", density === "comfortable" && "bg-[var(--interactive-active)] text-[var(--text-primary)]")}
            >
              Comfortable
            </button>
            <button
              onClick={() => toggleDensity("compact")}
              className={cn("rounded px-2 py-1 text-xs", density === "compact" && "bg-[var(--interactive-active)] text-[var(--text-primary)]")}
            >
              Compact
            </button>
          </div>
        </div>
      </div>

      <FilterBar sticky>
        <SearchInput
          ref={searchInputRef}
          inputId="tasks-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search tasks..."
          className="flex-1"
        />

        <label className="text-sm text-[var(--text-secondary)]">
          <span className="sr-only">Filter by status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-w-[9rem] rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm"
          >
            <option value="all">All Statuses</option>
            {COLUMNS.map((column) => (
              <option key={column.id} value={column.id}>{column.label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm text-[var(--text-secondary)]">
          <span className="sr-only">Filter by lane</span>
          <select
            value={laneFilter}
            onChange={(event) => setLaneFilter(event.target.value)}
            className="min-w-[9rem] rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm"
          >
            <option value="all">All Lanes</option>
            {lanes.map((lane) => (
              <option key={lane.id} value={lane.id}>{lane.label || titleFromId(lane.id)}</option>
            ))}
          </select>
        </label>

        <label className="text-sm text-[var(--text-secondary)]">
          <span className="sr-only">Filter by assignee</span>
          <select
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className="min-w-[11rem] rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm"
          >
            <option value="all">All Assignees</option>
            {uniqueAssignees.map((assignee) => (
              <option key={assignee} value={assignee}>{titleFromId(assignee)}</option>
            ))}
          </select>
        </label>
      </FilterBar>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
        <button
          onClick={() => setSelectedTaskIds(filteredTasks.map((task) => task.id))}
          className="rounded-md border border-border px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
        >
          Select visible
        </button>
        <button
          onClick={() => setSelectedTaskIds([])}
          className="rounded-md border border-border px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
        >
          Clear selection
        </button>
        <button
          onClick={copySelectedTaskData}
          disabled={selectedTaskIds.length === 0}
          className="rounded-md border border-border px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Copy IDs + subjects ({selectedTaskIds.length})
        </button>
        <button
          onClick={() => {
            const first = selectedTasks[0];
            if (first) setSelectedTask(first);
          }}
          disabled={selectedTaskIds.length === 0}
          className="rounded-md border border-border px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Review selected
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {COLUMNS.map((column) => (
            <Panel key={column.id} title={column.label}>
              <div className="space-y-3">
                <SkeletonBlock className="h-24" />
                <SkeletonBlock className="h-24" />
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {COLUMNS.map((column) => (
              <button
                key={column.id}
                onClick={() => setMobileColumn(column.id)}
                className={cn(
                  "whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs",
                  mobileColumn === column.id
                    ? "bg-[var(--interactive-active)] text-[var(--text-primary)]"
                    : "bg-[var(--surface-2)] text-[var(--text-secondary)]"
                )}
              >
                {column.label} ({tasksByStatus[column.id].length})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {COLUMNS.map((column) => {
              const hiddenOnMobile = mobileColumn !== column.id;
              return (
                <Panel
                  key={column.id}
                  title={column.label}
                  className={cn("min-h-[420px]", hiddenOnMobile && "hidden lg:block")}
                  headerAction={<span className="text-xs text-[var(--text-secondary)]">{tasksByStatus[column.id].length}</span>}
                >
                  <div className="space-y-2">
                    {tasksByStatus[column.id].length === 0 ? (
                      <p className="py-4 text-center text-sm text-[var(--text-secondary)]">No tasks</p>
                    ) : (
                      tasksByStatus[column.id].map((task, taskIndex) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          compact={density === "compact"}
                          selected={selectedTaskIds.includes(task.id)}
                          onSelect={(checked) => {
                            setSelectedTaskIds((prev) => {
                              if (checked) return Array.from(new Set(prev.concat(task.id)));
                              return prev.filter((id) => id !== task.id);
                            });
                          }}
                          onClick={() => setSelectedTask(task)}
                          onKeyDown={(e) => handleTaskKeyDown(e, column.id, taskIndex, task)}
                          cardRef={(el) => {
                            if (el) {
                              taskRefsMap.current[column.id][taskIndex] = el;
                            }
                          }}
                          isFocused={focusedIndexMap[column.id] === taskIndex}
                        />
                      ))
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        </>
      )}

      {!isLoading && tasks.length === 0 ? <EmptyState preset="tasks" /> : null}

      <TaskDetailModal task={selectedTask} tasks={tasks} onClose={() => setSelectedTask(null)} />
    </div>
  );
}

/**
 * TaskCard component with memoization to prevent unnecessary re-renders
 * Only re-renders when task data, selection state, or compact mode changes
 * Supports keyboard navigation with arrow keys and Enter/Space
 */
const TaskCard = memo(function TaskCard({ task, onClick, compact, selected, onSelect, onKeyDown, cardRef, isFocused }) {
  const isBlocked = task.blockedBy?.length > 0 && task.status !== "completed";

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={isFocused ? 0 : -1}
      className={cn(
        "w-full rounded-md border border-border bg-[var(--surface-2)] text-left transition-colors hover:bg-[var(--interactive-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--interactive-active)] focus:ring-offset-2 focus:ring-offset-background",
        compact ? "p-2" : "p-3",
        isBlocked && "border-[var(--status-error)]/45 bg-[color-mix(in_srgb,var(--status-error)_10%,transparent)]"
      )}
      aria-label={`Task: ${task.subject}. Status: ${isBlocked ? "blocked" : task.status}. ${task.assignee ? `Assigned to ${task.assignee}` : "Unassigned"}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-[var(--text-tertiary)]" onClick={(event) => event.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect?.(event.target.checked)}
            aria-label={`Select task ${task.id}`}
          />
          <span>#{task.id}</span>
        </label>
        {task.assignee ? <AgentAvatar agent={task.assignee} size="sm" /> : null}
      </div>
      <p className={cn("mb-2 text-[var(--text-primary)]", compact ? "line-clamp-2 text-xs" : "line-clamp-2 text-sm font-medium")}>{task.subject}</p>
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={isBlocked ? "blocked" : task.status} />
        {task.lane ? <span className="text-xs text-[var(--text-secondary)]">{titleFromId(task.lane)}</span> : null}
      </div>
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these specific props change
  // Note: onKeyDown and cardRef are intentionally excluded from comparison
  // as they should remain stable across renders
  // isFocused is included because we need to re-render when focus changes (for tabIndex)
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.subject === nextProps.task.subject &&
    prevProps.task.assignee === nextProps.task.assignee &&
    prevProps.task.lane === nextProps.task.lane &&
    prevProps.task.blockedBy?.length === nextProps.task.blockedBy?.length &&
    prevProps.selected === nextProps.selected &&
    prevProps.compact === nextProps.compact &&
    prevProps.isFocused === nextProps.isFocused
  );
});
