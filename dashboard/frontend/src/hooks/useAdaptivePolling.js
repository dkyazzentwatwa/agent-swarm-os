import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { requestJson } from "@/lib/transport";

/**
 * Adaptive polling hook that reduces request frequency when data is stable
 *
 * Strategy:
 * - Starts at baseInterval (default 2s)
 * - Backs off to 5s → 10s if data unchanged for 5+ polls
 * - Resets to baseInterval when data changes
 * - Stops polling when tab is inactive
 * - Reduces to 30s when in background
 *
 * @param {Array|string} key - React Query key
 * @param {string} url - API endpoint URL
 * @param {Object} options - Configuration options
 * @param {number} options.baseInterval - Starting interval in ms (default: 2000)
 * @param {number} options.maxInterval - Maximum interval in ms (default: 10000)
 * @param {number} options.unchangedThreshold - Polls before backing off (default: 5)
 * @param {boolean} options.enabled - Enable polling (default: true)
 * @returns {Object} React Query result
 */
export function useAdaptivePolling(key, url, options = {}) {
  const {
    baseInterval = 2000,
    maxInterval = 10000,
    unchangedThreshold = 5,
    enabled = true,
  } = options;

  const [interval, setInterval] = useState(baseInterval);
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const lastDataHashRef = useRef(null);
  const unchangedCountRef = useRef(0);

  // Page Visibility API - stop polling when tab is inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Compute effective interval based on visibility
  const effectiveInterval = isVisible ? interval : 30000; // 30s when in background
  const canFetch = enabled && Boolean(url) && isVisible;

  const query = useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: async () => {
      if (!url) return null;
      const data = await requestJson(url);

      // Calculate data hash for change detection
      const dataHash = JSON.stringify(data);

      if (dataHash === lastDataHashRef.current) {
        // Data unchanged - increment counter
        unchangedCountRef.current++;

        // Back off if data stable for threshold polls
        if (unchangedCountRef.current >= unchangedThreshold) {
          setInterval((prev) => {
            // Gradual backoff: 2s → 5s → 10s
            if (prev < 5000) return 5000;
            if (prev < maxInterval) return maxInterval;
            return prev;
          });
        }
      } else {
        // Data changed - reset to base interval
        unchangedCountRef.current = 0;
        setInterval(baseInterval);
        lastDataHashRef.current = dataHash;
      }

      return data;
    },
    refetchInterval: effectiveInterval,
    enabled: canFetch,
    staleTime: Math.floor(effectiveInterval / 2),
    retry: 1,
  });

  return query;
}

/**
 * Hook for workspace data with aggressive caching (changes infrequently)
 */
export function useWorkspacePolling(key, url, options = {}) {
  return useAdaptivePolling(key, url, {
    baseInterval: 5000, // Start slower for workspace data
    maxInterval: 30000, // Can back off to 30s
    unchangedThreshold: 3,
    ...options,
  });
}

/**
 * Hook for active data with faster updates (tasks, agents)
 */
export function useActivePolling(key, url, options = {}) {
  return useAdaptivePolling(key, url, {
    baseInterval: 2000, // Fast updates for active data
    maxInterval: 10000, // Max 10s backoff
    unchangedThreshold: 5,
    ...options,
  });
}

/**
 * Hook for comms/feed data with moderate updates
 */
export function useCommsPolling(key, url, options = {}) {
  return useAdaptivePolling(key, url, {
    baseInterval: 3000, // Moderate for comms
    maxInterval: 15000, // Can slow down more
    unchangedThreshold: 4,
    ...options,
  });
}
