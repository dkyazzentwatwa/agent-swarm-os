import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { useContent } from "@/hooks/useContent";
import { usePolling } from "@/hooks/usePolling";
import { cn, timeAgo, titleFromId } from "@/lib/utils";
import { storage } from "@/lib/storage";
import { ContentPreviewModal } from "@/components/ContentPreviewModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";

const GROUP_BY_OPTIONS = ["none", "folder", "type"];
const SORT_BY_OPTIONS = ["recent", "name", "size"];
const SORT_DIR_OPTIONS = ["desc", "asc"];

function normalizeValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function getStoredPref(workspaceId, key, allowed, fallback) {
  const value = storage.workspaceGet(workspaceId || "all", `artifacts.${key}`, fallback);
  return normalizeValue(value, allowed, fallback);
}

function setStoredPref(workspaceId, key, value) {
  storage.workspaceSet(workspaceId || "all", `artifacts.${key}`, value);
}

function readRecentModules(workspaceId) {
  return storage.workspaceGet(workspaceId || "all", "artifacts.recentModules", []);
}

function readViewPrefs(workspaceId) {
  return {
    groupBy: getStoredPref(workspaceId, "groupBy", GROUP_BY_OPTIONS, "none"),
    sortBy: getStoredPref(workspaceId, "sortBy", SORT_BY_OPTIONS, "recent"),
    sortDir: getStoredPref(workspaceId, "sortDir", SORT_DIR_OPTIONS, "desc"),
  };
}

function toTimestamp(value) {
  const timestamp = Date.parse(value || "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getTopTypes(typeBreakdown = {}, limit = 2) {
  return Object.entries(typeBreakdown)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([ext, count]) => ({ ext, count }));
}

function getDominantFolder(files = []) {
  const folderCounts = {};
  files.forEach((filePath) => {
    const firstSegment = String(filePath).split("/").filter(Boolean)[0];
    const folder = firstSegment && firstSegment.includes(".") ? "root" : firstSegment || "root";
    folderCounts[folder] = (folderCounts[folder] || 0) + 1;
  });

  const entries = Object.entries(folderCounts);
  if (entries.length === 0) return "root";
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return entries[0][0];
}

export default function ContentGallery() {
  const { workspaceId, workspaceData } = useOutletContext();
  const { data: artifacts, isLoading } = useContent(workspaceId);
  const [searchParams, setSearchParams] = useSearchParams();

  const moduleFilter = searchParams.get("module") || "all";
  const mode = searchParams.get("mode") || "all";
  const [searchQuery, setSearchQuery] = useState("");
  const [previewWorkspaceId, setPreviewWorkspaceId] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [viewPrefsByWorkspace, setViewPrefsByWorkspace] = useState({});
  const [recentByWorkspace, setRecentByWorkspace] = useState({});

  const searchInputRef = useRef(null);

  // Refs for keyboard navigation
  const cardRefs = useRef([]);
  const [focusedCardIndex, setFocusedCardIndex] = useState(0);

  const viewPrefs = viewPrefsByWorkspace[workspaceId] || readViewPrefs(workspaceId);
  const groupBy = viewPrefs.groupBy;
  const sortBy = viewPrefs.sortBy;
  const sortDir = viewPrefs.sortDir;
  const recentModules = recentByWorkspace[workspaceId] || readRecentModules(workspaceId);

  const workspaceManifest = workspaceData?.manifest;
  const moduleMap = useMemo(() => {
    const modules = workspaceManifest?.modules || [];
    return Object.fromEntries(modules.map((module) => [module.id, module]));
  }, [workspaceManifest]);

  const summaries = useMemo(() => artifacts ?? [], [artifacts]);

  useEffect(() => {
    function onFocusSearch() {
      searchInputRef.current?.focus();
    }

    window.addEventListener("agent-squad:focus-search", onFocusSearch);
    return () => window.removeEventListener("agent-squad:focus-search", onFocusSearch);
  }, []);

  function updateSearchParams(nextModuleFilter, nextMode) {
    const next = new URLSearchParams(searchParams);
    if (nextModuleFilter && nextModuleFilter !== "all") next.set("module", nextModuleFilter);
    else next.delete("module");
    if (nextMode && nextMode !== "all") next.set("mode", nextMode);
    else next.delete("mode");
    setSearchParams(next, { replace: true });
  }

  function updateViewPref(key, value) {
    const nextPrefs = { ...viewPrefs, [key]: value };
    setViewPrefsByWorkspace((prev) => ({ ...prev, [workspaceId]: nextPrefs }));
    setStoredPref(workspaceId, key, value);
  }

  const moduleTabs = useMemo(() => {
    const discovered = new Set();
    summaries.forEach((summary) => {
      Object.keys(summary.modules || {}).forEach((id) => discovered.add(id));
    });

    const ids = Array.from(discovered);
    return [{ id: "all", label: "All", emoji: "📦" }].concat(
      ids.map((id) => ({
        id,
        label: moduleMap[id]?.label || titleFromId(id),
        emoji: moduleMap[id]?.emoji || "📦",
      }))
    );
  }, [summaries, moduleMap]);

  const cards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const out = [];

    summaries.forEach((summary) => {
      const modules = summary.modules || {};
      const moduleMetaMap = summary.moduleMeta || {};
      Object.entries(modules).forEach(([moduleId, files]) => {
        if (moduleFilter !== "all" && moduleFilter !== moduleId) return;

        const id = `${summary.workspaceId}:${moduleId}`;
        if (mode === "recent" && !recentModules.includes(id)) return;

        const moduleDef = moduleMap[moduleId];
        const meta = moduleMetaMap[moduleId] || {};
        const fileCount = meta.fileCount ?? files.length;
        const folderCount = meta.folderCount ?? 0;
        const lastModified = meta.lastModified || null;
        const totalSize = meta.totalSize ?? 0;
        const typeBreakdown = meta.typeBreakdown || {};
        const moduleLabel = moduleDef?.label || titleFromId(moduleId);

        const searchableText = [
          summary.title,
          moduleId,
          moduleLabel,
          files.join(" "),
          Object.keys(typeBreakdown).join(" "),
          getDominantFolder(files),
        ]
          .join(" ")
          .toLowerCase();

        if (query && !searchableText.includes(query)) return;

        const topTypes = getTopTypes(typeBreakdown);
        const dominantType = topTypes[0]?.ext || "none";
        const dominantFolder = getDominantFolder(files);
        const recentTimestamp = toTimestamp(lastModified);

        out.push({
          id,
          workspaceId: summary.workspaceId,
          workspaceTitle: summary.title,
          moduleId,
          moduleLabel,
          moduleEmoji: moduleDef?.emoji || "📦",
          files,
          fileCount,
          folderCount,
          lastModified,
          recentTimestamp,
          totalSize,
          topTypes,
          dominantType,
          dominantFolder,
        });
      });
    });

    const direction = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      if (sortBy === "name") {
        return direction * `${a.moduleLabel} ${a.workspaceTitle}`.localeCompare(`${b.moduleLabel} ${b.workspaceTitle}`);
      }
      if (sortBy === "size") {
        if (a.totalSize !== b.totalSize) return direction * (a.totalSize - b.totalSize);
        return direction * (a.fileCount - b.fileCount);
      }
      if (a.recentTimestamp !== b.recentTimestamp) return direction * (a.recentTimestamp - b.recentTimestamp);
      return direction * `${a.moduleLabel} ${a.workspaceTitle}`.localeCompare(`${b.moduleLabel} ${b.workspaceTitle}`);
    });

    return out;
  }, [summaries, moduleFilter, searchQuery, mode, recentModules, moduleMap, sortBy, sortDir]);

  const groupedCards = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "Modules", cards }];

    const groups = new Map();
    cards.forEach((card) => {
      const key = groupBy === "folder" ? card.dominantFolder : card.dominantType;
      const label =
        groupBy === "folder"
          ? key === "root"
            ? "Root files"
            : `Folder: ${key}`
          : `Type: .${key}`;

      if (!groups.has(key)) groups.set(key, { key, label, cards: [] });
      groups.get(key).cards.push(card);
    });

    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [cards, groupBy]);

  const { data: fileContents } = usePolling(
    ["artifact-file", previewWorkspaceId, selectedModuleId],
    previewWorkspaceId && selectedModuleId ? `/api/artifacts/${previewWorkspaceId}/${selectedModuleId}` : null,
    { enabled: !!previewWorkspaceId && !!selectedModuleId, interval: 1000 }
  );

  function openModule(card) {
    setPreviewWorkspaceId(card.workspaceId);
    setSelectedModuleId(card.moduleId);

    const id = `${card.workspaceId}:${card.moduleId}`;
    const merged = [id].concat(recentModules.filter((item) => item !== id)).slice(0, 12);
    storage.workspaceSet(workspaceId || "all", "artifacts.recentModules", merged);
    setRecentByWorkspace((prev) => ({ ...prev, [workspaceId]: merged }));
  }

  /**
   * Handles keyboard navigation in artifact card grid
   * Grid layout: 3 columns on large screens, 2 on medium, 1 on small
   * @param {KeyboardEvent} e - Keyboard event
   * @param {number} cardIndex - Current card index in the flat array
   */
  const handleCardKeyDown = useCallback((e, cardIndex, card) => {
    const totalCards = cards.length;
    // Default to 3 columns (lg breakpoint), could be enhanced with window size detection
    const columns = 3;

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        if (cardIndex < totalCards - 1) {
          const nextIndex = cardIndex + 1;
          setFocusedCardIndex(nextIndex);
          setTimeout(() => {
            cardRefs.current[nextIndex]?.focus();
          }, 0);
        }
        break;

      case "ArrowLeft":
        e.preventDefault();
        if (cardIndex > 0) {
          const prevIndex = cardIndex - 1;
          setFocusedCardIndex(prevIndex);
          setTimeout(() => {
            cardRefs.current[prevIndex]?.focus();
          }, 0);
        }
        break;

      case "ArrowDown":
        e.preventDefault();
        const downIndex = Math.min(cardIndex + columns, totalCards - 1);
        setFocusedCardIndex(downIndex);
        setTimeout(() => {
          cardRefs.current[downIndex]?.focus();
        }, 0);
        break;

      case "ArrowUp":
        e.preventDefault();
        const upIndex = Math.max(cardIndex - columns, 0);
        setFocusedCardIndex(upIndex);
        setTimeout(() => {
          cardRefs.current[upIndex]?.focus();
        }, 0);
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        openModule(card);
        break;

      case "Home":
        e.preventDefault();
        setFocusedCardIndex(0);
        setTimeout(() => {
          cardRefs.current[0]?.focus();
        }, 0);
        break;

      case "End":
        e.preventDefault();
        const lastIndex = totalCards - 1;
        setFocusedCardIndex(lastIndex);
        setTimeout(() => {
          cardRefs.current[lastIndex]?.focus();
        }, 0);
        break;
    }
  }, [cards.length, openModule]);

  const selectedCard = cards.find((card) => card.workspaceId === previewWorkspaceId && card.moduleId === selectedModuleId);

  return (
    <div className="space-y-6">
      <PageHeader title="Artifacts" description="Browse generated outputs across all modules" />

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
        <SearchInput
          ref={searchInputRef}
          inputId="artifacts-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search modules/files/folders..."
          className="min-w-[220px] flex-1"
        />

        <button
          onClick={() => updateSearchParams(moduleFilter, mode === "recent" ? "all" : "recent")}
          className={cn(
            "rounded-md border px-2.5 py-2 text-xs",
            mode === "recent"
              ? "border-[var(--status-info)]/50 bg-[color-mix(in_srgb,var(--status-info)_12%,transparent)]"
              : "border-border text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
          )}
        >
          Recently opened
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-md border border-border bg-card p-2 md:grid-cols-3">
        <label className="flex items-center gap-2 rounded-md border border-border bg-[var(--surface-2)] px-2 py-1.5 text-xs">
          <span className="text-[var(--text-secondary)]">Group</span>
          <select
            value={groupBy}
            onChange={(event) => updateViewPref("groupBy", event.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none"
          >
            <option value="none">None</option>
            <option value="folder">Folder</option>
            <option value="type">Type</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-md border border-border bg-[var(--surface-2)] px-2 py-1.5 text-xs">
          <span className="text-[var(--text-secondary)]">Sort</span>
          <select
            value={sortBy}
            onChange={(event) => updateViewPref("sortBy", event.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none"
          >
            <option value="recent">Recent</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-md border border-border bg-[var(--surface-2)] px-2 py-1.5 text-xs">
          <span className="text-[var(--text-secondary)]">Order</span>
          <select
            value={sortDir}
            onChange={(event) => updateViewPref("sortDir", event.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-3">
        {moduleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => updateSearchParams(tab.id, mode)}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              moduleFilter === tab.id
                ? "bg-[var(--interactive-active)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] hover:text-[var(--text-primary)]"
            )}
          >
            <span className="mr-1">{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-border bg-card p-5">
              <SkeletonBlock className="mb-3 h-4 w-36" />
              <SkeletonBlock className="mb-2 h-3 w-full" />
              <SkeletonBlock className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && summaries.length === 0 ? <EmptyState preset="content" /> : null}

      {!isLoading && cards.length > 0 ? (
        <div className="space-y-5">
          {groupedCards.map((group, groupIndex) => {
            // Calculate the starting index for this group in the flat cards array
            const groupStartIndex = groupedCards
              .slice(0, groupIndex)
              .reduce((sum, g) => sum + g.cards.length, 0);

            return (
              <section key={group.key} className="space-y-3">
                {groupBy !== "none" ? <h3 className="text-sm font-semibold text-[var(--text-secondary)]">{group.label}</h3> : null}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {group.cards.map((card, groupCardIndex) => {
                    const cardIndex = groupStartIndex + groupCardIndex;
                    return (
                      <ArtifactCard
                        key={`${card.workspaceId}-${card.moduleId}`}
                        card={card}
                        onClick={() => openModule(card)}
                        onKeyDown={(e) => handleCardKeyDown(e, cardIndex, card)}
                        cardRef={(el) => {
                          if (el) {
                            cardRefs.current[cardIndex] = el;
                          }
                        }}
                        isFocused={focusedCardIndex === cardIndex}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {!isLoading && cards.length === 0 && summaries.length > 0 ? (
        <EmptyState preset="search" description="No artifact modules match the current filter." />
      ) : null}

      <ContentPreviewModal
        isOpen={!!previewWorkspaceId && !!selectedModuleId && !!fileContents}
        onClose={() => {
          setPreviewWorkspaceId(null);
          setSelectedModuleId(null);
        }}
        workspaceTitle={selectedCard?.workspaceTitle || "Workspace"}
        moduleLabel={moduleMap[selectedModuleId]?.label || titleFromId(selectedModuleId)}
        moduleEmoji={moduleMap[selectedModuleId]?.emoji || "📦"}
        files={fileContents}
      />
    </div>
  );
}

/**
 * ArtifactCard component with memoization to prevent unnecessary re-renders
 * Only re-renders when card data or file counts change
 * Supports keyboard navigation with arrow keys and Enter/Space
 */
const ArtifactCard = memo(function ArtifactCard({ card, onClick, onKeyDown, cardRef, isFocused }) {
  const lastUpdatedText = card.lastModified ? timeAgo(card.lastModified) : "No updates";

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={isFocused ? 0 : -1}
      className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-[var(--interactive-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--interactive-active)] focus:ring-offset-2 focus:ring-offset-background"
      aria-label={`Open ${card.moduleId} artifacts for ${card.workspaceTitle}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span>{card.moduleEmoji}</span>
        <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">{card.moduleLabel}</span>
      </div>
      <p className="mb-2 truncate text-sm font-medium text-[var(--text-primary)]">{card.workspaceTitle}</p>
      <p className="text-xs text-[var(--text-secondary)]">
        {card.fileCount} file{card.fileCount !== 1 ? "s" : ""} • {card.folderCount} folder{card.folderCount !== 1 ? "s" : ""}
      </p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">Updated {lastUpdatedText}</p>
      <p className="mt-2 truncate text-xs text-[var(--text-secondary)]">
        {card.topTypes.length > 0
          ? card.topTypes.map((type) => `.${type.ext} (${type.count})`).join(" • ")
          : "No typed files"}
      </p>
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if card data changes
  // Note: onKeyDown and cardRef are intentionally excluded from comparison
  // as they should remain stable across renders
  // isFocused is included because we need to re-render when focus changes (for tabIndex)
  return (
    prevProps.card.moduleId === nextProps.card.moduleId &&
    prevProps.card.workspaceTitle === nextProps.card.workspaceTitle &&
    prevProps.card.fileCount === nextProps.card.fileCount &&
    prevProps.card.folderCount === nextProps.card.folderCount &&
    prevProps.card.lastModified === nextProps.card.lastModified &&
    JSON.stringify(prevProps.card.topTypes) === JSON.stringify(nextProps.card.topTypes) &&
    prevProps.isFocused === nextProps.isFocused
  );
});
