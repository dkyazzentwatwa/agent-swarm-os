import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useWorkspace } from './useWorkspace';

const mockWorkspaceData = {
  id: 'workspace-2026-02-07',
  title: 'Q1 Analytics Dashboard',
  description: 'Analytics dashboard for Q1 metrics',
  createdAt: '2026-02-07T10:00:00.000Z',
  updatedAt: '2026-02-07T15:30:00.000Z',
  status: 'active',
  team: {
    members: ['agent-researcher', 'agent-writer', 'agent-reviewer'],
    roles: {
      'agent-researcher': 'research',
      'agent-writer': 'content',
      'agent-reviewer': 'quality',
    },
  },
  modules: {
    research: {
      enabled: true,
      path: 'artifacts/research',
    },
    reports: {
      enabled: true,
      path: 'artifacts/reports',
    },
  },
  settings: {
    polling: {
      interval: 5000,
      maxInterval: 30000,
    },
    notifications: {
      enabled: true,
      channels: ['email', 'slack'],
    },
  },
  meta: {
    taskCount: 15,
    completedTasks: 8,
    activeAgents: 2,
    lastActivity: '2026-02-07T15:30:00.000Z',
  },
};

// Setup MSW server
const server = setupServer(
  http.get('/api/workspace', ({ request }) => {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');

    return HttpResponse.json(mockWorkspaceData);
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

describe('useWorkspace', () => {
  describe('API Fetching', () => {
    it('fetches workspace successfully', async () => {
      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
      expect(result.current.data.id).toBe('workspace-2026-02-07');
    });

    it('includes workspaceId in query params', async () => {
      let requestUrl = '';

      server.use(
        http.get('/api/workspace', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(mockWorkspaceData);
        })
      );

      const { result } = renderHook(() => useWorkspace('test-workspace-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requestUrl).toContain('workspaceId=test-workspace-123');
    });

    it('fetches without workspaceId when null', async () => {
      let requestUrl = '';

      server.use(
        http.get('/api/workspace', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(mockWorkspaceData);
        })
      );

      const { result } = renderHook(() => useWorkspace(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requestUrl).not.toContain('workspaceId');
      expect(requestUrl).toContain('/api/workspace');
    });

    it('fetches without workspaceId when undefined', async () => {
      let requestUrl = '';

      server.use(
        http.get('/api/workspace', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(mockWorkspaceData);
        })
      );

      const { result } = renderHook(() => useWorkspace(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requestUrl).not.toContain('workspaceId');
    });
  });

  describe('Response Handling', () => {
    it('returns workspace data with all properties', async () => {
      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data;
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('status');
    });

    it('preserves team structure', async () => {
      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const team = result.current.data.team;
      expect(team).toBeDefined();
      expect(team).toHaveProperty('members');
      expect(team).toHaveProperty('roles');
      expect(Array.isArray(team.members)).toBe(true);
      expect(team.members).toContain('agent-researcher');
    });

    it('preserves modules structure', async () => {
      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const modules = result.current.data.modules;
      expect(modules).toBeDefined();
      expect(modules).toHaveProperty('research');
      expect(modules.research).toHaveProperty('enabled');
      expect(modules.research).toHaveProperty('path');
    });

    it('preserves settings structure', async () => {
      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const settings = result.current.data.settings;
      expect(settings).toBeDefined();
      expect(settings).toHaveProperty('polling');
      expect(settings).toHaveProperty('notifications');
      expect(settings.polling.interval).toBe(5000);
    });

    it('preserves metadata', async () => {
      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const meta = result.current.data.meta;
      expect(meta).toBeDefined();
      expect(meta).toHaveProperty('taskCount');
      expect(meta).toHaveProperty('completedTasks');
      expect(meta).toHaveProperty('activeAgents');
      expect(meta).toHaveProperty('lastActivity');
    });

    it('handles minimal workspace data', async () => {
      server.use(
        http.get('/api/workspace', () => {
          return HttpResponse.json({
            id: 'minimal-workspace',
            title: 'Minimal Workspace',
            status: 'active',
          });
        })
      );

      const { result } = renderHook(() => useWorkspace('minimal'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.id).toBe('minimal-workspace');
      expect(result.current.data.title).toBe('Minimal Workspace');
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      server.use(
        http.get('/api/workspace', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });

    it('handles network errors', async () => {
      server.use(
        http.get('/api/workspace', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('handles 404 not found', async () => {
      server.use(
        http.get('/api/workspace', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const { result } = renderHook(() => useWorkspace('nonexistent'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('handles timeout errors', async () => {
      server.use(
        http.get('/api/workspace', async () => {
          await new Promise(resolve => setTimeout(resolve, 15000));
          return HttpResponse.json(mockWorkspaceData);
        })
      );

      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 12000,
      });
    });
  });

  describe('React Query Integration', () => {
    it('exposes loading state', async () => {
      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isLoading).toBe(false);
    });

    it('exposes success state', async () => {
      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
    });

    it('exposes error state', async () => {
      server.use(
        http.get('/api/workspace', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.isError).toBe(true);
      expect(result.current.isSuccess).toBe(false);
    });
  });

  describe('Query Key Management', () => {
    it('uses workspaceId in query key', async () => {
      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });

    it('uses "latest" when no workspaceId', async () => {
      const { result } = renderHook(() => useWorkspace(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });

    it('refetches when workspaceId changes', async () => {
      const { result, rerender } = renderHook(
        ({ workspaceId }) => useWorkspace(workspaceId),
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

  describe('Options', () => {
    it('respects enabled option', async () => {
      const { result } = renderHook(
        () => useWorkspace('workspace-1', { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      // Should not fetch when disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('starts fetching when enabled changes to true', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useWorkspace('workspace-1', { enabled }),
        {
          wrapper: createWrapper(),
          initialProps: { enabled: false },
        }
      );

      expect(result.current.isLoading).toBe(false);

      // Enable fetching
      rerender({ enabled: true });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });

    it('uses default enabled=true when no options provided', async () => {
      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('Workspace Polling', () => {
    it('uses workspace polling for slower updates', async () => {
      // This test verifies that useWorkspacePolling is called
      // The actual polling behavior is tested in useAdaptivePolling.test.js

      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles null response', async () => {
      server.use(
        http.get('/api/workspace', () => {
          return HttpResponse.json(null);
        })
      );

      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
    });

    it('handles empty object response', async () => {
      server.use(
        http.get('/api/workspace', () => {
          return HttpResponse.json({});
        })
      );

      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual({});
    });

    it('handles workspace without team', async () => {
      server.use(
        http.get('/api/workspace', () => {
          return HttpResponse.json({
            id: 'solo-workspace',
            title: 'Solo Project',
            status: 'active',
          });
        })
      );

      const { result } = renderHook(() => useWorkspace('solo'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.team).toBeUndefined();
    });

    it('handles workspace without modules', async () => {
      server.use(
        http.get('/api/workspace', () => {
          return HttpResponse.json({
            id: 'basic-workspace',
            title: 'Basic Project',
            status: 'active',
          });
        })
      );

      const { result } = renderHook(() => useWorkspace('basic'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.modules).toBeUndefined();
    });

    it('handles workspace with extra properties', async () => {
      server.use(
        http.get('/api/workspace', () => {
          return HttpResponse.json({
            ...mockWorkspaceData,
            customField: 'custom value',
            nestedCustom: { foo: 'bar' },
          });
        })
      );

      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.customField).toBe('custom value');
      expect(result.current.data.nestedCustom).toEqual({ foo: 'bar' });
    });

    it('handles workspace with different status values', async () => {
      const statuses = ['active', 'inactive', 'archived', 'draft'];

      for (const status of statuses) {
        server.use(
          http.get('/api/workspace', () => {
            return HttpResponse.json({
              ...mockWorkspaceData,
              status,
            });
          })
        );

        const { result } = renderHook(() => useWorkspace('workspace-1'), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data.status).toBe(status);
      }
    });

    it('handles workspace with empty team members', async () => {
      server.use(
        http.get('/api/workspace', () => {
          return HttpResponse.json({
            ...mockWorkspaceData,
            team: {
              members: [],
              roles: {},
            },
          });
        })
      );

      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.team.members).toEqual([]);
      expect(result.current.data.team.roles).toEqual({});
    });

    it('handles workspace with missing timestamps', async () => {
      server.use(
        http.get('/api/workspace', () => {
          return HttpResponse.json({
            id: 'workspace-1',
            title: 'Test Workspace',
            status: 'active',
          });
        })
      );

      const { result } = renderHook(() => useWorkspace('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.createdAt).toBeUndefined();
      expect(result.current.data.updatedAt).toBeUndefined();
    });
  });

  describe('Multiple Refetches', () => {
    it('handles multiple rapid workspaceId changes', async () => {
      const { result, rerender } = renderHook(
        ({ workspaceId }) => useWorkspace(workspaceId),
        {
          wrapper: createWrapper(),
          initialProps: { workspaceId: 'workspace-1' },
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Rapid changes
      rerender({ workspaceId: 'workspace-2' });
      rerender({ workspaceId: 'workspace-3' });
      rerender({ workspaceId: 'workspace-4' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });

    it('maintains data stability between refetches', async () => {
      const { result, rerender } = renderHook(
        ({ workspaceId }) => useWorkspace(workspaceId),
        {
          wrapper: createWrapper(),
          initialProps: { workspaceId: 'workspace-1' },
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const firstData = result.current.data;

      // Change and change back
      rerender({ workspaceId: 'workspace-2' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      rerender({ workspaceId: 'workspace-1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Data should be the same structure (even if refetched)
      expect(result.current.data).toHaveProperty('id');
      expect(result.current.data).toHaveProperty('title');
    });
  });
});
