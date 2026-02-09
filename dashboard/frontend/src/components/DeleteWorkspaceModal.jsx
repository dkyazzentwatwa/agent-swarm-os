import { useState } from "react";
import { Modal } from "./Modal";

export function DeleteWorkspaceModal({ workspace, onClose, onConfirm }) {
  const [confirmText, setConfirmText] = useState("");
  const [archive, setArchive] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  if (!workspace) return null;

  const workspaceId = workspace.id || workspace.workspaceId;
  const workspaceTitle = workspace.title || workspaceId;
  const isConfirmed = confirmText === workspaceId;

  async function handleDelete() {
    if (!isConfirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm(workspaceId, archive);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to delete workspace");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Delete Workspace">
      <div className="space-y-4">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-sm text-amber-300">
            ⚠️ <strong>Warning:</strong> This action cannot be undone.
          </p>
        </div>

        <div>
          <p className="text-sm text-[var(--text-secondary)]">
            You are about to delete workspace:
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">
            {workspaceTitle}
          </p>
          <p className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">
            {workspaceId}
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={archive}
              onChange={(e) => setArchive(e.target.checked)}
              className="rounded"
            />
            <span>
              Archive instead of permanent deletion
              <span className="ml-1 text-xs text-[var(--text-tertiary)]">
                (moves to .archived folder)
              </span>
            </span>
          </label>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[var(--text-secondary)]">
            Type workspace ID to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={workspaceId}
            className="mt-1 w-full rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
            autoFocus
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-300">
              Error: {error}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="rounded-md border border-red-500 bg-red-500/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : archive ? "Archive Workspace" : "Delete Permanently"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
