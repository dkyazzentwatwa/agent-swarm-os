import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { AgentCard } from "./AgentCard";

export function AgentGroup({ agents, groups = [], onAgentClick }) {
  const [collapsed, setCollapsed] = useState({});

  const groupedData = useMemo(() => {
    const groupMap = new Map();

    for (const group of groups) {
      groupMap.set(group.id, {
        ...group,
        agents: [],
      });
    }

    if (!groupMap.has("other")) {
      groupMap.set("other", {
        id: "other",
        label: "Other",
        description: "Ungrouped agents",
        color: "#64748b",
        agents: [],
      });
    }

    for (const agent of agents || []) {
      const key = agent.groupId || agent.role || "other";
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          id: key,
          label: key,
          description: "",
          color: "#64748b",
          agents: [],
        });
      }
      groupMap.get(key).agents.push(agent);
    }

    return Array.from(groupMap.values()).filter((group) => group.agents.length > 0);
  }, [agents, groups]);

  return (
    <div className="space-y-4">
      {groupedData.map((group) => {
        const isCollapsed = collapsed[group.id];
        const workingCount = group.agents.filter((agent) => agent.status === "working").length;
        const waitingCount = group.agents.filter((agent) => agent.status === "waiting").length;
        const hasActiveLoad = workingCount > 0 || waitingCount > 0;

        return (
          <div
            key={group.id}
            className={cn(
              "rounded-lg border border-border bg-card transition-colors",
              hasActiveLoad && "border-[var(--status-info)]/60"
            )}
          >
            <button
              onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
              className="w-full p-3 text-left transition-colors hover:bg-[var(--interactive-hover)]"
              aria-expanded={!isCollapsed}
              aria-label={`Toggle ${group.label}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color || "#64748b" }} />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{group.label}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{group.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {workingCount > 0 ? (
                    <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-xs text-[var(--status-success)]">
                      {workingCount} working
                    </span>
                  ) : null}
                  {waitingCount > 0 ? (
                    <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-xs text-[var(--status-warn)]">
                      {waitingCount} waiting
                    </span>
                  ) : null}
                  <span className="text-xs text-[var(--text-secondary)]">
                    {group.agents.length} agent{group.agents.length !== 1 ? "s" : ""}
                  </span>
                  <svg
                    className={cn("h-4 w-4 text-[var(--text-secondary)] transition-transform", isCollapsed && "-rotate-90")}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </button>

            {!isCollapsed ? (
              <div className="grid grid-cols-1 gap-3 p-3 pt-0 md:grid-cols-2 xl:grid-cols-3">
                {group.agents.map((agent) => (
                  <AgentCard
                    key={agent.name}
                    agent={{ ...agent, groupLabel: group.label }}
                    onClick={onAgentClick}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
