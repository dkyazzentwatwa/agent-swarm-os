import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePolling } from "@/hooks/usePolling";
import { useContent } from "@/hooks/useContent";
import { useCoffeeRoom } from "@/hooks/useCoffeeRoom";
import { cn, timeAgo } from "@/lib/utils";
import { storage } from "@/lib/storage";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";

function buildSummaryUrl(workspaceId, file) {
  if (!workspaceId) return "/api/summary";
  const params = new URLSearchParams({ workspaceId });
  if (file) params.set("file", file);
  return `/api/summary?${params.toString()}`;
}

function detectFinalComms(messages = []) {
  return messages.some((message) => /final|complete|handoff|delivered/i.test(message.message || ""));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseSummarySections(content) {
  if (!content) return [];

  const lines = String(content).split("\n");
  const sections = [];
  let currentSection = null;

  function pushCurrent() {
    if (!currentSection) return;
    sections.push({
      ...currentSection,
      content: currentSection.lines.join("\n").trim(),
    });
  }

  lines.forEach((line, index) => {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      pushCurrent();
      const headingText = headingMatch[2].trim();
      currentSection = {
        id: `${slugify(headingText) || "section"}-${sections.length + 1}`,
        title: headingText,
        level: headingMatch[1].length,
        lines: [],
        index,
      };
      return;
    }

    if (!currentSection) {
      currentSection = {
        id: "overview-0",
        title: "Overview",
        level: 1,
        lines: [],
        index: 0,
      };
    }
    currentSection.lines.push(line);
  });

  pushCurrent();
  return sections.filter((section) => section.content || section.title);
}

function readSummaryPrefs(workspaceId) {
  const parsed = storage.workspaceGet(workspaceId || "all", "summary.prefs", {});
  return {
    viewMode: parsed.viewMode === "full" ? "full" : "sections",
    checklistFilter: ["all", "ready", "missing"].includes(parsed.checklistFilter) ? parsed.checklistFilter : "all",
    navCollapsed: typeof parsed.navCollapsed === "boolean" ? parsed.navCollapsed : false,
  };
}

function writeSummaryPrefs(workspaceId, prefs) {
  storage.workspaceSet(workspaceId || "all", "summary.prefs", prefs);
}

export default function Summary() {
  const navigate = useNavigate();
  const { workspaceId, workspaceData } = useOutletContext();
  const [selectedSummaryByWorkspace, setSelectedSummaryByWorkspace] = useState({});
  const requestedSummaryFile = selectedSummaryByWorkspace[workspaceId] || "";
  const url = buildSummaryUrl(workspaceId, requestedSummaryFile);
  const { data, isLoading } = usePolling(["summary", workspaceId || "latest", requestedSummaryFile || "default"], url, { interval: 5000 });
  const { data: artifacts } = useContent(workspaceId);
  const { data: comms } = useCoffeeRoom(workspaceId);

  const [summaryPrefsByWorkspace, setSummaryPrefsByWorkspace] = useState({});
  const [selectedSectionByWorkspace, setSelectedSectionByWorkspace] = useState({});
  const [searchQuery, setSearchQuery] = useState("");

  const prefs = summaryPrefsByWorkspace[workspaceId] || readSummaryPrefs(workspaceId);

  function updatePrefs(changes) {
    const next = { ...prefs, ...changes };
    setSummaryPrefsByWorkspace((prev) => ({ ...prev, [workspaceId]: next }));
    writeSummaryPrefs(workspaceId, next);
  }

  const manifest = workspaceData?.manifest;
  const workspaceTitle = manifest?.workspace?.title || "Summary";
  const summaryFile = manifest?.dashboard?.summaryFile || "artifacts/summary/summary.md";
  const content = useMemo(() => data?.content || "", [data?.content]);
  const filename = data?.file || summaryFile;
  const availableSummaries = useMemo(() => data?.summaries || [], [data?.summaries]);

  const sections = useMemo(() => parseSummarySections(content), [content]);
  const selectedSection = selectedSectionByWorkspace[workspaceId] || "all";

  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const base = selectedSection === "all" ? sections : sections.filter((section) => section.id === selectedSection);
    if (!query) return base;
    return base.filter((section) => `${section.title}\n${section.content}`.toLowerCase().includes(query));
  }, [sections, selectedSection, searchQuery]);

  const artifactSummary = useMemo(
    () => (artifacts || []).find((entry) => entry.workspaceId === workspaceId) || null,
    [artifacts, workspaceId]
  );

  const moduleStats = useMemo(() => {
    const modules = manifest?.modules || [];
    const moduleCount = modules.length;
    let coveredModules = 0;
    let totalFiles = 0;
    let lastModified = null;

    modules.forEach((moduleDef) => {
      const files = artifactSummary?.modules?.[moduleDef.id] || [];
      if (files.length > 0) coveredModules += 1;
      totalFiles += files.length;

      const modified = artifactSummary?.moduleMeta?.[moduleDef.id]?.lastModified;
      if (modified && (!lastModified || Date.parse(modified) > Date.parse(lastModified))) {
        lastModified = modified;
      }
    });

    return { moduleCount, coveredModules, totalFiles, lastModified };
  }, [manifest?.modules, artifactSummary]);

  const checklist = useMemo(() => {
    const moduleCoverage = moduleStats.moduleCount > 0 && moduleStats.coveredModules === moduleStats.moduleCount;
    const items = [
      { id: "summary", label: "Summary file exists", done: !!content },
      { id: "modules", label: "Each module has at least one artifact", done: moduleCoverage },
      { id: "comms", label: "Comms include final update signal", done: detectFinalComms(comms?.messages || []) },
    ];

    if (prefs.checklistFilter === "ready") return items.filter((item) => item.done);
    if (prefs.checklistFilter === "missing") return items.filter((item) => !item.done);
    return items;
  }, [moduleStats, content, comms?.messages, prefs.checklistFilter]);

  async function copySummary() {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      window.prompt("Copy summary:", content);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Summary" description={workspaceTitle} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={copySummary}
          disabled={!content}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Copy summary
        </button>
        <button
          onClick={() => navigate("/artifacts")}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
        >
          Open in Artifacts
        </button>
        <select
          value={filename}
          onChange={(event) => {
            const nextFile = event.target.value;
            setSelectedSummaryByWorkspace((prev) => ({ ...prev, [workspaceId]: nextFile }));
            setSelectedSectionByWorkspace((prev) => ({ ...prev, [workspaceId]: "all" }));
          }}
          className="min-w-[220px] rounded-md border border-border bg-[var(--surface-2)] px-2 py-1.5 text-xs text-[var(--text-secondary)]"
        >
          {[{ file: filename, isExpected: true }, ...availableSummaries]
            .filter((item, index, arr) => arr.findIndex((entry) => entry.file === item.file) === index)
            .map((item) => (
              <option key={item.file} value={item.file}>
                {item.isExpected ? `Primary: ${item.file}` : item.file}
              </option>
            ))}
        </select>
        <button
          onClick={() => updatePrefs({ navCollapsed: !prefs.navCollapsed })}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] lg:hidden"
        >
          {prefs.navCollapsed ? "Show organization" : "Hide organization"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={cn("space-y-4", prefs.navCollapsed ? "hidden lg:block" : "block")}>
          <Panel title="Workspace Snapshot" description="Scope and output status">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <StatPill label="Modules" value={`${moduleStats.coveredModules}/${moduleStats.moduleCount}`} />
              <StatPill label="Files" value={String(moduleStats.totalFiles)} />
              <StatPill label="Sections" value={String(sections.length)} />
              <StatPill label="Updated" value={moduleStats.lastModified ? timeAgo(moduleStats.lastModified) : "-"} />
            </div>
          </Panel>

          <Panel title="Summary Navigation" description="Jump through long summaries">
            <div className="space-y-2">
              <SearchInput
                inputId="summary-section-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Filter section content..."
              />
              <div className="max-h-[260px] space-y-1 overflow-y-auto pr-1">
                <button
                  onClick={() => setSelectedSectionByWorkspace((prev) => ({ ...prev, [workspaceId]: "all" }))}
                  className={cn(
                    "w-full rounded-md border px-2 py-1.5 text-left text-xs",
                    selectedSection === "all"
                      ? "border-[var(--status-info)]/50 bg-[color-mix(in_srgb,var(--status-info)_10%,transparent)] text-[var(--text-primary)]"
                      : "border-border text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
                  )}
                >
                  All sections
                </button>
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setSelectedSectionByWorkspace((prev) => ({ ...prev, [workspaceId]: section.id }))}
                    className={cn(
                      "w-full rounded-md border px-2 py-1.5 text-left text-xs",
                      selectedSection === section.id
                        ? "border-[var(--status-info)]/50 bg-[color-mix(in_srgb,var(--status-info)_10%,transparent)] text-[var(--text-primary)]"
                        : "border-border text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
                    )}
                  >
                    <span className="mr-1 text-[10px] opacity-70">H{section.level}</span>
                    {section.title}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        </aside>

        <div className="space-y-4">
          <Panel title="Final package checklist" description="Workspace-scoped readiness indicators">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                value={prefs.checklistFilter}
                onChange={(event) => updatePrefs({ checklistFilter: event.target.value })}
                className="rounded-md border border-border bg-[var(--surface-2)] px-2 py-1 text-xs"
              >
                <option value="all">All items</option>
                <option value="ready">Ready only</option>
                <option value="missing">Missing only</option>
              </select>
              <select
                value={prefs.viewMode}
                onChange={(event) => updatePrefs({ viewMode: event.target.value })}
                className="rounded-md border border-border bg-[var(--surface-2)] px-2 py-1 text-xs"
              >
                <option value="sections">Section view</option>
                <option value="full">Full document</option>
              </select>
            </div>
            <ul className="space-y-2 text-sm">
              {checklist.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span>{item.label}</span>
                  <span className={item.done ? "text-[var(--status-success)]" : "text-[var(--status-warn)]"}>
                    {item.done ? "Ready" : "Missing"}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Final Summary" description={`Source: ${filename}`}>
            {isLoading ? <div className="min-h-[200px] animate-pulse rounded-md border border-border bg-[var(--surface-2)]" /> : null}

            {!isLoading && !content ? (
              <EmptyState
                preset="content"
                title="No summary yet"
                description="This workspace hasn't produced a final summary file."
              />
            ) : null}

            {!isLoading && content && prefs.viewMode === "full" ? (
              <MarkdownBlock content={content} />
            ) : null}

            {!isLoading && content && prefs.viewMode === "sections" ? (
              <div className="space-y-3">
                {filteredSections.length === 0 ? (
                  <EmptyState preset="search" description="No sections matched the current filter." />
                ) : (
                  filteredSections.map((section) => (
                    <section key={section.id} className="rounded-md border border-border bg-[var(--surface-2)] p-3">
                      <h4 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                        {section.title}
                        <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">H{section.level}</span>
                      </h4>
                      <MarkdownBlock content={section.content || "(No content)"} />
                    </section>
                  ))
                )}
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-[var(--surface-2)] px-2 py-1">
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="truncate text-[11px] text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function MarkdownBlock({ content }) {
  return (
    <div className="prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-primary)] prose-strong:text-[var(--text-primary)] prose-code:text-[var(--text-primary)] prose-pre:bg-[var(--surface-3)] prose-pre:text-[var(--text-primary)] prose-blockquote:text-[var(--text-secondary)] prose-li:text-[var(--text-primary)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ ...props }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs" {...props} />
            </div>
          ),
          th: ({ ...props }) => <th className="border border-border bg-[var(--surface-3)] px-2 py-1 text-left" {...props} />,
          td: ({ ...props }) => <td className="border border-border px-2 py-1 align-top" {...props} />,
          code: ({ className, children, ...props }) => {
            const isBlock = String(className || "").includes("language-");
            if (isBlock) {
              return (
                <code className={cn("block whitespace-pre-wrap break-words rounded-md bg-[var(--surface-3)] p-2 text-xs", className)} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-[var(--surface-3)] px-1 py-0.5 text-xs" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
