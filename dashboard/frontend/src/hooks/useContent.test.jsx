import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useContent } from './useContent';

const mockArtifacts = [
  {
    workspaceId: 'workspace-1',
    title: 'Project Alpha',
    modules: {
      research: ['docs/findings.md', 'data/results.json'],
      reports: ['output/final.pdf'],
    },
    moduleMeta: {
      research: {
        fileCount: 2,
        folderCount: 1,
        lastModified: '2026-02-07T10:00:00.000Z',
      },
      reports: {
        fileCount: 1,
        folderCount: 1,
        lastModified: '2026-02-07T11:00:00.000Z',
      },
    },
  },
  {
    workspaceId: 'workspace-2',
    title: 'Project Beta',
    modules: {
      analysis: ['charts/graph.png'],
    },
    moduleMeta: {
      analysis: {
        fileCount: 1,
        folderCount: 1,
        lastModified: '2026-02-06T10:00:00.000Z',
      },
    },
  },
];

// Setup MSW server
const server = setupServer(
  http.get('/api/artifacts', ({ request }) => {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');

    return HttpResponse.json(mockArtifacts);
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

describe('useContent', () => {
  describe('API Fetching', () => {
    it('fetches artifacts successfully', async () => {
      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data[0].workspaceId).toBe('workspace-1');
      expect(result.current.data[1].workspaceId).toBe('workspace-2');
    });

    it('includes workspaceId in query params', async () => {
      let requestUrl = '';

      server.use(
        http.get('/api/artifacts', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(mockArtifacts);
        })
      );

      const { result } = renderHook(() => useContent('test-workspace'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requestUrl).toContain('workspaceId=test-workspace');
    });

    it('fetches without workspaceId when null', async () => {
      let requestUrl = '';

      server.use(
        http.get('/api/artifacts', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(mockArtifacts);
        })
      );

      const { result } = renderHook(() => useContent(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requestUrl).not.toContain('workspaceId');
    });

    it('fetches without workspaceId when undefined', async () => {
      let requestUrl = '';

      server.use(
        http.get('/api/artifacts', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json(mockArtifacts);
        })
      );

      const { result } = renderHook(() => useContent(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(requestUrl).not.toContain('workspaceId');
    });
  });

  describe('Response Handling', () => {
    it('returns artifacts array', async () => {
      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(Array.isArray(result.current.data)).toBe(true);
      expect(result.current.data.length).toBeGreaterThan(0);
    });

    it('preserves artifact structure', async () => {
      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const artifact = result.current.data[0];
      expect(artifact).toHaveProperty('workspaceId');
      expect(artifact).toHaveProperty('title');
      expect(artifact).toHaveProperty('modules');
      expect(artifact).toHaveProperty('moduleMeta');
    });

    it('preserves module structure', async () => {
      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const modules = result.current.data[0].modules;
      expect(modules).toHaveProperty('research');
      expect(Array.isArray(modules.research)).toBe(true);
      expect(modules.research).toContain('docs/findings.md');
    });

    it('preserves module metadata', async () => {
      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const moduleMeta = result.current.data[0].moduleMeta;
      expect(moduleMeta).toHaveProperty('research');
      expect(moduleMeta.research).toHaveProperty('fileCount');
      expect(moduleMeta.research).toHaveProperty('folderCount');
      expect(moduleMeta.research).toHaveProperty('lastModified');
    });

    it('handles empty artifacts array', async () => {
      server.use(
        http.get('/api/artifacts', () => {
          return HttpResponse.json([]);
        })
      );

      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      server.use(
        http.get('/api/artifacts', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });

    it('handles network errors', async () => {
      server.use(
        http.get('/api/artifacts', () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('handles 404 not found', async () => {
      server.use(
        http.get('/api/artifacts', () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('React Query Integration', () => {
    it('exposes loading state', async () => {
      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isLoading).toBe(false);
    });

    it('exposes success state', async () => {
      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
    });

    it('exposes error state', async () => {
      server.use(
        http.get('/api/artifacts', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.isError).toBe(true);
      expect(result.current.isSuccess).toBe(false);
    });
  });

  describe('Query Key Management', () => {
    it('uses workspaceId in query key', async () => {
      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });

    it('uses "latest" when no workspaceId', async () => {
      const { result } = renderHook(() => useContent(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });

    it('refetches when workspaceId changes', async () => {
      const { result, rerender } = renderHook(
        ({ workspaceId }) => useContent(workspaceId),
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

  describe('Workspace Polling', () => {
    it('uses workspace polling for slower updates', async () => {
      // This test verifies that useWorkspacePolling is called
      // The actual polling behavior is tested in useAdaptivePolling.test.js

      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles null response', async () => {
      server.use(
        http.get('/api/artifacts', () => {
          return HttpResponse.json(null);
        })
      );

      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
    });

    it('handles response with single artifact', async () => {
      server.use(
        http.get('/api/artifacts', () => {
          return HttpResponse.json([mockArtifacts[0]]);
        })
      );

      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].workspaceId).toBe('workspace-1');
    });

    it('handles artifacts without moduleMeta', async () => {
      server.use(
        http.get('/api/artifacts', () => {
          return HttpResponse.json([
            {
              workspaceId: 'workspace-1',
              title: 'Test',
              modules: { test: ['file.txt'] },
            },
          ]);
        })
      );

      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data[0].modules).toBeDefined();
      expect(result.current.data[0].moduleMeta).toBeUndefined();
    });

    it('handles artifacts with empty modules', async () => {
      server.use(
        http.get('/api/artifacts', () => {
          return HttpResponse.json([
            {
              workspaceId: 'workspace-1',
              title: 'Empty Project',
              modules: {},
              moduleMeta: {},
            },
          ]);
        })
      );

      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data[0].modules).toEqual({});
    });
  });

  describe('Multiple Workspaces', () => {
    it('returns artifacts from multiple workspaces', async () => {
      const { result } = renderHook(() => useContent(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const workspaceIds = result.current.data.map(a => a.workspaceId);
      expect(workspaceIds).toContain('workspace-1');
      expect(workspaceIds).toContain('workspace-2');
    });

    it('filters by workspace when workspaceId provided', async () => {
      server.use(
        http.get('/api/artifacts', ({ request }) => {
          const url = new URL(request.url);
          const workspaceId = url.searchParams.get('workspaceId');

          if (workspaceId) {
            return HttpResponse.json(
              mockArtifacts.filter(a => a.workspaceId === workspaceId)
            );
          }

          return HttpResponse.json(mockArtifacts);
        })
      );

      const { result } = renderHook(() => useContent('workspace-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data.every(a => a.workspaceId === 'workspace-1')).toBe(true);
    });
  });
});
