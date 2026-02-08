import { useActivePolling } from "./useAdaptivePolling";

function buildTasksUrl(workspaceId) {
  if (!workspaceId) return "/api/tasks";
  const params = new URLSearchParams({ workspaceId });
  return `/api/tasks?${params.toString()}`;
}

/**
 * Hook for fetching tasks with adaptive polling
 * Uses aggressive polling (2s base) since tasks change frequently during active work
 */
export function useTasks(workspaceId = null) {
  return useActivePolling(["tasks", workspaceId || "latest"], buildTasksUrl(workspaceId));
}
