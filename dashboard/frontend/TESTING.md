# Testing Guide

## Overview

The frontend uses **Vitest** as the test runner with **Testing Library** for component testing and **MSW** (Mock Service Worker) for API mocking.

## Quick Start

```bash
# Install dependencies
npm install

# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Structure

```
frontend/src/
├── test/
│   ├── setup.js          # Global test setup
│   └── utils.jsx         # Test utilities and helpers
├── components/
│   └── ui/
│       ├── StatTile.jsx
│       └── StatTile.test.jsx   # Component tests
└── hooks/
    ├── useTasks.js
    └── useTasks.test.js        # Hook tests
```

## Writing Tests

### Component Tests

```javascript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<MyComponent onClick={handleClick} />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Hook Tests with API Mocking

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useMyHook } from './useMyHook';

// Setup MSW server
const server = setupServer(
  http.get('/api/data', () => {
    return HttpResponse.json({ data: 'test' });
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('useMyHook', () => {
  it('fetches data successfully', async () => {
    const { result } = renderHook(() => useMyHook('id-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ data: 'test' });
  });
});
```

### Using Test Utilities

```javascript
import { renderWithProviders } from '@/test/utils';

// Renders component with React Query and Router providers
const { getByText, queryClient } = renderWithProviders(
  <MyComponent />,
  { route: '/tasks' }
);
```

## Test Configuration

### vitest.config.js

- **Environment**: happy-dom (faster than jsdom)
- **Coverage**: v8 provider with 60% thresholds
- **Globals**: Vitest globals enabled (describe, it, expect)
- **Timeout**: 10 seconds per test

### Test Setup (src/test/setup.js)

Auto-mocks:
- `window.matchMedia`
- `IntersectionObserver`
- `ResizeObserver`
- `localStorage`
- `navigator.clipboard`

## Coverage Thresholds

| Metric | Threshold |
|--------|-----------|
| Lines | 60% |
| Functions | 60% |
| Branches | 60% |
| Statements | 60% |

## Best Practices

### 1. Test User Behavior, Not Implementation

**Good:**
```javascript
it('shows error message when form is invalid', async () => {
  render(<LoginForm />);
  await user.click(screen.getByRole('button', { name: /submit/i }));
  expect(screen.getByText(/email is required/i)).toBeInTheDocument();
});
```

**Bad:**
```javascript
it('sets error state to true', () => {
  const { result } = renderHook(() => useForm());
  result.current.setError(true);
  expect(result.current.hasError).toBe(true);
});
```

### 2. Use Semantic Queries

Prefer (in order):
1. `getByRole` - Most accessible
2. `getByLabelText` - For forms
3. `getByPlaceholderText` - For inputs
4. `getByText` - For content
5. `getByTestId` - Last resort

### 3. Async Testing

Always use `waitFor` for async operations:

```javascript
await waitFor(() => expect(result.current.isSuccess).toBe(true));
```

### 4. Clean Up

Tests automatically clean up after each run via `setup.js`.

### 5. Mock External Dependencies

Use MSW for API calls, `vi.fn()` for callbacks:

```javascript
const handleClick = vi.fn();
render(<Button onClick={handleClick} />);
await user.click(screen.getByRole('button'));
expect(handleClick).toHaveBeenCalled();
```

## Current Test Coverage

### Component Tests
- ✅ StatTile - Complete (20 tests)

### Hook Tests
- ✅ useTasks - Complete (9 tests)

### Target Coverage
- Components: 60%+
- Hooks: 60%+
- Overall: 60%+

## Debugging Tests

### Run specific test file
```bash
npm test StatTile.test
```

### Run tests matching pattern
```bash
npm test -- -t "renders correctly"
```

### Debug in VS Code
1. Set breakpoint in test file
2. Run "Debug: JavaScript Debug Terminal"
3. Run `npm test` in debug terminal

### View test UI
```bash
npm run test:ui
```
Opens browser with interactive test runner.

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm run test:run

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Common Issues

### Module not found errors
- Check `vitest.config.js` resolve alias matches `vite.config.js`
- Ensure imports use `@/` prefix for src files

### Tests timeout
- Increase timeout in test or config
- Check for unresolved promises
- Verify MSW handlers are correct

### Coverage not generated
- Ensure `--coverage` flag is used
- Check coverage.exclude patterns
- Verify `@vitest/coverage-v8` is installed

## Resources

- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/react)
- [MSW](https://mswjs.io/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
