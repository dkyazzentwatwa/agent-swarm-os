import { useOutletContext } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { SHORTCUTS } from "@/lib/shortcuts";

function copyText(text) {
  return navigator.clipboard.writeText(text).catch(() => {
    window.prompt("Copy command:", text);
  });
}

function CommandRow({ title, command }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-[var(--surface-2)] px-3 py-2">
      <div>
        <p className="text-sm text-[var(--text-primary)]">{title}</p>
        <code className="text-xs text-[var(--text-secondary)]">{command}</code>
      </div>
      <button
        onClick={() => copyText(command)}
        className="rounded-md border border-border px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
      >
        Copy
      </button>
    </div>
  );
}

export default function Help() {
  const { workspaceId, workspaceData } = useOutletContext();
  const manifest = workspaceData?.manifest;
  const teamName = manifest?.team?.name || "agent-squad-team";
  const workspaceTitle = manifest?.workspace?.title || "Current Workspace";
  const workspacePath = workspaceId ? `workspaces/${workspaceId}` : "workspaces/<workspace-id>";

  const initCommand = `npm run init -- -t "${workspaceTitle}" -a 6`;
  const dashboardCommand = "npm run tauri:dev";
  const teammateCommand = "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --teammate-mode in-process";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help"
        description="Operator quickstart and recovery guide"
      />

      <Panel title="Quickstart (One-Click Workflow)" collapsible defaultCollapsed={false} storageKey="help-panel-quickstart">
        <div className="space-y-3 text-sm text-[var(--text-secondary)]">
          <div className="rounded-md border border-border bg-[var(--surface-2)] p-3">
            <p className="font-semibold text-[var(--text-primary)] mb-2">✨ New streamlined workflow (recommended)</p>
            <ol className="space-y-2 list-decimal list-inside">
              <li>Go to <a href="#/setup" className="text-blue-400 hover:underline">Setup</a> page → Create or select workspace</li>
              <li>Go to <a href="#/settings" className="text-blue-400 hover:underline">Settings</a> page → "Run Claude from App" panel</li>
              <li>Click <strong>"Copy workspace prompt"</strong> (copies kickoff prompt to clipboard)</li>
              <li>Click <strong>"Run kickoff command"</strong> (opens Terminal with Claude CLI ready)</li>
              <li>Paste prompt (Cmd+V) into Claude → Mission starts!</li>
            </ol>
            <p className="mt-3 text-xs">
              💡 <strong>Tip:</strong> Edit your workspace prompt in Settings → "Workspace Kickoff Prompt" panel before running.
            </p>
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="font-semibold text-amber-300 mb-2">⚡ One-click alternative</p>
            <p>Click <strong>"Run workspace kickoff (no terminal)"</strong> to execute headlessly with the saved prompt file.</p>
            <p className="text-xs mt-1">Uses <code>.agentsquad/kickoff-prompt.txt</code> automatically.</p>
          </div>
        </div>
      </Panel>

      <Panel title="Setup Center" collapsible defaultCollapsed={true} storageKey="help-panel-setup">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
          <p>Use the Setup page for Agent Teams readiness checks and one-click workspace creation.</p>
          <a
            href="#/setup"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
          >
            Open Setup
          </a>
        </div>
      </Panel>

      <Panel title="Manual Workflow (Terminal Commands)" collapsible defaultCollapsed={true} storageKey="help-panel-manual">
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p className="mb-2">Traditional command-line workflow for advanced users:</p>
          <CommandRow title="Initialize workspace" command={initCommand} />
          <CommandRow title="Start desktop app" command={dashboardCommand} />
          <CommandRow title="Legacy web dashboard (optional)" command="npm run start" />
          <CommandRow title="Start agent team mode" command={teammateCommand} />
        </div>
      </Panel>

      <Panel
        title="Settings Features"
        description="New Settings page capabilities for streamlined mission control"
        collapsible
        defaultCollapsed={true}
        storageKey="help-panel-settings"
      >
        <div className="space-y-3 text-sm text-[var(--text-secondary)]">
          <div className="rounded-md border border-border bg-[var(--surface-2)] p-3">
            <p className="font-semibold text-[var(--text-primary)] mb-1">Run Claude from App</p>
            <ul className="space-y-1 list-disc list-inside text-xs">
              <li><strong>Copy workspace prompt</strong> - One-click copy of kickoff prompt to clipboard</li>
              <li><strong>Run kickoff command</strong> - Opens Terminal.app with Claude CLI ready (includes env vars)</li>
              <li><strong>Run workspace kickoff (no terminal)</strong> - Headless execution with saved prompt file</li>
            </ul>
          </div>

          <div className="rounded-md border border-border bg-[var(--surface-2)] p-3">
            <p className="font-semibold text-[var(--text-primary)] mb-1">Workspace Kickoff Prompt</p>
            <ul className="space-y-1 list-disc list-inside text-xs">
              <li>Edit <code>.agentsquad/kickoff-prompt.txt</code> directly in the app</li>
              <li>Save changes instantly</li>
              <li>Reload from file to discard unsaved edits</li>
            </ul>
          </div>

          <div className="rounded-md border border-border bg-[var(--surface-2)] p-3">
            <p className="font-semibold text-[var(--text-primary)] mb-1">Collapsible Panels</p>
            <p className="text-xs">Click any panel header to expand/collapse. State persists across sessions.</p>
          </div>
        </div>
      </Panel>

      <Panel
        title="Default Kickoff Prompt (Reference)"
        description="Standard prompt structure for workspace missions"
        collapsible
        defaultCollapsed={true}
        storageKey="help-panel-kickoff-prompt"
      >
        <div className="mb-2 flex justify-end">
          <button
            onClick={() => copyText(`Start Agent Squad workflow for workspace:\n${workspacePath}`)}
            className="rounded-md border border-border px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
          >
            Copy starter header
          </button>
        </div>
        <pre className="whitespace-pre-wrap rounded-md border border-border bg-[var(--surface-2)] p-3 text-xs text-[var(--text-primary)]">
{`Start Agent Squad workflow for workspace:
${workspacePath}

Load:
- workspace.json
- tasks.json
- source/mission.md
- agents/*.md

Then:
1) Assign each pending task to the correct agent role.
2) Begin execution in workflow-lane order.
3) Post all progress updates to ~/.claude/teams/${teamName}/team-feed.jsonl as JSONL events with type: update/insight/blocker.
4) Write outputs into the corresponding artifacts/{module-id}/ folders.
5) Mark tasks complete in tasks.json as work finishes.`}
        </pre>
      </Panel>

      <Panel
        title="Keyboard Shortcuts"
        collapsible
        defaultCollapsed={true}
        storageKey="help-panel-shortcuts"
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm text-[var(--text-secondary)]">{shortcut.description}</span>
              <kbd className="rounded bg-[var(--surface-3)] px-2 py-0.5 text-xs">{shortcut.keys}</kbd>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Recovery Flows"
        collapsible
        defaultCollapsed={true}
        storageKey="help-panel-recovery"
      >
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <div className="rounded-md border border-border bg-[var(--surface-2)] p-3">
            <p className="font-medium text-[var(--text-primary)]">Stale dashboard</p>
            <p>Verify teammate process is running and posting to team feed JSONL, then refresh workspace selection.</p>
          </div>
          <div className="rounded-md border border-border bg-[var(--surface-2)] p-3">
            <p className="font-medium text-[var(--text-primary)]">Missing summary</p>
            <p>Confirm `dashboard.summaryFile` path in `workspace.json` and check Artifacts panel for generated summary files.</p>
          </div>
          <div className="rounded-md border border-border bg-[var(--surface-2)] p-3">
            <p className="font-medium text-[var(--text-primary)]">No live comms</p>
            <p>Ask agents for a status pulse and confirm updates are emitted with `update/insight/blocker` message types.</p>
          </div>
          <div className="rounded-md border border-border bg-[var(--surface-2)] p-3">
            <p className="font-medium text-[var(--text-primary)]">Workspace nav incomplete</p>
            <p>Open command palette (`Cmd/Ctrl+K`) and navigate directly while verifying `dashboard.nav` in manifest.</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
