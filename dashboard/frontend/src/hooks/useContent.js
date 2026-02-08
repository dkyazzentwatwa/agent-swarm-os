import { useWorkspacePolling } from "./useAdaptivePolling";

function buildArtifactsUrl(workspaceId) {
  if (!workspaceId) return "/api/artifacts";
  const params = new URLSearchParams({ workspaceId });
  return `/api/artifacts?${params.toString()}`;
}

/**
 * Hook for fetching content/artifacts with adaptive polling
 * Artifacts are generated infrequently, so uses slower polling (5s base, up to 30s)
 */
export function useContent(workspaceId = null) {
  return useWorkspacePolling(["artifacts", workspaceId || "latest"], buildArtifactsUrl(workspaceId));
}
