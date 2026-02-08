import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { usePolling } from "@/hooks/usePolling";
import { isTauri, runWorkspaceInit } from "@/lib/transport";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";

function copyText(text) {
  return navigator.clipboard.writeText(text).catch(() => {
    window.prompt("Copy text:", text);
  });
}

function StatusPill({ ok, label }) {
  return (
    <span
      className={ok
        ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400"
        : "rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300"
      }
    >
      {ok ? "Ready" : "Needs setup"} • {label}
    </span>
  );
}

export default function Setup() {
  const navigate = useNavigate();
  const { workspaceId, workspaceData, onWorkspaceChange } = useOutletContext();
  const [topic, setTopic] = useState("");
  const [agents, setAgents] = useState("6");
  const [template, setTemplate] = useState("");
  const [teamName, setTeamName] = useState("");
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  const { data: setupStatus, isLoading, refetch } = usePolling(["setup-status"], "/api/setup/status", {
    interval: 5000,
  });

  const isReady = Boolean(setupStatus?.ready);
  const appTeamName = workspaceData?.manifest?.team?.name || "agent-squad-team";

  const recommendedCommand = setupStatus?.recommendedCommand
    || "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --teammate-mode in-process";

  const quickStartCommands = useMemo(
    () => [
      "npm install",
      "cd dashboard/backend && npm install",
      "cd ../frontend && npm install",
      "npm run tauri:dev",
      recommendedCommand,
    ],
    [recommendedCommand]
  );

  async function handleCreateWorkspace(event) {
    event.preventDefault();
    if (!topic.trim()) return;

    if (!isTauri()) {
      setLastRun({
        ok: false,
        stderr: "Create Workspace from UI only works in the Tauri desktop app. Use npm run init in terminal for web mode.",
      });
      return;
    }

    setRunning(true);
    setLastRun(null);

    try {
      const response = await runWorkspaceInit({
        topic: topic.trim(),
        agents: Number.isFinite(Number(agents)) ? Number(agents) : null,
        template: template.trim() || null,
        teamName: teamName.trim() || null,
        quick: true,
      });

      setLastRun(response);
      await refetch();

      if (response?.ok && response?.latestWorkspaceId) {
        onWorkspaceChange?.(response.latestWorkspaceId);
        navigate("/");
      }
    } catch (error) {
      setLastRun({ ok: false, stderr: String(error?.message || error) });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Setup" description="Fast onboarding for Claude Agent Teams and workspace creation" />

      <Panel title="Environment Readiness" description="Checks for Claude CLI and Agent Teams config">
        {isLoading ? <p className="text-sm text-[var(--text-secondary)]">Checking setup...</p> : null}
        {!isLoading ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatusPill ok={Boolean(setupStatus?.claudeInstalled)} label="Claude CLI" />
              <StatusPill ok={Boolean(setupStatus?.agentTeamsEnabled)} label="Agent Teams env" />
              <StatusPill ok={Boolean(setupStatus?.tmuxAvailable)} label="tmux (optional)" />
            </div>
            <div className="rounded-md border border-border bg-[var(--surface-2)] p-3 text-sm text-[var(--text-secondary)]">
              <p>CLI Version: {setupStatus?.claudeVersion || "Not detected"}</p>
              <p>Recommended teammate mode: {setupStatus?.teammateMode || "in-process"}</p>
              {setupStatus?.claudeError ? (
                <p className="mt-1 text-amber-300">CLI check error: {setupStatus.claudeError}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => copyText(recommendedCommand)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
              >
                Copy start command
              </button>
              <button
                onClick={() => copyText(JSON.stringify(setupStatus?.recommendedSettings || {}, null, 2))}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
              >
                Copy settings.json snippet
              </button>
              <a
                href="https://code.claude.com/docs/en/agent-teams.md"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
              >
                Open Agent Teams docs
              </a>
              <button
                onClick={() => navigate("/settings")}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
              >
                Open Settings
              </button>
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel title="Create Workspace" description="One-click mission workspace generation from natural-language topic">
        <form onSubmit={handleCreateWorkspace} className="space-y-3">
          <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
            Mission topic
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Example: Build a SaaS landing page with conversion tracking"
              className="mt-1 w-full rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
              Agents
              <input
                value={agents}
                onChange={(event) => setAgents(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
              Template (optional)
              <input
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
                placeholder="social-media, research, software-build"
                className="mt-1 w-full rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              />
            </label>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
              Team name (optional)
              <input
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder={appTeamName}
                className="mt-1 w-full rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={running || !topic.trim()}
              className="rounded-md border border-border bg-[var(--interactive-active)] px-3 py-1.5 text-xs text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? "Creating workspace..." : "Create workspace"}
            </button>
            {workspaceId ? (
              <button
                type="button"
                onClick={() => navigate("/")}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
              >
                Open current workspace
              </button>
            ) : null}
          </div>
        </form>

        {lastRun ? (
          <div className="mt-4 rounded-md border border-border bg-[var(--surface-2)] p-3 text-xs text-[var(--text-secondary)]">
            <p className={lastRun.ok ? "text-emerald-400" : "text-amber-300"}>
              {lastRun.ok ? "Workspace initialization completed." : "Workspace initialization failed."}
            </p>
            {lastRun.latestWorkspaceId ? <p>Latest workspace: {lastRun.latestWorkspaceId}</p> : null}
            {lastRun.stderr ? <pre className="mt-2 whitespace-pre-wrap">{lastRun.stderr}</pre> : null}
          </div>
        ) : null}
      </Panel>

      <Panel title="Quick Start Commands" description="Paste these in terminal for manual setup">
        <div className="space-y-2">
          {quickStartCommands.map((command) => (
            <div key={command} className="flex items-center justify-between gap-2 rounded-md border border-border bg-[var(--surface-2)] px-3 py-2">
              <code className="text-xs text-[var(--text-secondary)]">{command}</code>
              <button
                onClick={() => copyText(command)}
                className="rounded-md border border-border px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
              >
                Copy
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--text-secondary)]">
          Agent Teams docs: <a className="underline" href="https://code.claude.com/docs/en/agent-teams.md" target="_blank" rel="noreferrer">https://code.claude.com/docs/en/agent-teams.md</a>
        </p>
      </Panel>

      <Panel title="Current Status" description="Live interpretation of setup health">
        <p className={isReady ? "text-sm text-emerald-400" : "text-sm text-amber-300"}>
          {isReady
            ? "Ready: Claude CLI is available and Agent Teams are enabled."
            : "Not ready: finish the checklist above before running swarm missions."}
        </p>
      </Panel>
    </div>
  );
}
