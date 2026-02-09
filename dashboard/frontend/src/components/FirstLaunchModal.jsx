import { useState } from "react";
import { selectDirectory, saveAppSettings } from "@/lib/transport";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export function FirstLaunchModal({ onComplete }) {
  const [selectedPath, setSelectedPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [error, setError] = useState(null);

  const focusTrapRef = useFocusTrap(true);

  async function handleBrowse() {
    if (isPickerOpen) return;
    setIsPickerOpen(true);
    try {
      const path = await selectDirectory(null);
      if (path) {
        setSelectedPath(path);
        setError(null);
      }
    } catch (err) {
      setError(err.message || "Failed to open directory picker");
    } finally {
      setIsPickerOpen(false);
    }
  }

  async function handleContinue() {
    if (!selectedPath) return;
    setSaving(true);
    setError(null);
    try {
      await saveAppSettings({ workspacesDir: selectedPath });
      onComplete();
    } catch (err) {
      setError(err.message || "Failed to save settings");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-launch-title"
        className="max-w-md rounded-lg border border-border bg-[var(--surface-1)] p-6 shadow-xl"
      >
        <h2 id="first-launch-title" className="text-xl font-semibold text-[var(--text-primary)]">
          Welcome to Agent Squad
        </h2>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          To get started, select where your Agent Squad workspaces are stored.
        </p>
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          Don't have workspaces yet? Choose an empty folder - you can create one later using the Setup wizard.
        </p>

        <div className="mt-4 space-y-2">
          <button
            onClick={handleBrowse}
            disabled={saving || isPickerOpen}
            className="w-full rounded-md border border-border bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] disabled:opacity-50"
          >
            {isPickerOpen ? "Opening picker..." : "📁 Browse for Workspace Directory"}
          </button>

          {selectedPath && (
            <p className="text-xs text-[var(--text-secondary)]">
              Selected: <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">{selectedPath}</code>
            </p>
          )}

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-300">
                Error: {error}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={!selectedPath || saving}
          className="mt-4 w-full rounded-md border border-border bg-[var(--interactive-active)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
