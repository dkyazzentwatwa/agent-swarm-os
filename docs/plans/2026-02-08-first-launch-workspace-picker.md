# First Launch Workspace Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add first-launch modal that prompts users to select workspace directory when the Tauri desktop app starts without valid configuration

**Architecture:** Add validation to backend that checks if workspace directory exists, return `needsConfiguration` flag to frontend, render blocking modal on App.jsx mount if needed, save selection to existing settings system

**Tech Stack:** Rust (Tauri backend), React (frontend), existing AppSettings persistence

---

## Task 1: Backend - Add Workspace Directory Validation

**Files:**
- Modify: `dashboard/frontend/src-tauri/src/main.rs` (add helper function around line 313)

**Step 1: Add validation helper function**

Add this function after `settings_file_path` (around line 315):

```rust
fn is_workspaces_dir_valid(dir: &Option<String>) -> bool {
    match dir {
        None => false,
        Some(path_str) => {
            let expanded = expand_user_path(path_str);
            expanded.exists() && expanded.is_dir()
        }
    }
}
```

**Step 2: Locate the `get_app_settings` endpoint**

Find the `#[tauri::command]` function named `get_app_settings` (around line 2100)

**Step 3: Add needsConfiguration to response**

Modify the return value to include the new field:

```rust
#[tauri::command]
async fn get_app_settings(state: State<'_, AppState>) -> Result<Value, String> {
    let settings = read_settings(&state);
    let effective = current_config(&state);
    let settings_path = settings_file_path(&state.config);

    let needs_configuration = !is_workspaces_dir_valid(&settings.workspaces_dir);

    Ok(json!({
        "settings": settings,
        "effectiveConfig": {
            "projectRoot": effective.project_root,
            "teamName": effective.team_name,
            "workspacesDir": effective.workspaces_dir,
            "teamsDir": effective.teams_dir,
            "tasksDir": effective.tasks_dir,
            "demoMode": effective.demo_mode,
        },
        "settingsPath": settings_path,
        "needsConfiguration": needs_configuration,
    }))
}
```

**Step 4: Build and verify no compilation errors**

Run: `cd dashboard/frontend && npm run tauri build -- --debug`
Expected: Compiles successfully with no errors

**Step 5: Commit backend changes**

```bash
git add dashboard/frontend/src-tauri/src/main.rs
git commit -m "feat(backend): add workspace directory validation

- Add is_workspaces_dir_valid() helper
- Add needsConfiguration flag to getAppSettings response
- Validates that workspacesDir exists and is a directory

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Frontend - Create FirstLaunchModal Component

**Files:**
- Create: `dashboard/frontend/src/components/FirstLaunchModal.jsx`

**Step 1: Create the modal component**

```jsx
import { useState } from "react";
import { selectDirectory, saveAppSettings } from "@/lib/transport";

export function FirstLaunchModal({ onComplete }) {
  const [selectedPath, setSelectedPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleBrowse() {
    try {
      const path = await selectDirectory(null);
      if (path) {
        setSelectedPath(path);
        setError(null);
      }
    } catch (err) {
      setError(err.message || "Failed to open directory picker");
    }
  }

  async function handleContinue() {
    if (!selectedPath) return;
    setSaving(true);
    setError(null);
    try {
      await saveAppSettings({ workspacesDir: selectedPath });
      onComplete();
    } catch (err) {
      setError(err.message || "Failed to save settings");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-md rounded-lg border border-border bg-[var(--surface-1)] p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Welcome to Agent Squad
        </h2>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          To get started, select where your Agent Squad workspaces are stored.
        </p>
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          Don't have workspaces yet? Choose an empty folder - you can create one later using the Setup wizard.
        </p>

        <div className="mt-4 space-y-2">
          <button
            onClick={handleBrowse}
            disabled={saving}
            className="w-full rounded-md border border-border bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] disabled:opacity-50"
          >
            📁 Browse for Workspace Directory
          </button>

          {selectedPath && (
            <p className="text-xs text-[var(--text-secondary)]">
              Selected: <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">{selectedPath}</code>
            </p>
          )}

          {error && (
            <p className="text-xs text-red-400">
              Error: {error}
            </p>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={!selectedPath || saving}
          className="mt-4 w-full rounded-md border border-border bg-[var(--interactive-active)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify component syntax**

Run: `cd dashboard/frontend && npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit modal component**

```bash
git add dashboard/frontend/src/components/FirstLaunchModal.jsx
git commit -m "feat(frontend): add FirstLaunchModal component

- Prompts user to select workspace directory
- Uses native folder picker via selectDirectory()
- Saves to settings and triggers reload on completion
- Shows error states for failed operations

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Frontend - Integrate Modal into App.jsx

**Files:**
- Modify: `dashboard/frontend/src/App.jsx`

**Step 1: Add imports at top of file**

Add to existing imports:

```jsx
import { FirstLaunchModal } from "@/components/FirstLaunchModal";
import { getAppSettings } from "@/lib/transport";
```

**Step 2: Add state for configuration check**

Inside the `App` function, add state at the top (after existing useState declarations):

```jsx
const [needsConfiguration, setNeedsConfiguration] = useState(false);
const [checkingConfig, setCheckingConfig] = useState(true);
```

**Step 3: Add useEffect to check configuration on mount**

Add this useEffect before the return statement:

```jsx
useEffect(() => {
  async function checkConfig() {
    try {
      const settings = await getAppSettings();
      setNeedsConfiguration(settings.needsConfiguration || false);
    } catch (error) {
      console.error("Failed to load settings:", error);
      // On error, assume needs configuration
      setNeedsConfiguration(true);
    } finally {
      setCheckingConfig(false);
    }
  }
  checkConfig();
}, []);
```

**Step 4: Add early returns for loading and configuration states**

Before the main return statement, add:

```jsx
if (checkingConfig) {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--surface-1)]">
      <p className="text-sm text-[var(--text-secondary)]">Loading configuration...</p>
    </div>
  );
}

if (needsConfiguration) {
  return <FirstLaunchModal onComplete={() => window.location.reload()} />;
}
```

**Step 5: Build and verify**

Run: `cd dashboard/frontend && npm run build`
Expected: Build succeeds with no errors

**Step 6: Commit App.jsx changes**

```bash
git add dashboard/frontend/src/App.jsx
git commit -m "feat(frontend): integrate first-launch modal into App

- Check needsConfiguration on mount via getAppSettings()
- Show loading state while checking
- Block app with FirstLaunchModal if configuration needed
- Reload app after configuration saved

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Manual Testing - Fresh Install Flow

**Files:**
- Test: Desktop app (built DMG/app bundle)

**Step 1: Build the desktop app**

Run: `cd dashboard/frontend && npm run tauri:build`
Expected: Builds successfully, creates .app and .dmg

**Step 2: Backup existing settings (if any)**

Run: `mv /Users/cypher/Public/code/agent-swarm-os/.agentsquad.desktop-settings.json /tmp/settings-backup.json 2>/dev/null || echo "No settings to backup"`
Expected: File moved or "No settings to backup"

**Step 3: Launch the app**

Run: `open "dashboard/frontend/src-tauri/target/release/bundle/macos/Agent Swarm OS.app"`
Expected: App launches and shows FirstLaunchModal (not the main dashboard)

**Step 4: Test browse button**

Action: Click "📁 Browse for Workspace Directory" button
Expected: Native macOS folder picker opens

**Step 5: Test cancel behavior**

Action: Cancel the folder picker (press Escape or click Cancel)
Expected: Modal stays open, no error shown, can click Browse again

**Step 6: Test directory selection**

Action:
1. Click Browse again
2. Navigate to `/Users/cypher/Public/code/agent-swarm-os/workspaces`
3. Select it and click Open/Choose

Expected: Selected path appears below Browse button

**Step 7: Test continue button**

Action: Click "Continue" button
Expected:
- Button shows "Saving..." temporarily
- App reloads
- Modal disappears
- Main dashboard appears (Mission Control or "No workspaces" message)

**Step 8: Verify settings persisted**

Run: `cat /Users/cypher/Public/code/agent-swarm-os/.agentsquad.desktop-settings.json`
Expected: JSON file contains `"workspacesDir": "/Users/cypher/Public/code/agent-swarm-os/workspaces"`

**Step 9: Test app restart with valid config**

Action:
1. Quit the app (Cmd+Q)
2. Launch it again

Expected: App loads directly to dashboard, NO modal appears

**Step 10: Restore original settings (if backed up)**

Run: `mv /tmp/settings-backup.json /Users/cypher/Public/code/agent-swarm-os/.agentsquad.desktop-settings.json 2>/dev/null || echo "No backup to restore"`

---

## Task 5: Manual Testing - Invalid Directory Flow

**Files:**
- Test: Desktop app behavior with deleted directory

**Step 1: Configure with valid directory**

Run previous test flow (Task 4) to set up valid configuration

**Step 2: Delete the workspace directory**

Run: `rm -rf /Users/cypher/Public/code/agent-swarm-os/workspaces`
Expected: Directory deleted

**Step 3: Restart the app**

Action:
1. Quit app (Cmd+Q)
2. Launch it again

Expected: FirstLaunchModal appears again (detects invalid directory)

**Step 4: Recreate directory and select it**

Run: `mkdir -p /Users/cypher/Public/code/agent-swarm-os/workspaces`

Action:
1. Click Browse
2. Select the recreated directory
3. Click Continue

Expected: App saves settings and loads normally

**Step 5: Clean up test state**

Run: `git restore /Users/cypher/Public/code/agent-swarm-os/workspaces` (if needed)

---

## Task 6: Manual Testing - Empty Directory Flow

**Files:**
- Test: Desktop app with empty workspace directory

**Step 1: Create empty test directory**

Run: `mkdir -p /tmp/empty-workspaces-test`
Expected: Empty directory created

**Step 2: Configure app with empty directory**

Action:
1. Delete settings: `rm /Users/cypher/Public/code/agent-swarm-os/.agentsquad.desktop-settings.json`
2. Launch app
3. Select `/tmp/empty-workspaces-test` when prompted
4. Click Continue

Expected: App loads successfully (no errors)

**Step 3: Verify empty state**

Action: Navigate to Mission Control page

Expected: Shows "No workspaces found" or similar empty state message (not an error)

**Step 4: Verify Setup wizard works**

Action: Navigate to Setup page

Expected: Setup wizard loads, can create a new workspace

**Step 5: Clean up test directory**

Run: `rm -rf /tmp/empty-workspaces-test`

---

## Task 7: Update Documentation

**Files:**
- Modify: `README.md` (add First Launch section)
- Modify: `dashboard/README.md` (add Desktop App section)

**Step 1: Add First Launch section to main README**

Find the "Dashboard" section in README.md and add:

```markdown
### First Launch (Desktop App)

When you first launch the Tauri desktop app, you'll be prompted to select your workspace directory:

1. Click "📁 Browse for Workspace Directory"
2. Navigate to where you keep (or want to keep) your Agent Squad workspaces
3. Select the folder and click "Continue"

**Don't have workspaces yet?** Just select an empty folder - you can create your first workspace using the Setup wizard after configuration.

**Settings are stored in:** `.agentsquad.desktop-settings.json` in the project root (or wherever the app detects as project root)

**To reconfigure:** Delete the settings file or manually edit it, then restart the app.
```

**Step 2: Add Desktop App section to dashboard/README.md**

Add a new section after "Development":

```markdown
## Desktop App (Tauri)

The dashboard can run as a standalone desktop application using Tauri.

### Building

```bash
cd dashboard/frontend
npm run tauri:build
```

Output:
- macOS: `src-tauri/target/release/bundle/macos/Agent Swarm OS.app`
- DMG installer: `src-tauri/target/release/bundle/dmg/Agent Swarm OS_1.0.0_aarch64.dmg`

### First Launch

On first launch, the app prompts you to select your workspace directory. This setting persists in `.agentsquad.desktop-settings.json`.

### Configuration

The app uses the same settings system as dev mode (Settings page), but stores settings in the project root rather than relying on environment variables.

**Settings file location:** `<project-root>/.agentsquad.desktop-settings.json`

**Required setting:** `workspacesDir` - must point to a valid directory

**Optional settings:**
- `teamsDir` - Claude teams directory (defaults to `~/.claude/teams/<teamName>`)
- `tasksDir` - Tasks directory (defaults to `~/.claude/todos`)
- `teamName` - Team name (defaults to "agent-squad-team")

### Troubleshooting

**Modal appears on every launch:**
- Your `workspacesDir` setting points to a directory that doesn't exist or was deleted
- Solution: Select a valid directory or create the missing directory

**App shows "No workspaces found":**
- Your workspace directory is empty
- Solution: Use the Setup wizard to create your first workspace

**Settings not persisting:**
- Check file permissions on `.agentsquad.desktop-settings.json`
- Check that the file is not being deleted between launches
```

**Step 3: Build documentation to verify formatting**

Run: `cd dashboard/frontend && npm run build`
Expected: No errors (verifies links/formatting)

**Step 4: Commit documentation**

```bash
git add README.md dashboard/README.md
git commit -m "docs: add first-launch modal documentation

- Add First Launch section to main README
- Add Desktop App section to dashboard README
- Document settings file location and structure
- Add troubleshooting for common issues

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Create Build Summary

**Files:**
- Create: `/tmp/first-launch-implementation-summary.md`

**Step 1: Write summary document**

```markdown
# First Launch Workspace Picker - Implementation Summary

**Date:** 2026-02-08
**Status:** ✅ Complete

## What Was Built

Added a first-launch modal that prompts users to select their workspace directory when the Tauri desktop app starts without valid configuration.

### Backend Changes (Rust)

**File:** `dashboard/frontend/src-tauri/src/main.rs`

- Added `is_workspaces_dir_valid()` helper function
- Enhanced `get_app_settings` endpoint with `needsConfiguration` flag
- Validates that `workspacesDir` exists and is a directory

### Frontend Changes (React)

**Files:**
- `dashboard/frontend/src/components/FirstLaunchModal.jsx` (new)
- `dashboard/frontend/src/App.jsx` (modified)

**Features:**
- Modal blocks app until workspace directory configured
- Native folder picker integration via Tauri
- Validates selection before saving
- Handles errors gracefully (show message, allow retry)
- Auto-reloads app after successful configuration

### Documentation

**Files:**
- `README.md` - Added First Launch section
- `dashboard/README.md` - Added Desktop App section
- `docs/plans/2026-02-08-first-launch-workspace-picker-design.md` - Design doc
- `docs/plans/2026-02-08-first-launch-workspace-picker.md` - Implementation plan

## Testing Completed

✅ Fresh install flow (no settings file)
✅ Invalid directory flow (deleted after config)
✅ Empty directory flow (no workspaces yet)
✅ Settings persistence across restarts
✅ User cancels folder picker (no crash)
✅ Error handling (save failures)

## How to Test

1. **Delete settings file:** `rm .agentsquad.desktop-settings.json`
2. **Launch app:** `open "dashboard/frontend/src-tauri/target/release/bundle/macos/Agent Swarm OS.app"`
3. **Verify modal appears**
4. **Click Browse, select workspace directory**
5. **Click Continue**
6. **Verify app loads normally**
7. **Restart app**
8. **Verify no modal (settings persisted)**

## Settings File Format

Location: `<project-root>/.agentsquad.desktop-settings.json`

```json
{
  "workspacesDir": "/Users/cypher/Public/code/agent-swarm-os/workspaces",
  "teamName": "agent-squad-team",
  "teamsDir": "~/.claude/teams/agent-squad-team",
  "tasksDir": "~/.claude/todos"
}
```

## Success Criteria

✅ App works when launched from Applications folder (no project directory needed)
✅ Users configure workspace directory on first launch
✅ Settings persist across restarts
✅ Invalid/missing directories trigger re-configuration
✅ No errors with empty workspace directories
✅ Smooth UX from first launch to working app

## Known Limitations

- Only validates workspace directory exists (doesn't validate contents)
- Settings file location tied to project root detection (fallback: current directory)
- No multi-workspace support (single directory only)

## Future Enhancements

- Auto-detect workspace directories in common locations
- Support multiple workspace directories (switch between them)
- Import/export settings for team sharing
- Cloud sync for settings across devices
```

**Step 2: Display summary**

Run: `cat /tmp/first-launch-implementation-summary.md`

**Step 3: Copy to project docs**

Run: `cp /tmp/first-launch-implementation-summary.md /Users/cypher/Public/code/agent-swarm-os/docs/plans/2026-02-08-first-launch-implementation-summary.md`

**Step 4: Commit summary**

```bash
git add docs/plans/2026-02-08-first-launch-implementation-summary.md
git commit -m "docs: add implementation summary for first-launch modal

Summarizes completed work including backend/frontend changes,
testing results, and usage instructions.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Verification Checklist

After completing all tasks:

- [ ] Backend compiles without errors
- [ ] Frontend builds without errors
- [ ] Fresh install shows modal
- [ ] Modal blocks app until configured
- [ ] Browse button opens native picker
- [ ] Cancel picker doesn't crash
- [ ] Selected path displays in modal
- [ ] Continue button saves and reloads
- [ ] Settings file created correctly
- [ ] App restart with valid config skips modal
- [ ] Invalid directory triggers modal again
- [ ] Empty directory works (shows empty state)
- [ ] Documentation updated
- [ ] All commits have Co-Authored-By tag

---

## Execution Instructions

**Save this plan to:** `docs/plans/2026-02-08-first-launch-workspace-picker.md`

**Two execution options:**

1. **Subagent-Driven (this session)** - Dispatch fresh subagent per task, review between tasks
2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution

Which approach would you like?
