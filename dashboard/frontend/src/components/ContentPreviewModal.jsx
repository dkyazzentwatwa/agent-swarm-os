import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Modal } from "./Modal";
import { cn, timeAgo } from "@/lib/utils";

const FILE_CATEGORIES = {
  all: () => true,
  docs: (ext) => ["md", "txt"].includes(ext),
  data: (ext) => ["json", "csv", "yaml", "yml"].includes(ext),
  code: (ext) => ["js", "jsx", "ts", "tsx", "py", "go", "java", "rb", "php", "rs", "sh", "c", "cpp"].includes(ext),
};

function getExtension(filename) {
  const ext = String(filename || "").split(".").pop()?.toLowerCase();
  if (!ext || ext === filename) return "none";
  return ext;
}

function isMarkdownFile(filename) {
  const ext = getExtension(filename);
  return ext === "md" || ext === "markdown";
}

function toTimestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isWithinWindow(lastModified, windowKey) {
  if (windowKey === "all") return true;
  const timestamp = toTimestamp(lastModified);
  if (!timestamp) return false;

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  if (windowKey === "24h") return now - timestamp <= oneDay;
  if (windowKey === "7d") return now - timestamp <= 7 * oneDay;
  return true;
}

function buildTree(files) {
  const root = { key: "root", name: "", type: "folder", path: "", folders: [], files: [] };
  const folderMap = new Map([["", root]]);

  files.forEach((file) => {
    const parts = String(file.name || "").split("/").filter(Boolean);
    if (parts.length === 0) return;

    let currentPath = "";
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!folderMap.has(currentPath)) {
        const node = { key: `folder:${currentPath}`, name: part, type: "folder", path: currentPath, folders: [], files: [] };
        folderMap.set(currentPath, node);
        const parentPath = currentPath.includes("/") ? currentPath.slice(0, currentPath.lastIndexOf("/")) : "";
        folderMap.get(parentPath).folders.push(node);
      }
    }

    const parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    folderMap.get(parentPath).files.push({
      key: `file:${file.name}`,
      type: "file",
      name: parts[parts.length - 1],
      path: file.name,
      file,
    });
  });

  function sortFolder(node) {
    node.folders.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.name.localeCompare(b.name));
    node.folders.forEach(sortFolder);
  }

  sortFolder(root);
  return root;
}

function getBreadcrumb(pathname) {
  const parts = String(pathname || "").split("/").filter(Boolean);
  if (parts.length === 0) return ["root"];
  return parts;
}

export function ContentPreviewModal({ isOpen, onClose, workspaceTitle, moduleLabel, moduleEmoji, files }) {
  const [activeFileName, setActiveFileName] = useState("");
  const [compareFile, setCompareFile] = useState("");
  const [fileCategory, setFileCategory] = useState("all");
  const [recentWindow, setRecentWindow] = useState("all");
  const [collapsedFolders, setCollapsedFolders] = useState(() => new Set());
  const [copied, setCopied] = useState(false);

  const sortedFiles = useMemo(() => {
    const list = Array.isArray(files) ? files.slice() : [];
    return list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [files]);

  const visibleFiles = useMemo(() => {
    return sortedFiles.filter((file) => {
      const extension = getExtension(file.name);
      const matchesCategory = FILE_CATEGORIES[fileCategory]?.(extension) ?? true;
      return matchesCategory && isWithinWindow(file.lastModified, recentWindow);
    });
  }, [sortedFiles, fileCategory, recentWindow]);

  const visibleFileMap = useMemo(() => new Map(visibleFiles.map((file) => [file.name, file])), [visibleFiles]);
  const tree = useMemo(() => buildTree(visibleFiles), [visibleFiles]);

  const resolvedActiveFileName =
    activeFileName && visibleFileMap.has(activeFileName) ? activeFileName : visibleFiles[0]?.name || "";
  const currentFile = resolvedActiveFileName ? visibleFileMap.get(resolvedActiveFileName) || null : null;
  const resolvedCompareFileName =
    compareFile && compareFile !== resolvedActiveFileName && visibleFileMap.has(compareFile) ? compareFile : "";
  const compareTarget = resolvedCompareFileName ? visibleFileMap.get(resolvedCompareFileName) || null : null;

  if (!isOpen || !files) return null;

  const handleCopy = async () => {
    if (!currentFile?.content) return;

    try {
      await navigator.clipboard.writeText(currentFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy content:", currentFile.content);
    }
  };

  const toggleFolder = (folderPath) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${moduleEmoji || "📦"} ${workspaceTitle}`}
      subtitle={`${moduleLabel || "Module"} • ${visibleFiles.length} visible file${visibleFiles.length !== 1 ? "s" : ""}`}
      size="full"
    >
      <div className="flex h-[80vh] flex-col lg:flex-row">
        <aside className="border-b border-border lg:w-80 lg:border-b-0 lg:border-r">
          <div className="space-y-2 border-b border-border px-3 py-3">
            <p className="text-xs font-medium text-[var(--text-secondary)]">Filters</p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={fileCategory}
                onChange={(event) => setFileCategory(event.target.value)}
                className="rounded-md border border-border bg-[var(--surface-2)] px-2 py-1 text-xs"
              >
                <option value="all">All</option>
                <option value="docs">Docs</option>
                <option value="data">Data</option>
                <option value="code">Code</option>
              </select>
              <select
                value={recentWindow}
                onChange={(event) => setRecentWindow(event.target.value)}
                className="rounded-md border border-border bg-[var(--surface-2)] px-2 py-1 text-xs"
              >
                <option value="all">All time</option>
                <option value="24h">24h</option>
                <option value="7d">7d</option>
              </select>
            </div>
          </div>

          <div className="max-h-[260px] overflow-y-auto px-2 py-2 lg:max-h-[calc(80vh-76px)]">
            {visibleFiles.length === 0 ? (
              <p className="px-2 py-2 text-xs text-[var(--text-secondary)]">No files match current filters.</p>
            ) : (
              <TreeNode
                node={tree}
                depth={0}
                activeFileName={currentFile?.name || ""}
                collapsedFolders={collapsedFolders}
                onToggleFolder={toggleFolder}
                onSelectFile={(fileName) => setActiveFileName(fileName)}
              />
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-10 space-y-2 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-mono text-[var(--text-primary)]">{currentFile?.name || "No file selected"}</p>
                <p className="truncate text-xs text-[var(--text-secondary)]">{getBreadcrumb(currentFile?.name).join(" / ")}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={resolvedCompareFileName}
                  onChange={(event) => setCompareFile(event.target.value)}
                  className="max-w-[220px] truncate rounded-md border border-border bg-[var(--surface-2)] px-2 py-1 text-xs"
                >
                  <option value="">Compare: off</option>
                  {visibleFiles
                    .filter((file) => file.name !== currentFile?.name)
                    .map((file) => (
                      <option key={file.name} value={file.name}>
                        {file.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleCopy}
                  className={cn(
                    "rounded px-2 py-1 text-xs transition-colors",
                    copied
                      ? "bg-[color-mix(in_srgb,var(--status-success)_20%,transparent)] text-[var(--status-success)]"
                      : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-4">
              <MetaPill label="Path" value={currentFile?.name || "-"} />
              <MetaPill label="Type" value={currentFile ? `.${getExtension(currentFile.name)}` : "-"} />
              <MetaPill label="Size" value={currentFile?.size != null ? `${currentFile.size} bytes` : "-"} />
              <MetaPill
                label="Modified"
                value={currentFile?.lastModified ? `${timeAgo(currentFile.lastModified)} (${new Date(currentFile.lastModified).toLocaleString()})` : "-"}
              />
            </div>
          </div>

          <div className={cn("min-h-0 flex-1 overflow-auto p-4", compareTarget ? "grid grid-cols-1 gap-3 lg:grid-cols-2" : "")}>
            <FilePanel file={currentFile} title={currentFile?.name || "Primary"} />
            {compareTarget ? <FilePanel file={compareTarget} title={compareTarget.name} /> : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TreeNode({ node, depth, activeFileName, collapsedFolders, onToggleFolder, onSelectFile }) {
  if (node.type === "folder" && node.path === "") {
    return (
      <div>
        {node.folders.map((folder) => (
          <TreeNode
            key={folder.key}
            node={folder}
            depth={depth}
            activeFileName={activeFileName}
            collapsedFolders={collapsedFolders}
            onToggleFolder={onToggleFolder}
            onSelectFile={onSelectFile}
          />
        ))}
        {node.files.map((fileNode) => (
          <TreeNode
            key={fileNode.key}
            node={fileNode}
            depth={depth}
            activeFileName={activeFileName}
            collapsedFolders={collapsedFolders}
            onToggleFolder={onToggleFolder}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    );
  }

  if (node.type === "folder") {
    const isCollapsed = collapsedFolders.has(node.path);
    return (
      <div>
        <button
          onClick={() => onToggleFolder(node.path)}
          className="mb-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <span className="text-xs">{isCollapsed ? "▶" : "▼"}</span>
          <span>📁</span>
          <span className="truncate">{node.name}</span>
        </button>
        {!isCollapsed ? (
          <div>
            {node.folders.map((folder) => (
              <TreeNode
                key={folder.key}
                node={folder}
                depth={depth + 1}
                activeFileName={activeFileName}
                collapsedFolders={collapsedFolders}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
              />
            ))}
            {node.files.map((fileNode) => (
              <TreeNode
                key={fileNode.key}
                node={fileNode}
                depth={depth + 1}
                activeFileName={activeFileName}
                collapsedFolders={collapsedFolders}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const file = node.file;
  const isActive = activeFileName === file.name;
  return (
    <button
      onClick={() => onSelectFile(file.name)}
      className={cn(
        "mb-1 flex w-full items-center gap-2 rounded py-1.5 pr-2 text-left text-sm font-mono transition-colors",
        isActive
          ? "bg-[var(--interactive-active)] text-[var(--text-primary)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]"
      )}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
    >
      <span>{getFileIcon(file.name)}</span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function MetaPill({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-[var(--surface-2)] px-2 py-1">
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="truncate text-[11px] text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function FilePanel({ file, title }) {
  return (
    <section className="min-w-0 rounded-md border border-border bg-[var(--surface-2)] p-3">
      <h4 className="mb-2 truncate text-xs font-medium text-[var(--text-secondary)]">{title}</h4>
      {file?.error ? (
        <p className="text-sm text-[var(--status-error)]">{file.error}</p>
      ) : file?.content ? (
        <FileContentRenderer filename={file.name} content={file.content} />
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">Empty file</p>
      )}
    </section>
  );
}

function FileContentRenderer({ filename, content }) {
  if (isMarkdownFile(filename)) {
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

  return <pre className="whitespace-pre-wrap break-words text-sm font-mono leading-relaxed text-[var(--text-primary)]">{content}</pre>;
}

function getFileIcon(filename) {
  const ext = getExtension(filename);
  const icons = {
    md: "M",
    json: "{}",
    js: "JS",
    jsx: "JX",
    ts: "TS",
    tsx: "TX",
    py: "PY",
    css: "CS",
    html: "HT",
    txt: "TX",
  };
  return icons[ext] || "F";
}
