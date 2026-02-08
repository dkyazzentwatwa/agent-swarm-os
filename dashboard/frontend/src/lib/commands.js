import { titleFromId } from "@/lib/utils";

function makeNavigateCommand(id, label, to, group, shortcut, keywords = []) {
  return {
    id,
    label,
    group,
    shortcut,
    keywords,
    run: ({ navigate }) => navigate(to),
  };
}

export function buildCommands({ workspace, workspaceId, workspaceOptions, onWorkspaceChange }) {
  const modules = workspace?.modules || [];

  const commands = [
    makeNavigateCommand("nav-mission", "Go to Mission", "/", "Navigation", "g m", ["home"]),
    makeNavigateCommand("nav-summary", "Go to Summary", "/summary", "Navigation", "g s"),
    makeNavigateCommand("nav-tasks", "Go to Tasks", "/tasks", "Navigation", "g t"),
    makeNavigateCommand("nav-comms", "Go to Comms", "/comms", "Navigation", "g c"),
    makeNavigateCommand("nav-artifacts", "Go to Artifacts", "/artifacts", "Navigation", "g a"),
    makeNavigateCommand("nav-analytics", "Go to Analytics", "/analytics", "Navigation", "g n"),
    makeNavigateCommand("nav-setup", "Go to Setup", "/setup", "Navigation", "g u", ["install", "onboarding"]),
    makeNavigateCommand("nav-settings", "Go to Settings", "/settings", "Navigation", "g e", ["directories", "claude", "config"]),
    makeNavigateCommand("nav-help", "Go to Help", "/help", "Navigation", "g h"),

    makeNavigateCommand("tasks-blocked", "Tasks: show blocked", "/tasks?preset=blocked", "Tasks", null, ["triage"]),
    makeNavigateCommand("tasks-progress", "Tasks: show in-progress", "/tasks?preset=in_progress", "Tasks", null),
    makeNavigateCommand("tasks-unassigned", "Tasks: show unassigned", "/tasks?preset=needs_assignment", "Tasks", null),

    makeNavigateCommand("artifacts-recent", "Artifacts: recently opened", "/artifacts?mode=recent", "Artifacts", null),
    makeNavigateCommand("summary-open", "Open latest summary", "/summary", "Utility", null, ["final", "report"]),
    {
      id: "workspace-copy-prompt",
      label: "Copy Claude kickoff prompt",
      group: "Workspace",
      keywords: ["claude", "kickoff", "starter"],
      run: ({ copyKickoffPrompt }) => copyKickoffPrompt?.(),
    },
    {
      id: "theme-toggle",
      label: "Toggle theme",
      group: "Utility",
      shortcut: "t",
      run: ({ onToggleTheme }) => onToggleTheme?.(),
    },
  ];

  for (const moduleDef of modules) {
    commands.push(
      makeNavigateCommand(
        `module-${moduleDef.id}`,
        `Artifacts: open ${moduleDef.label || titleFromId(moduleDef.id)}`,
        `/artifacts?module=${encodeURIComponent(moduleDef.id)}`,
        "Artifacts",
        null,
        [moduleDef.id, moduleDef.label || ""]
      )
    );
  }

  for (const option of workspaceOptions || []) {
    commands.push({
      id: `workspace-${option.id}`,
      label: `Switch workspace: ${option.title || option.id}`,
      group: "Workspace",
      keywords: [option.id, option.templateId || "", option.title || ""],
      disabled: option.id === workspaceId,
      run: () => onWorkspaceChange?.(option.id),
    });
  }

  return commands;
}
