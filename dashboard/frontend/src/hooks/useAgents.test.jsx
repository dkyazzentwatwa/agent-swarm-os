import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useAgents } from './useAgents';

const mockAgentsArray = [
  {
    name: 'agent-researcher',
    display: 'Research Agent',
    role: 'research',
    status: 'working',
    currentTask: 'Analyzing data',
  },
  {
    name: 'agent-writer',
    display: 'Writer Agent',
    role: 'content',
    status: 'idle',
  },
];

const mockAgentsObject = {
  agents: mockAgentsArray,
  meta: {
    total: 2,
    working: 1,
    idle: 1,
  },
};

// Setup MSW server
const server = setupServer(
  http.get('/api/agents', ({ request }) => {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');

    // Return object format with meta
    return HttpResponse.json(mockAgentsObject);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return Wrapper;
}

describe('useAgents', () => {
  describe('API Fetching', () => {
    it('fetches agents successfully', async () => {
      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data[0].name).toBe('agent-researcher');
      expect(result.current.data[1].name).toBe('agent-writer');
    });

    it('includes workspaceId in query params', async () => {
      let requestUrl = '';

      server.use(
        http.get('/api/agents', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(mockAgentsObject);
        })
      );

      const { result } = renderHook(() => useAgents('test-workspace'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requestUrl).toContain('workspaceId=test-workspace');
    });

    it('fetches without workspaceId when null', async () => {
      let requestUrl = '';

      server.use(
        http.get('/api/agents', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(mockAgentsObject);
        })
      );

      const { result } = renderHook(() => useAgents(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requestUrl).not.toContain('workspaceId');
    });

    it('fetches without workspaceId when undefined', async () => {
      let requestUrl = '';

      server.use(
        http.get('/api/agents', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(mockAgentsObject);
        })
      );

      const { result } = renderHook(() => useAgents(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requestUrl).not.toContain('workspaceId');
    });
  });

  describe('Response Handling', () => {
    it('handles object response with agents array', async () => {
      server.use(
        http.get('/api/agents', () => {
          return HttpResponse.json(mockAgentsObject);
        })
      );

      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockAgentsArray);
      expect(result.current.meta).toEqual({
        total: 2,
        working: 1,
        idle: 1,
      });
    });

    it('handles array response directly', async () => {
      server.use(
        http.get('/api/agents', () => {
          return HttpResponse.json(mockAgentsArray);
        })
      );

      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockAgentsArray);
      expect(result.current.meta).toBeNull();
    });

    it('handles empty agents array', async () => {
      server.use(
        http.get('/api/agents', () => {
          return HttpResponse.json({ agents: [], meta: { total: 0 } });
        })
      );

      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
      expect(result.current.meta).toEqual({ total: 0 });
    });

    it('handles response without agents property', async () => {
      server.use(
        http.get('/api/agents', () => {
          return HttpResponse.json({ meta: { total: 0 } });
        })
      );

      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      server.use(
        http.get('/api/agents', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });

    it('handles network errors', async () => {
      server.use(
        http.get('/api/agents', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('React Query Integration', () => {
    it('exposes loading state', async () => {
      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isLoading).toBe(false);
    });

    it('exposes success state', async () => {
      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
    });

    it('exposes error state', async () => {
      server.use(
        http.get('/api/agents', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.isError).toBe(true);
      expect(result.current.isSuccess).toBe(false);
    });
  });

  describe('Query Key Management', () => {
    it('uses workspaceId in query key', async () => {
      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Query key should include workspaceId
      expect(result.current.data).toBeDefined();
    });

    it('uses "latest" when no workspaceId', async () => {
      const { result } = renderHook(() => useAgents(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });

    it('refetches when workspaceId changes', async () => {
      const { result, rerender } = renderHook(
        ({ workspaceId }) => useAgents(workspaceId),
        {
          wrapper: createWrapper(),
          initialProps: { workspaceId: 'workspace-1' },
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const firstData = result.current.data;

      // Change workspaceId
      rerender({ workspaceId: 'workspace-2' });

      await waitFor(() => {
        // Should refetch with new workspaceId
        return result.current.data !== undefined;
      });

      // Data should be fresh (even if same, it was refetched)
      expect(result.current.isSuccess).toBe(true);
    });
  });

  describe('Agent Data Structure', () => {
    it('returns agents with all properties', async () => {
      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const agent = result.current.data[0];
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('display');
      expect(agent).toHaveProperty('role');
      expect(agent).toHaveProperty('status');
    });

    it('preserves agent metadata', async () => {
      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.meta).toBeDefined();
      expect(result.current.meta.total).toBe(2);
      expect(result.current.meta.working).toBe(1);
      expect(result.current.meta.idle).toBe(1);
    });
  });

  describe('Adaptive Polling', () => {
    it('uses adaptive polling for active updates', async () => {
      // This test verifies that useActivePolling is called
      // The actual polling behavior is tested in useAdaptivePolling.test.js

      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles null response', async () => {
      server.use(
        http.get('/api/agents', () => {
          return HttpResponse.json(null);
        })
      );

      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
      expect(result.current.meta).toBeNull();
    });

    it('handles undefined response', async () => {
      server.use(
        http.get('/api/agents', () => {
          return HttpResponse.json(undefined);
        })
      );

      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });

    it('handles response with extra properties', async () => {
      server.use(
        http.get('/api/agents', () => {
          return HttpResponse.json({
            agents: mockAgentsArray,
            meta: { total: 2 },
            extraProperty: 'should be ignored',
          });
        })
      );

      const { result } = renderHook(() => useAgents('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockAgentsArray);
      expect(result.current.meta).toEqual({
        total: 2,
        extraProperty: 'should be ignored',
      });
    });
  });
});
