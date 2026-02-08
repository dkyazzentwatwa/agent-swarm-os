import { useCommsPolling } from "./useAdaptivePolling";

function buildCommsUrl(workspaceId) {
  if (!workspaceId) return "/api/comms";
  const params = new URLSearchParams({ workspaceId });
  return `/api/comms?${params.toString()}`;
}

/**
 * Hook for fetching comms/coffee room messages with adaptive polling
 * Messages arrive at moderate frequency, so uses 3s base interval with backoff to 15s
 */
export function useCoffeeRoom(workspaceId = null) {
  return useCommsPolling(["comms", workspaceId || "latest"], buildCommsUrl(workspaceId));
}
