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
