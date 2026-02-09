# First Launch Workspace Directory Picker - Design

**Date:** 2026-02-08
**Status:** Approved
**Problem:** When Tauri desktop app is launched from Applications folder, it can't find the workspace directory because it relies on project structure detection
**Solution:** Prompt user to select workspace directory on first launch with persistent settings

---

## Overview

Add a first-launch configuration modal that prompts users to select their workspace directory when the app starts without valid configuration. This allows the desktop app to work independently of the project directory structure.

**Design Decisions:**
- **Simple workspace picker** - Only ask for workspace directory, not full project root
- **Block app startup** - Show modal before any app features load (prevents confusion)
- **Accept any directory** - Allow empty folders (users can create workspaces later)
- **Simple modal UI** - Brief explanation + native folder picker
- **Auto-reload on save** - Seamless transition from setup to app

---

## Architecture & Flow

### Startup Sequence

```
1. App launches
2. Rust backend loads AppConfig:
   - Check for .agentsquad.desktop-settings.json
   - Read workspacesDir setting
3. Frontend App.jsx loads:
   - Call getAppSettings() API
   - Check if effectiveConfig.workspacesDir exists and is valid
4. If workspacesDir missing or invalid:
   - Show FirstLaunchModal (blocks entire app)
   - Modal renders over root layout
5. User clicks "Browse" → calls selectDirectory()
6. User confirms selection
7. Frontend calls saveAppSettings({ workspacesDir: selected })
8. Backend saves, reloads watchers
9. Frontend reloads workspace data
10. Modal closes, app navigates to Mission Control or Setup
```

### Key Design Decisions

- **Settings storage:** Use existing `.agentsquad.desktop-settings.json` file
- **Validation:** Check if directory path exists, but allow empty directories
- **State management:** Use existing `AppSettings` system (no new data structures)
- **UI blocking:** Modal renders at root level, prevents interaction with rest of app
- **Persistence:** Settings survive app restarts

---

## Backend Changes (Rust)

**Location:** `/dashboard/frontend/src-tauri/src/main.rs`

### 1. Add Validation Helper

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

### 2. Enhance `getAppSettings` Endpoint

Add `needsConfiguration` flag to response:

```rust
json!({
    "settings": settings,
    "effectiveConfig": effective_config,
    "settingsPath": settings_path,
    "needsConfiguration": !is_workspaces_dir_valid(&settings.workspaces_dir)
})
```

### 3. Make `locate_project_root()` More Lenient

Current behavior: Searches for project markers, fails if not found

**Changes:**
- If `AGENT_SQUAD_PROJECT_ROOT` env var set, use it (already works)
- If settings file exists with `workspacesDir`, derive project root from it
- Fallback: Use current directory (for dev mode)

### 4. No Changes Needed

- `AppSettings` struct (already has `workspaces_dir: Option<String>`)
- `persist_app_settings()` (already works)
- `saveAppSettings` endpoint (already works)

---

## Frontend Changes (React)

### New Component: `FirstLaunchModal.jsx`

**Location:** `/dashboard/frontend/src/components/FirstLaunchModal.jsx`

```jsx
import { useState } from "react";
import { selectDirectory, saveAppSettings } from "@/lib/transport";

export function FirstLaunchModal({ onComplete }) {
  const [selectedPath, setSelectedPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleBrowse() {
    const path = await selectDirectory(null);
    if (path) {
      setSelectedPath(path);
      setError(null);
    }
  }

  async function handleContinue() {
    if (!selectedPath) return;
    setSaving(true);
    setError(null);
    try {
      await saveAppSettings({ workspacesDir: selectedPath });
      onComplete(); // Triggers app reload
    } catch (err) {
      setError(err.message || "Failed to save settings");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="max-w-md rounded-lg bg-[var(--surface-1)] p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Welcome to Agent Squad
        </h2>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          To get started, select where your Agent Squad workspaces are stored.
        </p>
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          Don't have workspaces yet? Choose an empty folder - you can create one later.
        </p>

        <div className="mt-4 space-y-2">
          <button
            onClick={handleBrowse}
            className="w-full rounded-md border border-border bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--interactive-hover)]"
          >
            📁 Browse for Workspace Directory
          </button>

          {selectedPath && (
            <p className="text-xs text-[var(--text-secondary)]">
              Selected: <code className="rounded bg-[var(--surface-2)] px-1">{selectedPath}</code>
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
          className="mt-4 w-full rounded-md border border-border bg-[var(--interactive-active)] px-4 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
```

### Changes to `App.jsx`

**Location:** `/dashboard/frontend/src/App.jsx`

Add configuration check on mount:

```jsx
import { FirstLaunchModal } from "@/components/FirstLaunchModal";

function App() {
  const [needsConfiguration, setNeedsConfiguration] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);

  useEffect(() => {
    async function checkConfig() {
      try {
        const settings = await getAppSettings();
        setNeedsConfiguration(settings.needsConfiguration || false);
      } catch (error) {
        console.error("Failed to load settings:", error);
        setNeedsConfiguration(true); // Assume needs config on error
      } finally {
        setCheckingConfig(false);
      }
    }
    checkConfig();
  }, []);

  if (checkingConfig) {
    return <div className="flex h-screen items-center justify-center">
      <p className="text-[var(--text-secondary)]">Loading...</p>
    </div>;
  }

  if (needsConfiguration) {
    return <FirstLaunchModal onComplete={() => window.location.reload()} />;
  }

  // Normal app render...
  return (
    <Router>
      {/* existing app structure */}
    </Router>
  );
}
```

---

## Error Handling

### Error Cases & Solutions

| Error Case | Solution |
|------------|----------|
| **User cancels folder picker** | `selectDirectory()` returns `null`, modal stays open, no error shown |
| **Selected path is invalid** | Frontend validation before save, show error: "Invalid directory" |
| **Save fails (permissions)** | Catch error, display message, keep modal open for retry |
| **Directory deleted after config** | On next startup, `needsConfiguration` is `true`, show modal again |
| **Settings file corruption** | `load_app_settings()` returns defaults, treated as unconfigured |
| **User edits settings to invalid path** | Same as directory deleted - re-prompt on next launch |

### Graceful Degradation

- If Tauri `selectDirectory()` unavailable (web mode), show text input field instead
- If save fails 3+ times, show link to Settings page with manual input option

---

## Testing Approach

### Manual Test Scenarios

**Test 1: Fresh Install (First Launch)**
- Delete `.agentsquad.desktop-settings.json` (if exists)
- Launch app
- ✓ FirstLaunchModal appears, blocks app
- Click Browse, select valid directory
- Click Continue
- ✓ Settings saved, app reloads, modal closes
- ✓ Can navigate to Mission Control/Tasks

**Test 2: Invalid Directory (Deleted After Config)**
- Configure app with valid directory
- Manually delete the workspace directory from filesystem
- Restart app
- ✓ FirstLaunchModal appears again
- Select new valid directory
- ✓ App works normally

**Test 3: Valid Configuration (Normal Startup)**
- Configure app with valid workspace directory
- Restart app
- ✓ No modal appears, app loads normally
- ✓ Workspaces display correctly

**Test 4: User Cancels Picker**
- Delete settings file
- Launch app, modal appears, click Browse
- Cancel folder picker dialog
- ✓ Modal stays open, no crash
- ✓ Can click Browse again

**Test 5: Empty vs Populated Directory**
- Test with empty directory:
  - ✓ No errors, "No workspaces" message shows
  - ✓ Can use Setup wizard to create workspace
- Test with populated directory:
  - ✓ Workspaces load and display

**Test 6: Settings Persistence**
- Configure workspace directory
- Create a workspace using Setup wizard
- Restart app multiple times
- ✓ Settings persist, same directory used each time

### Automated Testing (Optional)

- Unit tests for `is_workspaces_dir_valid()`
- Integration test: Mock `selectDirectory`, test save flow

---

## Implementation Checklist

### Backend (Rust)
- [ ] Add `is_workspaces_dir_valid()` helper function
- [ ] Update `getAppSettings` endpoint to include `needsConfiguration` flag
- [ ] Adjust `locate_project_root()` to be more lenient with settings-based paths
- [ ] Test backend validation logic

### Frontend (React)
- [ ] Create `FirstLaunchModal.jsx` component
- [ ] Update `App.jsx` to check configuration on mount
- [ ] Add error handling for save failures
- [ ] Style modal to match existing design system
- [ ] Test modal behavior (open, browse, save, close)

### Integration Testing
- [ ] Test fresh install flow
- [ ] Test invalid directory detection
- [ ] Test settings persistence across restarts
- [ ] Test error cases (cancel, permission denied, etc.)

### Documentation
- [ ] Update README with first-launch instructions
- [ ] Add screenshots of first-launch modal
- [ ] Document settings file format

---

## Success Criteria

- ✅ App works when launched from Applications folder (no project directory needed)
- ✅ Users can configure workspace directory on first launch
- ✅ Settings persist across app restarts
- ✅ Invalid/missing directories trigger re-configuration
- ✅ No errors with empty workspace directories
- ✅ Smooth UX from first launch to working app

---

## Future Enhancements (Out of Scope)

- Multi-workspace support (switch between multiple workspace directories)
- Auto-detect workspace directories (scan common locations)
- Import/export settings for team sharing
- Cloud sync for settings across devices
