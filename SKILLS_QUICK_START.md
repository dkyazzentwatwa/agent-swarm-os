# Agent Squad Skills - Quick Start Guide

## Installation Verification

Skills are installed at `~/.claude/skills/`:

```bash
ls ~/.claude/skills/
# Should show:
# agent-squad-comms/
# agent-squad-tasks/
```

## Usage from Claude Code

Skills are invoked automatically by Claude Code when working in Agent Squad workspaces. Claude will detect when skill operations are needed and use them transparently.

## Manual Testing

### Test Team Communications

```bash
cd workspaces/2026-02-07-dashboard-quality-analysis

# Post progress update
echo '{"message": "Research phase complete"}' | \
  ~/.claude/skills/agent-squad-comms/tools/post_update.py

# Post insight
echo '{"message": "Found pattern: Most issues are P2 refactoring", "category": "analysis"}' | \
  ~/.claude/skills/agent-squad-comms/tools/post_insight.py

# Post blocker
echo '{"message": "Cannot proceed - missing test data", "blockedTask": "task-005"}' | \
  ~/.claude/skills/agent-squad-comms/tools/post_blocker.py
```

**Verify:**
```bash
tail -3 ~/.claude/teams/agent-squad-team/team-feed.jsonl
```

### Test Task Management

```bash
cd workspaces/2026-02-07-dashboard-quality-analysis

# Create new task
echo '{"tasks": [{"subject": "Review findings", "description": "Cross-check all deliverables", "assignee": "validator", "lane": "validation"}]}' | \
  ~/.claude/skills/agent-squad-tasks/tools/create_tasks.py

# Start task (marks as in_progress)
echo '{"taskId": "task-001"}' | \
  ~/.claude/skills/agent-squad-tasks/tools/start_task.py

# Complete task
echo '{"taskId": "task-001", "lane": "completed"}' | \
  ~/.claude/skills/agent-squad-tasks/tools/complete_task.py

# Archive all completed tasks
echo '{}' | \
  ~/.claude/skills/agent-squad-tasks/tools/archive_completed.py
```

**Verify:**
```bash
cat workspaces/2026-02-07-dashboard-quality-analysis/tasks.json | jq '.tasks[] | {id, status, lane}'
```

## Common Workflows

### Batch Processing Mission

```python
# 1. Create batch tasks
create_tasks(
  batchId="batch-001",
  tasks=[
    {"subject": "CSV intake", "assignee": "coordinator", "lane": "intake"},
    {"subject": "Research companies", "assignee": "company-intel", "lane": "research"},
    {"subject": "Profile contacts", "assignee": "contact-profiler", "lane": "research"},
    {"subject": "Score leads", "assignee": "scorer", "lane": "analysis"},
    {"subject": "Generate recommendations", "assignee": "recommender", "lane": "synthesis"}
  ]
)

# 2. Start intake task
start_task(taskId="batch-001-001")
post_update(message="Starting Batch-001: 9 leads intake")

# 3. Work on intake...
# Complete intake
complete_task(taskId="batch-001-001", lane="completed")

# 4. Start research phase
start_task(taskId="batch-001-002")
post_update(message="Research phase: Dispatching company intel and contact profiler agents")

# 5. Dispatch parallel research agents...
# Wait for completion...
complete_task(taskId="batch-001-002", lane="completed")
post_insight(message="80% of companies have strong web presence", category="company-intel")

# 6. Continue through analysis and synthesis phases...

# 7. Archive completed work
archive_completed()
post_update(message="Batch-001 complete: 9 leads processed, 3 A-grade, 4 B-grade, 2 C-grade")
```

### Quality Audit Mission

```python
# 1. Create discovery tasks for each specialist
create_tasks(tasks=[
  {"subject": "UI Design Discovery", "assignee": "ui-specialist", "lane": "discovery"},
  {"subject": "UX Flow Discovery", "assignee": "ux-analyst", "lane": "discovery"},
  {"subject": "Code Quality Discovery", "assignee": "code-reviewer", "lane": "discovery"},
  {"subject": "Performance Discovery", "assignee": "performance-auditor", "lane": "discovery"},
  {"subject": "Architecture Discovery", "assignee": "architecture-analyst", "lane": "discovery"},
  {"subject": "Integration Discovery", "assignee": "integration-specialist", "lane": "discovery"}
])

# 2. Start first discovery task
start_task(taskId="task-001")
post_update(message="Discovery phase: 6 specialists deployed")

# 3. Dispatch parallel specialist agents...
# Wait for all specialists to complete...

# 4. Complete discovery tasks
for task_id in ["task-001", "task-002", "task-003", "task-004", "task-005", "task-006"]:
    complete_task(taskId=task_id, lane="analysis")

post_insight(message="Discovery complete: 47 components, 9 pages, 12 patterns identified")

# 5. Create synthesis task
create_tasks(tasks=[
  {"subject": "Aggregate findings into roadmap", "assignee": "synthesizer", "lane": "synthesis"}
])

start_task(taskId="task-007")
# ... perform synthesis ...
complete_task(taskId="task-007", lane="completed")

post_update(message="Audit complete: P0: 3, P1: 8, P2: 15, P3: 12 issues identified")

# 6. Archive
archive_completed()
```

## Auto-Detection

Both skills auto-detect workspace ID from current working directory:

```bash
# These are equivalent:
cd workspaces/2026-02-07-dashboard-quality-analysis
echo '{"message": "Update"}' | ~/.claude/skills/agent-squad-comms/tools/post_update.py

# Explicit workspace ID (from any directory):
echo '{"message": "Update", "workspaceId": "2026-02-07-dashboard-quality-analysis"}' | \
  ~/.claude/skills/agent-squad-comms/tools/post_update.py
```

## Integration with Dashboard

### Task Status → Dashboard State

| Task Status | Effect |
|-------------|--------|
| `pending` | Task visible in lane, agent shows as idle |
| `in_progress` | Task visible in lane, agent shows as **active** |
| `completed` | Task shows with checkmark, agent idle |

**Important:** Always call `start_task` before beginning work to prevent "idle" status.

### Team Feed Updates

Post to team feed every 2-3 major steps:
- After phase completion (discovery → analysis)
- When hitting a blocker
- When discovering an insight
- After deliverable creation

Don't over-post (every file write) - aim for meaningful updates only.

## Troubleshooting

### Workspace Not Found
```
Error: Could not auto-detect workspace ID
```

**Solution:** Either `cd` into workspace directory or provide explicit `workspaceId` parameter.

### Invalid Lane
```
Error: Invalid lane: xyz. Valid lanes: [discovery, analysis, synthesis, ...]
```

**Solution:** Check `workspace.json` for valid lane IDs in `dashboard.workflowLanes`.

### Task Not Found
```
Error: Task not found: task-999
```

**Solution:** Verify task ID exists in `tasks.json`. List tasks: `cat workspaces/*/tasks.json | jq '.tasks[].id'`

### File Lock Timeout
```
Error: Could not acquire lock on tasks.json
```

**Solution:** Another process is writing to tasks.json. Wait 5 seconds and retry.

## Next Steps

### Phase 2: Workspace Initialization
- `agent-squad:init` skill (upcoming) will replace 2011-line init script
- Create workspace from mission brief with template detection
- Auto-generate agent prompts and module structure

### Phase 3: Orchestration
- `agent-squad:batch` skill for batch processing automation
- `agent-squad:audit` skill for multi-perspective audits
- Automatic agent dispatch and phase management

### Phase 4: Dashboard Integration
- `agent-squad:summary` skill for executive summary generation
- `agent-squad:templates` skill for workspace templates
- `agent-squad:artifacts` skill for deliverable publishing

## Support

- **Documentation:** See skill README files in `~/.claude/skills/agent-squad-*/README.md`
- **Implementation:** See plan at `AGENT_SQUAD_SKILLS.md`
- **Issues:** Report at https://github.com/anthropics/claude-code/issues
