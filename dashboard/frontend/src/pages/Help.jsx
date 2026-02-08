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

      <Panel title="Setup Center">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
          <p>Use the new Setup page for Agent Teams readiness checks and one-click workspace creation.</p>
          <a
            href="#/setup"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
          >
            Open Setup
          </a>
        </div>
      </Panel>

      <Panel title="Operator Quickstart (90 seconds)">
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p>1. Initialize workspace, 2. Start dashboard, 3. Start teammate mode, 4. Paste kickoff prompt.</p>
          <CommandRow title="Initialize workspace" command={initCommand} />
          <CommandRow title="Start desktop app" command={dashboardCommand} />
          <CommandRow title="Legacy web dashboard (optional)" command="npm run start" />
          <CommandRow title="Start agent team mode" command={teammateCommand} />
        </div>
      </Panel>

      <Panel
        title="Claude Kickoff Prompt"
        description="Paste this into Claude to connect to the selected workspace"
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

      <Panel title="Keyboard Shortcuts">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm text-[var(--text-secondary)]">{shortcut.description}</span>
              <kbd className="rounded bg-[var(--surface-3)] px-2 py-0.5 text-xs">{shortcut.keys}</kbd>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Recovery Flows">
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
