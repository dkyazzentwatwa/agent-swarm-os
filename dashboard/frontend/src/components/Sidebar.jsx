import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const NAV_MAP = {
  mission: { to: "/", label: "Mission", icon: "grid", end: true },
  summary: { to: "/summary", label: "Summary", icon: "summary" },
  tasks: { to: "/tasks", label: "Tasks", icon: "tasks" },
  comms: { to: "/comms", label: "Comms", icon: "coffee" },
  artifacts: { to: "/artifacts", label: "Artifacts", icon: "folder" },
  analytics: { to: "/analytics", label: "Analytics", icon: "chart" },
  setup: { to: "/setup", label: "Setup", icon: "setup" },
  settings: { to: "/settings", label: "Settings", icon: "settings" },
  help: { to: "/help", label: "Help", icon: "help" },
};
const DEFAULT_NAV_IDS = ["mission", "summary", "tasks", "comms", "artifacts", "analytics", "setup", "settings", "help"];

function NavIcon({ icon, className }) {
  const icons = {
    grid: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    summary: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 3h12l4 4v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M16 3v5h5" />
        <line x1="7" y1="13" x2="17" y2="13" />
        <line x1="7" y1="17" x2="14" y2="17" />
      </svg>
    ),
    tasks: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    coffee: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Z" />
        <line x1="6" y1="2" x2="6" y2="4" />
        <line x1="10" y1="2" x2="10" y2="4" />
        <line x1="14" y1="2" x2="14" y2="4" />
      </svg>
    ),
    folder: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z" />
      </svg>
    ),
    chart: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    setup: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1V15Z" />
      </svg>
    ),
    settings: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M20 12a8 8 0 0 0-.2-1.7l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2.9-1.7L14 2h-4l-.5 2.6a8 8 0 0 0-2.9 1.7l-2.4-1-2 3.5 2 1.5A8 8 0 0 0 4 12c0 .6.1 1.1.2 1.7l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2.9 1.7L10 22h4l.5-2.6a8 8 0 0 0 2.9-1.7l2.4 1 2-3.5-2-1.5c.1-.6.2-1.1.2-1.7Z" />
      </svg>
    ),
    help: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.5 9a3 3 0 1 1 4.2 2.7c-.9.4-1.7 1.1-1.7 2.3v.5" />
        <circle cx="12" cy="17" r="0.8" />
      </svg>
    ),
  };
  return icons[icon] || null;
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function compactTitle(title, fallback = "Workspace", max = 44) {
  const value = String(title || fallback);
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export function Sidebar({
  workspace,
  workspaceId,
  workspaceOptions,
  recentWorkspaceIds,
  onWorkspaceChange,
  onCopyKickoffPrompt,
  activeThemeLabel,
  onToggleTheme,
  isCollapsed = false,
  onToggleCollapsed,
}) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState("");

  const title = workspace?.dashboard?.title || "Agent Squad";
  const subtitle = workspace?.dashboard?.subtitle || "Multi-agent dashboard";

  const rawNavIds = Array.isArray(workspace?.dashboard?.nav) && workspace.dashboard.nav.length > 0
    ? workspace.dashboard.nav
    : DEFAULT_NAV_IDS;

  const mergedNavIds = [];
  const seenNavIds = new Set();
  for (const id of rawNavIds.concat(DEFAULT_NAV_IDS)) {
    if (!id || seenNavIds.has(id)) continue;
    seenNavIds.add(id);
    mergedNavIds.push(id);
  }

  let navItems = mergedNavIds
    .map((id) => NAV_MAP[id])
    .filter(Boolean);

  if (navItems.length === 0) {
    navItems = DEFAULT_NAV_IDS.map((id) => NAV_MAP[id]).filter(Boolean);
  }

  const optionsById = useMemo(() => {
    const map = {};
    for (const option of workspaceOptions || []) {
      map[option.id] = option;
    }
    return map;
  }, [workspaceOptions]);

  const filteredWorkspaces = useMemo(() => {
    const q = workspaceSearch.trim().toLowerCase();
    if (!q) return workspaceOptions || [];

    return (workspaceOptions || []).filter((option) => {
      const haystack = `${option.title || ""} ${option.id} ${option.templateId || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [workspaceOptions, workspaceSearch]);

  const currentWorkspace = optionsById[workspaceId] || null;
  const currentWorkspaceTitle = compactTitle(currentWorkspace?.title || workspaceId || "Select workspace");
  const navVisibilityClass = isCollapsed ? "hidden lg:flex" : "flex";

  return (
    <aside
      className={cn(
        "w-full border-b border-border bg-card lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:transition-[width] lg:duration-200",
        isCollapsed ? "lg:w-20" : "lg:w-72"
      )}
    >
      <div className="border-b border-border px-4 py-4 lg:px-5">
        <div className={cn("flex gap-2", isCollapsed ? "items-center justify-center lg:flex-col lg:gap-3" : "items-start justify-between")}>
          {isCollapsed ? (
            <div className="grid h-9 w-9 place-items-center rounded-md border border-border bg-[var(--surface-2)] text-xs font-semibold text-[var(--text-secondary)]">
              AS
            </div>
          ) : (
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight" title={title}>
                {title}
              </h1>
              <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]" title={subtitle}>{subtitle}</p>
            </div>
          )}

          <button
            onClick={() => onToggleCollapsed?.()}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-[var(--surface-2)] p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              {isCollapsed ? <path d="m9 6 6 6-6 6" /> : <path d="m15 6-6 6 6 6" />}
            </svg>
          </button>
        </div>

        {!isCollapsed ? (
          <div className="mt-3 space-y-2">
            <label className="block text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
              Workspace
            </label>

            <button
              onClick={() => setWorkspaceMenuOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-left text-sm"
              aria-expanded={workspaceMenuOpen}
              aria-label="Choose workspace"
              title={currentWorkspace?.title || workspaceId || "Select workspace"}
            >
              <span className="truncate">{currentWorkspaceTitle}</span>
              <span className="text-[var(--text-secondary)]">{workspaceMenuOpen ? "▲" : "▼"}</span>
            </button>

            {workspaceMenuOpen ? (
              <div className="rounded-md border border-border bg-[var(--surface-1)] p-2">
                <input
                  type="text"
                  value={workspaceSearch}
                  onChange={(event) => setWorkspaceSearch(event.target.value)}
                  placeholder="Search workspaces..."
                  className="mb-2 w-full rounded-md border border-border bg-[var(--surface-2)] px-2.5 py-1.5 text-xs"
                />

                <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                  {filteredWorkspaces.map((option) => {
                    const active = option.id === workspaceId;
                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          onWorkspaceChange?.(option.id);
                          setWorkspaceMenuOpen(false);
                        }}
                        className={cn(
                          "w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                          active
                            ? "border-[var(--status-info)]/50 bg-[color-mix(in_srgb,var(--status-info)_12%,transparent)]"
                            : "border-border hover:bg-[var(--interactive-hover)]"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-medium text-[var(--text-primary)]">{option.title || option.id}</p>
                          {active ? (
                            <span className="rounded-full bg-[var(--status-info)]/20 px-1.5 py-0.5 text-[10px] text-[var(--status-info)]">Active</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-[var(--text-secondary)]">{option.id}</p>
                        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-[var(--text-tertiary)]">
                          <span>{option.templateId || "custom"}</span>
                          <span>•</span>
                          <span>{formatDate(option.mtime)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {(recentWorkspaceIds || []).length > 0 ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {(recentWorkspaceIds || []).map((id) => {
                  const option = optionsById[id];
                  if (!option) return null;
                  const shortLabel = compactTitle(option.title || option.id, option.id, 26);
                  return (
                    <button
                      key={id}
                      onClick={() => onWorkspaceChange?.(id)}
                      className={cn(
                        "max-w-full rounded-full border px-2 py-0.5 text-[10px]",
                        workspaceId === id
                          ? "border-[var(--status-info)]/50 text-[var(--status-info)]"
                          : "border-border text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
                      )}
                      title={option.title || option.id}
                    >
                      <span className="block max-w-[14.5rem] truncate">{shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <button
              onClick={onCopyKickoffPrompt}
              disabled={!workspaceId}
              className={cn(
                "w-full rounded-md border px-2.5 py-2 text-xs transition-colors",
                workspaceId
                  ? "border-border text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]"
                  : "cursor-not-allowed border-border/50 text-[var(--text-tertiary)]"
              )}
              title="Copy a Claude starter prompt for the current workspace"
            >
              Copy Claude prompt
            </button>
          </div>
        ) : null}
      </div>

      <nav className={cn(navVisibilityClass, "gap-1 overflow-x-auto p-3 lg:flex-col lg:overflow-visible")} aria-label="Primary navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "inline-flex min-w-fit items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                isCollapsed && "lg:min-w-0 lg:justify-center lg:px-0",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]"
              )
            }
            title={isCollapsed ? item.label : undefined}
          >
            <NavIcon icon={item.icon} className="h-4 w-4" />
            {!isCollapsed ? item.label : null}
          </NavLink>
        ))}
      </nav>

      <div className="hidden border-t border-border p-4 lg:block">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-analytics" />
          {!isCollapsed ? <span className="text-xs text-[var(--text-secondary)]">Live updates</span> : null}
        </div>
        <button
          onClick={onToggleTheme}
          className={cn(
            "flex rounded-md border border-border px-2.5 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]",
            isCollapsed ? "h-9 w-9 items-center justify-center p-0" : "w-full items-center justify-between gap-3"
          )}
          title="Cycle VS Code-inspired themes"
          aria-label="Toggle theme"
        >
          <span className={cn("flex min-w-0 items-center gap-2", isCollapsed && "justify-center")}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            {!isCollapsed ? <span>Toggle theme</span> : null}
          </span>
          {!isCollapsed ? (
            <span className="max-w-[8rem] truncate font-mono text-[11px] text-[var(--text-primary)]/90">
              {activeThemeLabel}
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  );
}
