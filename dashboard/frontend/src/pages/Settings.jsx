import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { getAppSettings, runClaudeCommand, runSwarmKickoff, saveAppSettings, selectDirectory, isTauri } from "@/lib/transport";

function copyText(text) {
  return navigator.clipboard.writeText(text).catch(() => {
    window.prompt("Copy text:", text);
  });
}

function withFallback(value, fallback = "") {
  return value == null ? fallback : String(value);
}

export default function Settings() {
  const { workspaceId } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [settingsPath, setSettingsPath] = useState("");
  const [effectiveConfig, setEffectiveConfig] = useState({});
  const [form, setForm] = useState({
    teamName: "",
    workspacesDir: "",
    teamsDir: "",
    tasksDir: "",
    preferredTemplate: "",
    defaultAgents: 6,
    teammateMode: "in-process",
    claudeAgentTeamsEnv: true,
    kickoffCommand: "claude --teammate-mode in-process",
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const payload = await getAppSettings();
        if (cancelled) return;
        setSettingsPath(withFallback(payload?.settingsPath));
        setEffectiveConfig(payload?.effectiveConfig || {});
        const incoming = payload?.settings || {};
        setForm((prev) => ({
          ...prev,
          teamName: withFallback(incoming.teamName, ""),
          workspacesDir: withFallback(incoming.workspacesDir, ""),
          teamsDir: withFallback(incoming.teamsDir, ""),
          tasksDir: withFallback(incoming.tasksDir, ""),
          preferredTemplate: withFallback(incoming.preferredTemplate, ""),
          defaultAgents: Number(incoming.defaultAgents || prev.defaultAgents || 6),
          teammateMode: withFallback(incoming.teammateMode, "in-process"),
          claudeAgentTeamsEnv: incoming.claudeAgentTeamsEnv !== false,
          kickoffCommand: withFallback(incoming.kickoffCommand, "claude --teammate-mode in-process"),
        }));
      } catch (error) {
        setResult({ ok: false, stderr: String(error?.message || error) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const kickoffPreview = useMemo(() => {
    let command = form.kickoffCommand || "claude --teammate-mode in-process";
    if (workspaceId) {
      command = command.replace(/\{workspaceId\}/g, workspaceId);
    }
    return command;
  }, [form.kickoffCommand, workspaceId]);

  async function onSave(event) {
    event.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const payload = await saveAppSettings({
        teamName: form.teamName || null,
        workspacesDir: form.workspacesDir || null,
        teamsDir: form.teamsDir || null,
        tasksDir: form.tasksDir || null,
        preferredTemplate: form.preferredTemplate || null,
        defaultAgents: Number(form.defaultAgents) || 6,
        teammateMode: form.teammateMode || "in-process",
        claudeAgentTeamsEnv: Boolean(form.claudeAgentTeamsEnv),
        kickoffCommand: form.kickoffCommand || null,
      });
      setEffectiveConfig(payload?.effectiveConfig || {});
      setResult({ ok: true, stdout: "Settings saved. Watchers and paths were refreshed." });
    } catch (error) {
      setResult({ ok: false, stderr: String(error?.message || error) });
    } finally {
      setSaving(false);
    }
  }

  async function onRun(command) {
    setRunning(true);
    setResult(null);
    try {
      const payload = await runClaudeCommand(command, effectiveConfig?.projectRoot || null);
      setResult(payload);
    } catch (error) {
      setResult({ ok: false, stderr: String(error?.message || error) });
    } finally {
      setRunning(false);
    }
  }

  async function onBrowseDirectory(fieldName, currentPath) {
    const selected = await selectDirectory(currentPath || null);
    if (selected) {
      setForm((prev) => ({ ...prev, [fieldName]: selected }));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure directories and Claude defaults so users can initialize and start swarms entirely from the app"
      />

      <Panel title="Workspace Defaults" description="These values become the app runtime config and init wizard defaults">
        {loading ? <p className="text-sm text-[var(--text-secondary)]">Loading settings...</p> : null}
        {!loading ? (
          <form className="space-y-3" onSubmit={onSave}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                Team name
                <input
                  value={form.teamName}
                  onChange={(event) => setForm((prev) => ({ ...prev, teamName: event.target.value }))}
                  placeholder="agent-squad-team"
                  className="mt-1 w-full rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </label>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                Default agents
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={form.defaultAgents}
                  onChange={(event) => setForm((prev) => ({ ...prev, defaultAgents: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-1">
              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                Workspaces directory
                <div className="mt-1 flex gap-2">
                  <input
                    value={form.workspacesDir}
                    onChange={(event) => setForm((prev) => ({ ...prev, workspacesDir: event.target.value }))}
                    placeholder="~/Projects/agent-swarm/workspaces"
                    className="flex-1 rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                  {isTauri() && (
                    <button
                      type="button"
                      onClick={() => onBrowseDirectory("workspacesDir", form.workspacesDir)}
                      className="rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
                      title="Browse for directory"
                    >
                      📁 Browse
                    </button>
                  )}
                </div>
              </label>

              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                Claude teams directory
                <div className="mt-1 flex gap-2">
                  <input
                    value={form.teamsDir}
                    onChange={(event) => setForm((prev) => ({ ...prev, teamsDir: event.target.value }))}
                    placeholder="~/.claude/teams/agent-squad-team"
                    className="flex-1 rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                  {isTauri() && (
                    <button
                      type="button"
                      onClick={() => onBrowseDirectory("teamsDir", form.teamsDir)}
                      className="rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
                      title="Browse for directory"
                    >
                      📁 Browse
                    </button>
                  )}
                </div>
              </label>

              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                Claude todos directory
                <div className="mt-1 flex gap-2">
                  <input
                    value={form.tasksDir}
                    onChange={(event) => setForm((prev) => ({ ...prev, tasksDir: event.target.value }))}
                    placeholder="~/.claude/todos"
                    className="flex-1 rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                  {isTauri() && (
                    <button
                      type="button"
                      onClick={() => onBrowseDirectory("tasksDir", form.tasksDir)}
                      className="rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
                      title="Browse for directory"
                    >
                      📁 Browse
                    </button>
                  )}
                </div>
              </label>

              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                Preferred template
                <input
                  value={form.preferredTemplate}
                  onChange={(event) => setForm((prev) => ({ ...prev, preferredTemplate: event.target.value }))}
                  placeholder="software-build / research / social-media"
                  className="mt-1 w-full rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                Teammate mode
                <input
                  value={form.teammateMode}
                  onChange={(event) => setForm((prev) => ({ ...prev, teammateMode: event.target.value }))}
                  placeholder="in-process"
                  className="mt-1 w-full rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={Boolean(form.claudeAgentTeamsEnv)}
                  onChange={(event) => setForm((prev) => ({ ...prev, claudeAgentTeamsEnv: event.target.checked }))}
                />
                Force CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
              </label>
            </div>

            <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
              Kickoff command template
              <input
                value={form.kickoffCommand}
                onChange={(event) => setForm((prev) => ({ ...prev, kickoffCommand: event.target.value }))}
                placeholder="claude --teammate-mode in-process"
                className="mt-1 w-full rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                Supports {"{workspaceId}"} placeholder. Current preview: <code>{kickoffPreview}</code>
              </p>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md border border-border bg-[var(--interactive-active)] px-3 py-1.5 text-xs text-[var(--text-primary)] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save settings"}
              </button>
              <button
                type="button"
                onClick={() => copyText(kickoffPreview)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
              >
                Copy kickoff command
              </button>
            </div>
          </form>
        ) : null}
      </Panel>

      <Panel title="Run Claude from App" description="Use saved command defaults so users can stay inside the app">
        <div className="space-y-3 text-sm">
          <p className="text-[var(--text-secondary)]">
            Current workspace: <code>{workspaceId || "none selected"}</code>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={running}
              onClick={() => onRun("claude --version")}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] disabled:opacity-60"
            >
              {running ? "Running..." : "Test Claude CLI"}
            </button>
            <button
              disabled={running}
              onClick={() => onRun(kickoffPreview)}
              className="rounded-md border border-border bg-[var(--interactive-active)] px-3 py-1.5 text-xs text-[var(--text-primary)] disabled:opacity-60"
            >
              Run kickoff command
            </button>
            <button
              disabled={running || !workspaceId}
              onClick={async () => {
                setRunning(true);
                setResult(null);
                try {
                  const payload = await runSwarmKickoff(workspaceId);
                  setResult(payload);
                } catch (error) {
                  setResult({ ok: false, stderr: String(error?.message || error) });
                } finally {
                  setRunning(false);
                }
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] disabled:opacity-60"
            >
              Run workspace kickoff (no terminal)
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Effective Runtime Config" description="These are the currently active paths used by the desktop backend">
        <div className="space-y-2 text-xs text-[var(--text-secondary)]">
          <p>Project root: <code>{effectiveConfig?.projectRoot || "N/A"}</code></p>
          <p>Team name: <code>{effectiveConfig?.teamName || "N/A"}</code></p>
          <p>Workspaces dir: <code>{effectiveConfig?.workspacesDir || "N/A"}</code></p>
          <p>Teams dir: <code>{effectiveConfig?.teamsDir || "N/A"}</code></p>
          <p>Tasks dir: <code>{effectiveConfig?.tasksDir || "N/A"}</code></p>
          <p>Settings file: <code>{settingsPath || "N/A"}</code></p>
        </div>
      </Panel>

      {result ? (
        <Panel title="Command Result" description="Most recent save/run output">
          <div className="space-y-2 text-xs">
            <p className={result.ok ? "text-emerald-400" : "text-amber-300"}>
              {result.ok ? "Success" : "Failed"}
            </p>
            {result.exitCode != null ? <p>Exit code: {result.exitCode}</p> : null}
            {result.stdout ? <pre className="whitespace-pre-wrap text-[var(--text-secondary)]">{result.stdout}</pre> : null}
            {result.stderr ? <pre className="whitespace-pre-wrap text-amber-300">{result.stderr}</pre> : null}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
