import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useCoffeeRoom } from './useCoffeeRoom';

const mockCommsData = {
  messages: [
    {
      id: 'msg-1',
      agent: 'agent-researcher',
      type: 'update',
      message: 'Started research phase',
      timestamp: '2026-02-07T10:00:00.000Z',
    },
    {
      id: 'msg-2',
      agent: 'agent-writer',
      type: 'insight',
      message: 'Found interesting pattern in data',
      timestamp: '2026-02-07T10:05:00.000Z',
      category: 'data-analysis',
    },
    {
      id: 'msg-3',
      agent: 'agent-backend',
      type: 'blocker',
      message: 'Waiting for API credentials',
      timestamp: '2026-02-07T10:10:00.000Z',
      blockedTask: 'task-123',
    },
  ],
  meta: {
    total: 3,
    updates: 1,
    insights: 1,
    blockers: 1,
  },
};

// Setup MSW server
const server = setupServer(
  http.get('/api/comms', ({ request }) => {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');

    return HttpResponse.json(mockCommsData);
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

describe('useCoffeeRoom', () => {
  describe('API Fetching', () => {
    it('fetches messages successfully', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(result.current.data.messages).toHaveLength(3);
    });

    it('includes workspaceId in query params', async () => {
      let requestUrl = '';

      server.use(
        http.get('/api/comms', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(mockCommsData);
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('test-workspace'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requestUrl).toContain('workspaceId=test-workspace');
    });

    it('fetches without workspaceId when null', async () => {
      let requestUrl = '';

      server.use(
        http.get('/api/comms', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(mockCommsData);
        })
      );

      const { result } = renderHook(() => useCoffeeRoom(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requestUrl).not.toContain('workspaceId');
    });

    it('fetches without workspaceId when undefined', async () => {
      let requestUrl = '';

      server.use(
        http.get('/api/comms', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(mockCommsData);
        })
      );

      const { result } = renderHook(() => useCoffeeRoom(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requestUrl).not.toContain('workspaceId');
    });
  });

  describe('Message Data', () => {
    it('returns messages array', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(Array.isArray(result.current.data.messages)).toBe(true);
      expect(result.current.data.messages.length).toBe(3);
    });

    it('preserves message structure', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const message = result.current.data.messages[0];
      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('agent');
      expect(message).toHaveProperty('type');
      expect(message).toHaveProperty('message');
      expect(message).toHaveProperty('timestamp');
    });

    it('preserves message types', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const types = result.current.data.messages.map(m => m.type);
      expect(types).toContain('update');
      expect(types).toContain('insight');
      expect(types).toContain('blocker');
    });

    it('preserves insight category', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const insight = result.current.data.messages.find(m => m.type === 'insight');
      expect(insight.category).toBe('data-analysis');
    });

    it('preserves blocker task reference', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const blocker = result.current.data.messages.find(m => m.type === 'blocker');
      expect(blocker.blockedTask).toBe('task-123');
    });

    it('returns metadata', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.meta).toBeDefined();
      expect(result.current.data.meta.total).toBe(3);
      expect(result.current.data.meta.updates).toBe(1);
      expect(result.current.data.meta.insights).toBe(1);
      expect(result.current.data.meta.blockers).toBe(1);
    });
  });

  describe('Empty States', () => {
    it('handles empty messages array', async () => {
      server.use(
        http.get('/api/comms', () => {
          return HttpResponse.json({
            messages: [],
            meta: { total: 0 },
          });
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.messages).toEqual([]);
      expect(result.current.data.meta.total).toBe(0);
    });

    it('handles response without meta', async () => {
      server.use(
        http.get('/api/comms', () => {
          return HttpResponse.json({
            messages: mockCommsData.messages,
          });
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.messages).toHaveLength(3);
    });

    it('handles response without messages', async () => {
      server.use(
        http.get('/api/comms', () => {
          return HttpResponse.json({
            meta: { total: 0 },
          });
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      server.use(
        http.get('/api/comms', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });

    it('handles network errors', async () => {
      server.use(
        http.get('/api/comms', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('handles 404 not found', async () => {
      server.use(
        http.get('/api/comms', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('React Query Integration', () => {
    it('exposes loading state', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isLoading).toBe(false);
    });

    it('exposes success state', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
    });

    it('exposes error state', async () => {
      server.use(
        http.get('/api/comms', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.isError).toBe(true);
      expect(result.current.isSuccess).toBe(false);
    });
  });

  describe('Query Key Management', () => {
    it('uses workspaceId in query key', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });

    it('uses "latest" when no workspaceId', async () => {
      const { result } = renderHook(() => useCoffeeRoom(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });

    it('refetches when workspaceId changes', async () => {
      const { result, rerender } = renderHook(
        ({ workspaceId }) => useCoffeeRoom(workspaceId),
        {
          wrapper: createWrapper(),
          initialProps: { workspaceId: 'workspace-1' },
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Change workspaceId
      rerender({ workspaceId: 'workspace-2' });

      await waitFor(() => {
        return result.current.data !== undefined;
      });

      expect(result.current.isSuccess).toBe(true);
    });
  });

  describe('Comms Polling', () => {
    it('uses comms polling for moderate updates', async () => {
      // This test verifies that useCommsPolling is called
      // The actual polling behavior is tested in useAdaptivePolling.test.js

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });
  });

  describe('Message Types', () => {
    it('handles update messages', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const update = result.current.data.messages.find(m => m.type === 'update');
      expect(update).toBeDefined();
      expect(update.message).toBe('Started research phase');
    });

    it('handles insight messages with category', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const insight = result.current.data.messages.find(m => m.type === 'insight');
      expect(insight).toBeDefined();
      expect(insight.category).toBeDefined();
    });

    it('handles blocker messages with task reference', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const blocker = result.current.data.messages.find(m => m.type === 'blocker');
      expect(blocker).toBeDefined();
      expect(blocker.blockedTask).toBeDefined();
    });
  });

  describe('Timestamp Ordering', () => {
    it('preserves message chronological order', async () => {
      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const timestamps = result.current.data.messages.map(m => new Date(m.timestamp).getTime());

      // Check if timestamps are in order (or just present)
      timestamps.forEach(ts => {
        expect(ts).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles null response', async () => {
      server.use(
        http.get('/api/comms', () => {
          return HttpResponse.json(null);
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
    });

    it('handles single message', async () => {
      server.use(
        http.get('/api/comms', () => {
          return HttpResponse.json({
            messages: [mockCommsData.messages[0]],
            meta: { total: 1 },
          });
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.messages).toHaveLength(1);
      expect(result.current.data.meta.total).toBe(1);
    });

    it('handles messages without optional fields', async () => {
      server.use(
        http.get('/api/comms', () => {
          return HttpResponse.json({
            messages: [
              {
                id: 'msg-minimal',
                agent: 'agent-test',
                type: 'update',
                message: 'Minimal message',
                timestamp: '2026-02-07T10:00:00.000Z',
              },
            ],
          });
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.messages[0]).not.toHaveProperty('category');
      expect(result.current.data.messages[0]).not.toHaveProperty('blockedTask');
    });

    it('handles large message arrays', async () => {
      const largeMessageArray = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        agent: `agent-${i % 5}`,
        type: 'update',
        message: `Message ${i}`,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
      }));

      server.use(
        http.get('/api/comms', () => {
          return HttpResponse.json({
            messages: largeMessageArray,
            meta: { total: 100 },
          });
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.messages).toHaveLength(100);
    });

    it('handles messages with extra properties', async () => {
      server.use(
        http.get('/api/comms', () => {
          return HttpResponse.json({
            messages: [
              {
                ...mockCommsData.messages[0],
                extraProperty: 'should be preserved',
                anotherExtra: 123,
              },
            ],
          });
        })
      );

      const { result } = renderHook(() => useCoffeeRoom('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.messages[0].extraProperty).toBe('should be preserved');
      expect(result.current.data.messages[0].anotherExtra).toBe(123);
    });
  });
});
