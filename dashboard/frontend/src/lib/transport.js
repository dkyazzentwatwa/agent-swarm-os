function isTauriRuntime() {
  return typeof window !== "undefined" && ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);
}

let invokePromise = null;

async function getInvoke() {
  if (!invokePromise) {
    invokePromise = import("@tauri-apps/api/core").then((module) => module.invoke);
  }
  return invokePromise;
}

async function fallbackFetch(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export async function requestJson(url) {
  if (!url) return null;

  if (!isTauriRuntime()) {
    return fallbackFetch(url);
  }

  const invoke = await getInvoke();
  return invoke("api_get", { url });
}

export async function runWorkspaceInit(request) {
  if (!isTauriRuntime()) {
    throw new Error("Workspace initialization from UI requires Tauri runtime.");
  }

  const invoke = await getInvoke();
  return invoke("init_workspace", { request });
}

export async function getAppSettings() {
  if (!isTauriRuntime()) {
    const fallback = {
      settings: {
        teamName: "",
        workspacesDir: "",
        teamsDir: "",
        tasksDir: "",
        preferredTemplate: "",
        defaultAgents: 6,
        teammateMode: "in-process",
        claudeAgentTeamsEnv: true,
        kickoffCommand: "",
      },
      effectiveConfig: {},
    };
    return fallback;
  }

  const invoke = await getInvoke();
  return invoke("get_app_settings");
}

export async function saveAppSettings(request) {
  if (!isTauriRuntime()) {
    return { ok: false, error: "Settings save requires Tauri runtime." };
  }

  const invoke = await getInvoke();
  return invoke("save_app_settings", { request });
}

export async function runClaudeCommand(command, cwd = null) {
  if (!isTauriRuntime()) {
    return { ok: false, error: "Run command requires Tauri runtime." };
  }

  const invoke = await getInvoke();
  return invoke("run_claude_command", { command, cwd });
}

export async function runSwarmKickoff(workspaceId) {
  if (!isTauriRuntime()) {
    return { ok: false, error: "Swarm kickoff requires Tauri runtime." };
  }

  const invoke = await getInvoke();
  return invoke("run_swarm_kickoff", { workspaceId });
}

export async function openTerminalWithCommand(command, cwd = null) {
  if (!isTauriRuntime()) {
    return { ok: false, error: "Open terminal requires Tauri runtime." };
  }

  const invoke = await getInvoke();
  return invoke("open_terminal_with_command", { command, cwd });
}

export async function getWorkspaceKickoffPrompt(workspaceId) {
  if (!isTauriRuntime()) {
    return { ok: false, error: "Get workspace prompt requires Tauri runtime." };
  }

  const invoke = await getInvoke();
  return invoke("get_workspace_kickoff_prompt", { workspaceId });
}

export async function generateWorkspaceKickoffPrompt(workspaceId) {
  if (!isTauriRuntime()) {
    return { ok: false, error: "Generate workspace prompt requires Tauri runtime." };
  }

  const invoke = await getInvoke();
  return invoke("generate_workspace_kickoff_prompt", { workspaceId });
}

export async function saveWorkspaceKickoffPrompt(workspaceId, prompt) {
  if (!isTauriRuntime()) {
    return { ok: false, error: "Save workspace prompt requires Tauri runtime." };
  }

  const invoke = await getInvoke();
  return invoke("save_workspace_kickoff_prompt", { workspaceId, prompt });
}

export function isTauri() {
  return isTauriRuntime();
}

export async function selectDirectory(defaultPath = null) {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: defaultPath,
    });
    return selected;
  } catch (error) {
    console.error("Failed to open directory picker:", error);
    return null;
  }
}

export async function deleteWorkspace(workspaceId, archive = false) {
  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }

  const url = `/api/workspace/${encodeURIComponent(workspaceId)}${archive ? "?archive=true" : ""}`;

  if (!isTauriRuntime()) {
    const response = await fetch(url, { method: "DELETE" });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete workspace");
    }
    return response.json();
  }

  const invoke = await getInvoke();
  return invoke("api_delete", { url });
}
