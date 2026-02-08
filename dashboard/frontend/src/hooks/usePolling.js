import { useQuery } from "@tanstack/react-query";
import { requestJson } from "@/lib/transport";

export function usePolling(key, url, options = {}) {
  const { interval = 1000, enabled = true } = options;
  const canFetch = enabled && Boolean(url);

  return useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: async () => {
      if (!url) return null;
      return requestJson(url);
    },
    refetchInterval: interval,
    enabled: canFetch,
    staleTime: Math.floor(interval / 2),
    retry: 1,
  });
}
