import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useCoffeeRoom } from "@/hooks/useCoffeeRoom";
import { useAgents } from "@/hooks/useAgents";
import { CoffeeMessage } from "@/components/CoffeeMessage";
import { CoffeeFilters } from "@/components/CoffeeFilters";
import { Spinner } from "@/components/Spinner";
import { storage } from "@/lib/storage";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { SearchInput } from "@/components/ui/SearchInput";

function copyText(text) {
  return navigator.clipboard.writeText(text).catch(() => {
    window.prompt("Copy template:", text);
  });
}

function timeBucket(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit" });
}

export default function CoffeeRoom() {
  const { workspaceId, workspaceData } = useOutletContext();
  const { data, isLoading } = useCoffeeRoom(workspaceId);
  const { data: agents } = useAgents(workspaceId);

  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [groupBy, setGroupBy] = useState("none");
  const [, setVisitVersion] = useState(0);
  const scrollRef = useRef(null);
  const searchInputRef = useRef(null);
  const messageRefs = useRef(new Map());

  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);
  const types = workspaceData?.manifest?.comms?.types || ["update", "insight", "blocker"];

  const lastVisit = storage.workspaceGet(workspaceId || "latest", "comms.lastVisit", 0);

  useEffect(() => {
    function onFocusSearch() {
      searchInputRef.current?.focus();
    }

    window.addEventListener("agent-squad:focus-search", onFocusSearch);
    return () => window.removeEventListener("agent-squad:focus-search", onFocusSearch);
  }, []);

  const agentsById = useMemo(() => {
    const map = {};
    for (const agent of agents || []) {
      map[agent.name] = agent;
    }
    return map;
  }, [agents]);

  const filtered = useMemo(() => {
    return messages.filter((message) => {
      if (typeFilter !== "all" && message.type !== typeFilter) return false;
      if (searchQuery && !message.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [messages, searchQuery, typeFilter]);

  const firstUnreadIndex = useMemo(
    () => filtered.findIndex((message) => new Date(message.timestamp).getTime() > lastVisit),
    [filtered, lastVisit]
  );

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll]);

  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  }

  const grouped = useMemo(() => {
    if (groupBy === "none") {
      return [{ key: "all", label: "All messages", items: filtered }];
    }

    const map = new Map();
    for (const message of filtered) {
      const key =
        groupBy === "agent"
          ? message.agent || "Unknown"
          : groupBy === "type"
          ? message.type || "update"
          : timeBucket(message.timestamp);

      if (!map.has(key)) map.set(key, []);
      map.get(key).push(message);
    }

    return Array.from(map.entries()).map(([key, items]) => ({ key, label: key, items }));
  }, [filtered, groupBy]);

  const replyTemplates = [
    { id: "status", label: "Status request", text: "Status check: post your current task, ETA, and blockers." },
    { id: "blocker", label: "Blocker escalation", text: "Blocker escalation: include blocker cause, impact, and what you need to unblock." },
    { id: "summary", label: "Summary request", text: "Final summary request: post completed outputs, pending risks, and handoff notes." },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Comms" description="High-throughput team feed with unread and grouping controls" />

      <FilterBar sticky className="z-10">
        <SearchInput
          ref={searchInputRef}
          inputId="comms-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search messages..."
          className="flex-1"
        />
        <CoffeeFilters typeFilter={typeFilter} onTypeFilterChange={setTypeFilter} types={types} />
        <label className="text-sm text-[var(--text-secondary)]">
          <span className="sr-only">Group messages</span>
          <select
            value={groupBy}
            onChange={(event) => setGroupBy(event.target.value)}
            className="min-w-[9rem] rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm"
          >
            <option value="none">No grouping</option>
            <option value="agent">Group by agent</option>
            <option value="type">Group by type</option>
            <option value="time">Group by time bucket</option>
          </select>
        </label>
      </FilterBar>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
        <button
          onClick={() => {
            if (firstUnreadIndex < 0) return;
            messageRefs.current.get(firstUnreadIndex)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          disabled={firstUnreadIndex < 0}
          className="rounded-md border border-border px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Jump to first unread
        </button>
        <button
          onClick={() => {
            const now = Date.now();
            storage.workspaceSet(workspaceId || "latest", "comms.lastVisit", now);
            setVisitVersion((prev) => prev + 1);
          }}
          className="rounded-md border border-border px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
        >
          Mark all as read
        </button>
        <span className="text-xs text-[var(--text-secondary)]">
          Unread: {firstUnreadIndex < 0 ? 0 : filtered.length - firstUnreadIndex}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {replyTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => copyText(template.text)}
              className="rounded-md border border-border px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
              title={template.text}
            >
              Copy {template.label}
            </button>
          ))}
        </div>
      </div>

      <Panel
        className="min-h-[56vh]"
        bodyClassName="p-0"
        headerAction={
          !autoScroll && filtered.length > 0 ? (
            <button
              onClick={() => {
                setAutoScroll(true);
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
              }}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Scroll to latest
            </button>
          ) : null
        }
        title="Live feed"
        description={`${filtered.length} message${filtered.length !== 1 ? "s" : ""}`}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[62vh] overflow-y-auto border-t border-border p-4"
        >
          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <div className="text-center">
                <Spinner size="lg" className="mx-auto mb-3" />
                <p className="text-sm text-[var(--text-secondary)]">Loading messages...</p>
              </div>
            </div>
          ) : null}

          {!isLoading && filtered.length === 0 && messages.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <EmptyState
                icon="💬"
                title="No comms yet"
                description="Agents will post updates here once execution begins"
              />
            </div>
          ) : null}

          {!isLoading && filtered.length === 0 && messages.length > 0 ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <EmptyState preset="search" description="No messages match your search or filter" />
            </div>
          ) : null}

          {!isLoading && filtered.length > 0 ? (
            <div className="space-y-4">
              {grouped.map((group) => (
                <section key={group.key} className="space-y-1">
                  {groupBy !== "none" ? (
                    <h3 className="sticky top-0 z-10 rounded-md bg-[var(--surface-1)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)]">
                      {group.label}
                    </h3>
                  ) : null}
                  {group.items.map((message, localIndex) => {
                    const globalIndex = filtered.findIndex((item) => item === message);
                    const showAvatar = localIndex === 0 || group.items[localIndex - 1]?.agent !== message.agent;
                    const unread = new Date(message.timestamp).getTime() > lastVisit;
                    return (
                      <div
                        key={`${message.timestamp}-${globalIndex}`}
                        ref={(node) => {
                          if (node) messageRefs.current.set(globalIndex, node);
                        }}
                        className={unread ? "rounded-md border-l-2 border-[var(--status-info)] bg-[color-mix(in_srgb,var(--status-info)_8%,transparent)] pl-2" : ""}
                      >
                        <CoffeeMessage
                          message={message}
                          agentsById={agentsById}
                          showAvatar={showAvatar}
                        />
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
