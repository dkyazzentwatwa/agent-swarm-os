import { useActivePolling } from "./useAdaptivePolling";

function buildAgentsUrl(workspaceId) {
  if (!workspaceId) return "/api/agents";
  const params = new URLSearchParams({ workspaceId });
  return `/api/agents?${params.toString()}`;
}

/**
 * Hook for fetching agents with adaptive polling
 * Agents change when tasks are assigned/completed, so use active polling
 */
export function useAgents(workspaceId = null) {
  const query = useActivePolling(["agents", workspaceId || "latest"], buildAgentsUrl(workspaceId));
  const payload = query.data;
  const agents = Array.isArray(payload) ? payload : payload?.agents || [];
  const meta = !Array.isArray(payload) && payload ? payload : null;

  return {
    ...query,
    data: agents,
    meta,
  };
}
