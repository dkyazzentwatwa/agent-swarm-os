import { useWorkspacePolling } from "./useAdaptivePolling";

function buildWorkspaceUrl(workspaceId) {
  if (!workspaceId) return "/api/workspace";
  const params = new URLSearchParams({ workspaceId });
  return `/api/workspace?${params.toString()}`;
}

/**
 * Hook for fetching workspace with adaptive polling
 * Workspace data changes infrequently, so uses slower polling (5s base, up to 30s)
 */
export function useWorkspace(workspaceId = null, options = {}) {
  const { enabled = true } = options;
  return useWorkspacePolling(["workspace", workspaceId || "latest"], buildWorkspaceUrl(workspaceId), {
    enabled,
  });
}
