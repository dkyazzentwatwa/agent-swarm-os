# Contributing to Agent Squad Dashboard

Thank you for your interest in contributing to Agent Squad Dashboard! This document provides guidelines and best practices for contributing.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Code Style Guide](#code-style-guide)
4. [Testing Guidelines](#testing-guidelines)
5. [Pull Request Process](#pull-request-process)
6. [Commit Message Conventions](#commit-message-conventions)
7. [Security Guidelines](#security-guidelines)

---

## Getting Started

### Prerequisites

- **Node.js:** 18.x or higher
- **Rust:** 1.70+ (for Tauri development)
- **Git:** For version control
- **Editor:** VS Code recommended (with ESLint, Prettier extensions)

### First-Time Setup

```bash
# Clone the repository
git clone https://github.com/your-org/agent-swarm-os.git
cd agent-swarm-os/dashboard

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

# Run tests to verify setup
npm test
```

---

## Development Setup

### Running the Development Environment

**Option 1: Full Stack (Frontend + Backend + Tauri)**
```bash
# Terminal 1: Backend server
cd backend
npm run dev

# Terminal 2: Frontend dev server
cd frontend
npm run dev

# Terminal 3: Tauri desktop app
cd frontend
npm run tauri:dev
```

**Option 2: Web Only (Frontend + Backend)**
```bash
# Terminal 1: Backend server
cd backend
npm run dev

# Terminal 2: Frontend dev server
cd frontend
npm run dev
# Open http://localhost:5173
```

### Project Structure

```
dashboard/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route-level components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility functions
│   │   ├── theme/          # Theme definitions
│   │   └── test/           # Test utilities
│   └── src-tauri/          # Rust/Tauri code
│
├── backend/                # Node.js API server
│   ├── routes/             # API route handlers
│   ├── services/           # Business logic
│   ├── middleware/         # Express middleware
│   ├── lib/                # Utility libraries
│   └── tests/              # Backend tests
│
└── docs/                   # Documentation
```

---

## Code Style Guide

### JavaScript/React

**ESLint Configuration:**
- Extends: `eslint:recommended`, `plugin:react/recommended`
- Rules: See `.eslintrc.json`

**Code Style:**
```javascript
// ✅ GOOD: Use arrow functions for components
export const TaskCard = memo(({ task, onClick }) => {
  return <div onClick={onClick}>{task.subject}</div>;
});

// ✅ GOOD: Destructure props
export function Modal({ isOpen, onClose, children }) {
  // ...
}

// ❌ BAD: Don't use class components (unless ErrorBoundary)
class MyComponent extends React.Component {
  // ...
}

// ✅ GOOD: Use custom hooks for logic
function useTaskFilters(tasks, filters) {
  return useMemo(() => {
    return tasks.filter(task => /* ... */);
  }, [tasks, filters]);
}
```

**Component Organization:**
1. Imports
2. Constants/types
3. Component definition
4. Hooks (useState, useEffect, etc.)
5. Event handlers
6. Derived state (useMemo, useCallback)
7. JSX return

### TypeScript (for new files)

```typescript
// ✅ GOOD: Use explicit types
interface Task {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
}

// ✅ GOOD: Use generics for reusable utilities
function storage.get<T>(key: string, defaultValue: T): T | null {
  // ...
}
```

### Rust (Tauri Commands)

```rust
// ✅ GOOD: Validate all inputs
#[tauri::command]
async fn run_command(command: String) -> Result<Output, CommandError> {
    let allowed = AllowedCommand::validate(&command)?;
    allowed.execute().await
}

// ❌ BAD: Never execute user input directly
#[tauri::command]
async fn run_command(command: String) -> Result<Output, CommandError> {
    Command::new("sh").arg("-c").arg(command).output().await
}
```

---

## Testing Guidelines

### Frontend Tests

**Location:** `frontend/src/**/*.test.jsx`

**Framework:** Vitest + Testing Library

**Example:**
```javascript
describe('TaskCard', () => {
  it('renders task information', () => {
    const task = { id: '1', subject: 'Test task', status: 'pending' };

    render(<TaskCard task={task} onClick={vi.fn()} />);

    expect(screen.getByText('Test task')).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    const onClick = vi.fn();
    render(<TaskCard task={{...}} onClick={onClick} />);

    const card = screen.getByRole('button');
    await userEvent.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalled();
  });
});
```

**Test Coverage Goals:**
- Components: 60%+ coverage
- Hooks: 70%+ coverage
- Utilities: 80%+ coverage

### Backend Tests

**Location:** `backend/tests/**/*.test.js`

**Framework:** Node.js built-in test runner

**Example:**
```javascript
describe('File Locking', () => {
  it('prevents race conditions', async () => {
    // Simulate 10 concurrent updates
    const updates = Array.from({ length: 10 }, () =>
      safeUpdateJSON('test.json', (data) => ({
        counter: data.counter + 1
      }), { counter: 0 })
    );

    await Promise.all(updates);

    const result = await safeReadJSON('test.json');
    assert.strictEqual(result.counter, 10);
  });
});
```

**Running Tests:**
```bash
# Frontend tests
cd frontend
npm test                    # Run all tests
npm run test:coverage       # Run with coverage

# Backend tests
cd backend
npm test                    # Run all tests
node --test tests/specific.test.js  # Run specific test
```

---

## Pull Request Process

### Before Submitting

1. **Run Tests:** Ensure all tests pass
   ```bash
   npm test
   ```

2. **Run Linter:** Fix all ESLint errors
   ```bash
   npm run lint
   ```

3. **Build:** Verify production build works
   ```bash
   npm run build
   ```

4. **Update Documentation:** If adding features or changing APIs

### PR Title Format

```
<type>(<scope>): <description>

Examples:
feat(tasks): add keyboard navigation for task cards
fix(api): prevent path traversal in file endpoints
docs(contributing): update testing guidelines
refactor(storage): migrate to TypeScript
test(hooks): add tests for useAdaptivePolling
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Scopes:**
- `tasks`, `agents`, `comms`, `artifacts`, `analytics`
- `api`, `ui`, `hooks`, `storage`, `security`
- `tauri`, `backend`, `frontend`

### PR Description Template

```markdown
## Summary
Brief description of what this PR does.

## Motivation
Why is this change needed? What problem does it solve?

## Changes
- List of key changes
- Bullet points for each significant change

## Testing
How was this tested?
- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] Tested in Tauri app

## Screenshots (if UI changes)
[Add screenshots here]

## Breaking Changes
List any breaking changes and migration steps.

## Checklist
- [ ] Tests pass
- [ ] Linter passes
- [ ] Documentation updated
- [ ] No security vulnerabilities introduced
```

### Review Process

1. **Automated Checks:** CI must pass (tests, linting, build)
2. **Code Review:** At least one approver required
3. **Security Review:** Required for security-sensitive changes
4. **Testing:** Reviewer should test manually if UI/UX changes

---

## Commit Message Conventions

### Format

```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Examples

```
feat(tasks): add drag-and-drop for task reordering

- Implement drag-and-drop using react-beautiful-dnd
- Update task order in tasks.json
- Add visual feedback during drag

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

```
fix(security): validate file paths to prevent traversal

- Add validatePathInWorkspace utility
- Apply to all file-serving routes
- Add tests for path traversal attempts

Fixes #123

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Security Guidelines

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

See [SECURITY.md](./SECURITY.md) for reporting procedures.

### Security Checklist for PRs

- [ ] No arbitrary command execution
- [ ] No path traversal vulnerabilities
- [ ] Input validation for all user inputs
- [ ] No sensitive data in logs
- [ ] No hardcoded credentials
- [ ] Rate limiting considered
- [ ] Error messages don't leak information

### Code Review Focus Areas

1. **Command Execution:** Always use allowlist
2. **File Access:** Always validate paths
3. **User Input:** Always validate and sanitize
4. **Dependencies:** Run `npm audit` before merging
5. **Logging:** No sensitive data in logs

---

## Development Workflow

### Feature Development

```bash
# 1. Create feature branch
git checkout -b feat/my-feature

# 2. Make changes
# ... code, test, commit ...

# 3. Keep branch updated
git fetch origin
git rebase origin/main

# 4. Push and create PR
git push origin feat/my-feature
# Open PR on GitHub
```

### Bug Fixes

```bash
# 1. Create fix branch
git checkout -b fix/issue-123

# 2. Write failing test
# ... add test that reproduces bug ...

# 3. Fix the bug
# ... implement fix ...

# 4. Verify test passes
npm test

# 5. Push and create PR
git push origin fix/issue-123
```

---

## Getting Help

- **Questions:** Open a GitHub Discussion
- **Bugs:** Open a GitHub Issue
- **Security:** Email security@anthropic.com
- **General:** Join our Discord/Slack

---

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity, level of experience, nationality, personal appearance, race, religion, or sexual identity.

### Our Standards

**Positive behavior:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community

**Unacceptable behavior:**
- Harassment, trolling, or derogatory comments
- Personal or political attacks
- Publishing others' private information
- Other conduct inappropriate in a professional setting

### Enforcement

Violations can be reported to: conduct@anthropic.com

---

## License

By contributing, you agree that your contributions will be licensed under the project's license.

---

## Recognition

Contributors are recognized in:
- **CONTRIBUTORS.md:** All contributors
- **Release Notes:** Notable contributions
- **Security Hall of Fame:** Security researchers

---

**Happy Contributing! 🎉**

Thank you for helping make Agent Squad Dashboard better for everyone.

---

**Document Version:** 1.0
**Last Updated:** 2026-02-08
**Maintained By:** Core Team
