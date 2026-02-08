import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { useWorkspace } from "@/hooks/useWorkspace";
import { buildCommands } from "@/lib/commands";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { OPERATOR_MODE } from "@/lib/featureFlags";
import { storage } from "@/lib/storage";

function buildKickoffPrompt(workspaceId, teamName) {
  if (!workspaceId) return "";
  return [
    "Start Agent Squad workflow for workspace:",
    `workspaces/${workspaceId}`,
    "",
    "Load:",
    "- workspace.json",
    "- tasks.json",
    "- source/mission.md",
    "- agents/*.md",
    "",
    "Then:",
    "1) Assign each pending task to the correct agent role.",
    "2) Begin execution in workflow-lane order.",
    `3) Post all progress updates to ~/.claude/teams/${teamName || "agent-squad-team"}/team-feed.jsonl as JSONL events with type: update/insight/blocker.`,
    "4) Write outputs into the corresponding artifacts/{module-id}/ folders.",
    "5) Mark tasks complete in tasks.json as work finishes.",
  ].join("\n");
}

export function Layout({ activeThemeLabel, onToggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(() =>
    storage.get("selectedWorkspaceId", null)
  );
  const [paletteSession, setPaletteSession] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    storage.get("sidebarCollapsed", false)
  );
  const [recentWorkspaceIds, setRecentWorkspaceIds] = useState(() =>
    storage.get("recentWorkspaceIds", [])
  );
  const primaryWorkspaceQuery = useWorkspace(selectedWorkspaceId);
  const primaryWorkspaceData = primaryWorkspaceQuery.data;
  const primaryWorkspaceOptions = primaryWorkspaceData?.workspaces || [];
  const recoveryWorkspaceId = primaryWorkspaceData?.workspaceNotFound
    ? primaryWorkspaceOptions[0]?.id || null
    : null;
  const recoveryWorkspaceQuery = useWorkspace(recoveryWorkspaceId, { enabled: Boolean(recoveryWorkspaceId) });
  const data = recoveryWorkspaceId ? recoveryWorkspaceQuery.data : primaryWorkspaceData;
  const selectedWorkspaceMissing = Boolean(selectedWorkspaceId && primaryWorkspaceData?.workspaceNotFound);

  const workspace = data?.manifest || null;
  const activeWorkspaceId = selectedWorkspaceMissing
    ? data?.workspaceId || recoveryWorkspaceId || null
    : selectedWorkspaceId || data?.workspaceId || null;
  const workspaceOptions = useMemo(() => data?.workspaces || [], [data?.workspaces]);

  useEffect(() => {
    if (activeWorkspaceId) {
      storage.set("selectedWorkspaceId", activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    storage.set("sidebarCollapsed", sidebarCollapsed);
  }, [sidebarCollapsed]);

  const handleWorkspaceChange = useCallback((nextWorkspaceId) => {
    setSelectedWorkspaceId(nextWorkspaceId || null);
    if (nextWorkspaceId) {
      setRecentWorkspaceIds((prev) => {
        const merged = [nextWorkspaceId].concat(prev.filter((id) => id !== nextWorkspaceId)).slice(0, 5);
        storage.set("recentWorkspaceIds", merged);
        return merged;
      });
    }
  }, []);

  const openPalette = useCallback(() => {
    setPaletteSession((prev) => prev + 1);
    setPaletteOpen(true);
  }, []);

  const handleCopyKickoffPrompt = useCallback(async () => {
    const kickoffPrompt = buildKickoffPrompt(activeWorkspaceId, workspace?.team?.name);
    if (!kickoffPrompt) return;

    try {
      await navigator.clipboard.writeText(kickoffPrompt);
    } catch {
      window.prompt("Copy Claude kickoff prompt:", kickoffPrompt);
    }
  }, [activeWorkspaceId, workspace?.team?.name]);

  const workspaceIndex = useMemo(
    () => workspaceOptions.findIndex((option) => option.id === activeWorkspaceId),
    [workspaceOptions, activeWorkspaceId]
  );

  const nextWorkspace = useCallback(() => {
    if (workspaceOptions.length === 0) return;
    const nextIndex = workspaceIndex >= 0 ? (workspaceIndex + 1) % workspaceOptions.length : 0;
    handleWorkspaceChange(workspaceOptions[nextIndex]?.id || null);
  }, [workspaceOptions, workspaceIndex, handleWorkspaceChange]);

  const previousWorkspace = useCallback(() => {
    if (workspaceOptions.length === 0) return;
    const prevIndex = workspaceIndex >= 0
      ? (workspaceIndex - 1 + workspaceOptions.length) % workspaceOptions.length
      : 0;
    handleWorkspaceChange(workspaceOptions[prevIndex]?.id || null);
  }, [workspaceOptions, workspaceIndex, handleWorkspaceChange]);

  const commands = useMemo(
    () => buildCommands({
      workspace,
      workspaceId: activeWorkspaceId,
      workspaceOptions,
      onWorkspaceChange: handleWorkspaceChange,
    }),
    [workspace, activeWorkspaceId, workspaceOptions, handleWorkspaceChange]
  );

  useKeyboardShortcuts({
    openPalette,
    toggleTheme: onToggleTheme,
    previousWorkspace,
    nextWorkspace,
    goMission: () => navigate("/"),
    goSummary: () => navigate("/summary"),
    goTasks: () => navigate("/tasks"),
    goComms: () => navigate("/comms"),
    goArtifacts: () => navigate("/artifacts"),
    goAnalytics: () => navigate("/analytics"),
    goHelp: () => navigate("/help"),
    goSetup: () => navigate("/setup"),
    goSettings: () => navigate("/settings"),
  });

  return (
    <>
      {/* Skip links for keyboard navigation accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-[var(--surface-1)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--text-primary)] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--interactive-active)]"
      >
        Skip to main content
      </a>
      <a
        href="#sidebar-nav"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-[var(--surface-1)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--text-primary)] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--interactive-active)]"
      >
        Skip to navigation
      </a>

      <div className="min-h-screen bg-background lg:flex">
        <nav id="sidebar-nav" aria-label="Main navigation">
          <Sidebar
            workspace={workspace}
            workspaceId={activeWorkspaceId}
            workspaceOptions={workspaceOptions}
            recentWorkspaceIds={recentWorkspaceIds}
            onWorkspaceChange={handleWorkspaceChange}
            onCopyKickoffPrompt={handleCopyKickoffPrompt}
            activeThemeLabel={activeThemeLabel}
            onToggleTheme={onToggleTheme}
            isCollapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
          />
        </nav>
        <main id="main-content" role="main" aria-label="Main content" className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet
            key={`workspace-${activeWorkspaceId || "none"}`}
            context={{
              workspaceId: activeWorkspaceId,
              workspaceData: data,
              pathname: location.pathname,
              workspaceNotFound: Boolean(data?.workspaceNotFound),
              onWorkspaceChange: handleWorkspaceChange,
            }}
          />
        </main>
      </div>

      {OPERATOR_MODE ? (
        <CommandPalette
          key={`palette-${paletteSession}`}
          isOpen={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          commands={commands}
          onRun={(command) =>
            command.run?.({
              navigate,
              onToggleTheme,
              copyKickoffPrompt: handleCopyKickoffPrompt,
            })
          }
        />
      ) : null}
    </>
  );
}
