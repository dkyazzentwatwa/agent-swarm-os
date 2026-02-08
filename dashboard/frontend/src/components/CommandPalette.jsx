import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/Modal";

function scoreCommand(command, query) {
  if (!query) return 0;
  const haystack = [command.label, command.group, ...(command.keywords || [])].join(" ").toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (haystack.startsWith(q)) return 100;
  if (haystack.includes(q)) return 50;

  let score = 0;
  let cursor = 0;
  for (const ch of q) {
    const idx = haystack.indexOf(ch, cursor);
    if (idx === -1) return -1;
    score += 2;
    if (idx === cursor) score += 1;
    cursor = idx + 1;
  }
  return score;
}

export function CommandPalette({ isOpen, onClose, commands, onRun }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const ranked = commands
      .map((command) => ({ command, score: scoreCommand(command, query) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label))
      .map((entry) => entry.command);
    return ranked;
  }, [commands, query]);

  const safeActiveIndex = filtered.length > 0
    ? Math.min(activeIndex, filtered.length - 1)
    : 0;

  function runAt(index) {
    const command = filtered[index];
    if (!command || command.disabled) return;
    onRun?.(command);
    onClose?.();
  }

  function handleInputKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      runAt(safeActiveIndex);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Command Palette" subtitle="Jump anywhere and run actions" size="lg">
      <div className="space-y-3 p-4">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search commands..."
          aria-label="Search commands"
          aria-describedby="command-palette-help"
          aria-controls="command-palette-list"
          className="w-full rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm"
        />
        <div
          id="command-palette-list"
          role="listbox"
          aria-label="Commands"
          className="max-h-[50vh] overflow-y-auto rounded-md border border-border"
        >
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-[var(--text-secondary)]" role="status">
              No commands found.
            </p>
          ) : (
            filtered.map((command, index) => {
              const active = index === safeActiveIndex;
              return (
                <button
                  key={command.id}
                  role="option"
                  aria-selected={active}
                  onClick={() => runAt(index)}
                  disabled={command.disabled}
                  className={`flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-sm last:border-b-0 ${
                    active ? "bg-[var(--interactive-active)]" : "hover:bg-[var(--interactive-hover)]"
                  } ${command.disabled ? "opacity-50" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[var(--text-primary)]">{command.label}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{command.group}</span>
                  </span>
                  {command.shortcut ? (
                    <kbd className="rounded bg-[var(--surface-3)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                      {command.shortcut}
                    </kbd>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
        <p id="command-palette-help" className="text-xs text-[var(--text-secondary)]">
          Use ↑/↓ to navigate, Enter to run, Esc to close.
        </p>
      </div>
    </Modal>
  );
}
