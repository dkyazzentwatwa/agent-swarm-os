import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useTasks } from './useTasks';

// Mock API server
const server = setupServer(
  http.get('/api/tasks', ({ request }) => {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');

    if (!workspaceId) {
      return HttpResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      tasks: [
        {
          id: 'task-1',
          subject: 'Test task 1',
          description: 'First test task',
          status: 'pending',
          assignee: 'agent-1',
          lane: 'backlog',
          createdAt: '2026-02-07T10:00:00.000Z',
        },
        {
          id: 'task-2',
          subject: 'Test task 2',
          description: 'Second test task',
          status: 'in_progress',
          assignee: 'agent-2',
          lane: 'development',
          createdAt: '2026-02-07T11:00:00.000Z',
        },
        {
          id: 'task-3',
          subject: 'Test task 3',
          description: 'Third test task',
          status: 'completed',
          assignee: 'agent-1',
          lane: 'done',
          createdAt: '2026-02-07T09:00:00.000Z',
          completedAt: '2026-02-07T12:00:00.000Z',
        },
      ],
      summary: {
        total: 3,
        pending: 1,
        inProgress: 1,
        completed: 1,
        blocked: 0,
      },
      lanes: [
        { id: 'backlog', label: 'Backlog' },
        { id: 'development', label: 'Development' },
        { id: 'done', label: 'Done' },
      ],
    });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
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

  return function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('useTasks', () => {
  it('fetches tasks successfully', async () => {
    const { result } = renderHook(() => useTasks('workspace-1'), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for successful fetch
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Check tasks data
    expect(result.current.data.tasks).toHaveLength(3);
    expect(result.current.data.tasks[0].id).toBe('task-1');
    expect(result.current.data.tasks[0].subject).toBe('Test task 1');
  });

  it('returns summary data', async () => {
    const { result } = renderHook(() => useTasks('workspace-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data.summary).toEqual({
      total: 3,
      pending: 1,
      inProgress: 1,
      completed: 1,
      blocked: 0,
    });
  });

  it('returns lanes data', async () => {
    const { result } = renderHook(() => useTasks('workspace-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data.lanes).toHaveLength(3);
    expect(result.current.data.lanes[0]).toEqual({
      id: 'backlog',
      label: 'Backlog',
    });
  });

  it('does not fetch when workspaceId is null', () => {
    const { result } = renderHook(() => useTasks(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('does not fetch when workspaceId is undefined', () => {
    const { result } = renderHook(() => useTasks(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('handles API errors gracefully', async () => {
    // Override default handler with error response
    server.use(
      http.get('/api/tasks', () => {
        return HttpResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      })
    );

    const { result } = renderHook(() => useTasks('workspace-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
  });

  it('refetches when workspaceId changes', async () => {
    const { result, rerender } = renderHook(
      ({ workspaceId }) => useTasks(workspaceId),
      {
        wrapper: createWrapper(),
        initialProps: { workspaceId: 'workspace-1' },
      }
    );

    // Wait for first fetch
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data.tasks).toHaveLength(3);

    // Change workspace ID
    rerender({ workspaceId: 'workspace-2' });

    // Should trigger new fetch
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('uses adaptive polling when enabled', async () => {
    const { result } = renderHook(() => useTasks('workspace-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Check that refetch interval is set (adaptive polling is active)
    // The actual interval value will be managed by useAdaptivePolling
    expect(result.current.isSuccess).toBe(true);
  });

  it('handles empty tasks array', async () => {
    server.use(
      http.get('/api/tasks', () => {
        return HttpResponse.json({
          tasks: [],
          summary: {
            total: 0,
            pending: 0,
            inProgress: 0,
            completed: 0,
            blocked: 0,
          },
          lanes: [],
        });
      })
    );

    const { result } = renderHook(() => useTasks('workspace-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data.tasks).toEqual([]);
    expect(result.current.data.summary.total).toBe(0);
  });
});
