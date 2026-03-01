# Agent Squad

Agent Squad runs domain-specific multi-agent missions with a manifest-driven workspace and dashboard.

## Claude Agent Teams (Required)

This project expects Claude Agent Teams to be enabled for all runs.

Use:
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude --teammate-mode in-process

Reference: https://code.claude.com/docs/en/agent-teams.md

## Workspace Conventions

All mission data is under `workspaces/`:

```text
workspaces/{YYYY-MM-DD}-{slug}/
  workspace.json
  tasks.json
  source/mission.md
  agents/*.md
  artifacts/{module-id}/
```

Use `workspace.json` as the source of truth for:

- team metadata
- groups
- agents
- modules
- workflow lanes
- comms settings

## Directory Safety

Before creating new directories or workspaces:
1. **Confirm the correct working directory** with the user
2. Default to operating within the current project structure
3. Never create workspaces outside `workspaces/` without explicit confirmation
4. Use `pwd` to verify location before spawning agents

## Ownership Rules

- Each agent owns its assigned tasks and module outputs.
- Do not rewrite another agent's deliverable unless task dependencies require it.
- Keep edits traceable and mission-focused.

## Team Comms Feed

Post updates to the team feed JSONL:

`~/.claude/teams/{teamName}/team-feed.jsonl`

**Using agent-squad:comms skill (recommended):**

```python
post_update(message="Research phase complete")
post_insight(message="Found pattern: 80% of leads lack decision-maker info", category="data-quality")
post_blocker(message="Cannot proceed - missing API credentials", blockedTask="task-003")
```

**Manual JSONL format (if skills unavailable):**

```json
{"timestamp":"ISO8601","agent":"agent-id","type":"update|insight|blocker","message":"text","workspaceId":"workspace-id"}
```

**CRITICAL: workspaceId is REQUIRED**

When multiple workspaces share the same team name, messages WITHOUT a `workspaceId` field will NOT appear in the dashboard. The dashboard filters messages to show only those belonging to the current workspace.

- ✅ CORRECT: `{"timestamp":"...", "agent":"...", "type":"update", "message":"...", "workspaceId":"2026-02-08-..."}`
- ❌ WRONG: `{"timestamp":"...", "agent":"...", "type":"update", "message":"..."}` (missing workspaceId - will be filtered out)

The `agent-squad:comms` skill automatically includes workspaceId. If posting manually, always include it.

Use:

- `update` for progress
- `insight` for reusable findings
- `blocker` for dependencies/issues
- Post frequently so the dashboard stays active (updates drive "live" status).

## Output Preferences

- When outputting specifications, reports, or analysis documents, always write them to a `.md` file unless explicitly told to display in chat.
- For multi-part deliverables, create a structured folder with an index file.
- Always confirm output file paths before writing.

## Agent Squad Skills (Recommended)

Agent Squad provides skills to automate common workflow operations. These skills handle JSONL formatting, timestamp injection, workspace detection, and file locking automatically.

### Available Skills

**agent-squad:comms** - Team feed updates
- `post_update(message)` - Post progress update
- `post_insight(message, category?)` - Share reusable finding
- `post_blocker(message, blockedTask?)` - Flag dependency or issue

**agent-squad:tasks** - Dashboard task management
- `start_task(taskId)` - Mark task as in_progress (shows as active in dashboard)
- `complete_task(taskId, lane?)` - Mark done and optionally move to new lane
- `create_tasks(tasks, batchId?)` - Bulk create tasks for batch processing
- `archive_completed()` - Move all completed tasks to archived lane

### Usage Example

```python
# Post update to team feed
post_update(message="Starting Batch-001: 9 leads intake")

# Create batch tasks
create_tasks(
  batchId="batch-001",
  tasks=[
    {"subject": "Research companies", "assignee": "company-intel", "lane": "research"},
    {"subject": "Profile contacts", "assignee": "contact-profiler", "lane": "research"},
    {"subject": "Score leads", "assignee": "lead-scorer", "lane": "analysis"}
  ]
)

# Start task (marks agent as active)
start_task(taskId="batch-001-001")

# Do work...

# Complete and move to next lane
complete_task(taskId="batch-001-001", lane="completed")
post_insight(message="80% of companies have strong web presence", category="company-intel")
```

### Auto-Detection

Both skills auto-detect workspace ID from current working directory:
- Looks for `workspaces/{id}/` pattern in path
- Checks for `workspace.json` in current/parent directories
- Falls back to explicit `workspaceId` parameter if needed

### Benefits

- **Automatic formatting**: JSONL, ISO8601 timestamps, agent ID injection, **workspaceId injection**
- **File safety**: Concurrent write protection with file locking
- **Validation**: Lane validation, task existence checks, workspace structure
- **Dashboard visibility**: Ensures messages appear in the correct workspace's Comms feed
- **Simplicity**: One-command operations vs manual JSON editing

See `SKILLS_QUICK_START.md` for detailed usage guide.

## Task Handling

- Prefer unblocked tasks assigned to your role.
- Keep `tasks.json` statuses current as work advances using `agent-squad:tasks` skill.
- Use `start_task(taskId)` when you begin work (sets `in_progress` status - shows as active in dashboard).
- Use `complete_task(taskId, lane?)` when finished (sets `completed` status - prevents idle state).
- Respect lane transitions defined in `workspace.json` (skills validate lanes automatically).

**Manual alternative:** Directly edit tasks.json with status transitions if skills unavailable.

## Mission Quality Standard

- Outputs should be complete, clear, and module-ready.
- Escalate blockers early in comms.
- Final package should be coherent across all modules.

## Agent Swarm Mode (Parallel Execution)

When executing missions with multiple independent phases, use parallel agent dispatch for maximum efficiency.

### Spawning Parallel Agents

Use the Task tool with appropriate subagent_type to dispatch multiple agents concurrently:

```javascript
// Example: Research phase with 2 independent agents
Task(subagent_type: "general-purpose",
     model: "sonnet",
     prompt: "You are the Company Intelligence Analyst...",
     description: "Research companies")

Task(subagent_type: "general-purpose",
     model: "sonnet",
     prompt: "You are the Contact Profiler...",
     description: "Profile contacts")
```

**Critical Rules:**

1. **Use Sonnet model for complex tasks** - Haiku has limited context and will fail with "Prompt is too long" when reading multiple research files
2. **Only parallelize independent work** - Research agents can run in parallel, but scoring must wait for research completion
3. **Each agent gets complete context** - Include workspace path, input file locations, output requirements, and success criteria
4. **Agents cannot see each other's output in real-time** - Only dispatch in parallel if they don't need to coordinate

### Model Selection

- **Sonnet**: Default for all agent tasks. Use when reading 5+ files or processing complex workflows
- **Haiku**: Only for simple, single-file operations with minimal context requirements
- **When in doubt**: Use Sonnet (context errors block progress)

### Error Handling

Some agents may show "failed" status with errors like `classifyHandoffIfNeeded is not defined` during cleanup, but still produce all required deliverables. Always verify:

1. Check if output files were created in expected locations
2. Read agent output files to confirm completion
3. If deliverables exist, proceed to next phase despite error status

**For agent orchestration tasks:** Gracefully handle agent cleanup errors - log them but don't let them block deliverable completion. If an agent fails with cleanup errors but produced its outputs, restart it only if deliverables are incomplete or missing.

### Agent Cleanup Error Recovery

When agents fail with cleanup errors but produce deliverables:

1. **Log the error** to team feed with type `insight`
2. **Verify deliverables** exist before marking task complete
3. **Do not restart** agents that produced output
4. **Continue workflow** - cleanup errors are non-blocking
5. **Document pattern** in progress file for session continuity

## Progress Checkpointing (Long Sessions)

For multi-phase missions or complex tasks:

1. **Create checkpoints** after each major phase completes
2. **Write progress to** `artifacts/progress/PROGRESS.md` with:
   - Completed phases
   - Current phase status
   - Remaining work
   - Blockers encountered
3. **Post to team feed** at each checkpoint
4. If session may end soon, prioritize completing current deliverable over starting new work

This enables clean session handoffs and prevents lost progress.

## Dashboard Synchronization (CRITICAL)

**ALWAYS update the current workspace's `tasks.json` dashboard throughout execution.**

### Required Dashboard Updates

1. **Before starting work**: Create tasks in `tasks.json` for the current batch/mission
2. **When agent starts**: Update task status to `"in_progress"` (drives "active" state in UI)
3. **When agent completes**: Update task status to `"completed"` (prevents idle status)
4. **After all work**: Update task lane to `"archived"` for completed items

### Dashboard Update Pattern

**Using agent-squad:tasks skill (recommended):**

```python
# Create batch tasks
create_tasks(batchId="batch-001", tasks=[...])

# Start task (sets status="in_progress", adds startedAt timestamp)
start_task(taskId="batch-001-intake")

# Complete task (sets status="completed", adds completedAt timestamp, moves to lane)
complete_task(taskId="batch-001-intake", lane="completed")

# Archive all completed tasks
archive_completed()
```

**Manual JSON editing (if skills unavailable):**

```javascript
// 1. Read current tasks.json
// 2. Add new tasks for batch
{
  "id": "batch-001-intake",
  "subject": "Batch-001: CSV intake (9 leads)",
  "description": "Parse and validate leads...",
  "status": "completed",
  "assignee": "pipeline-coordinator",
  "lane": "research",
  "createdAt": "2026-02-06T19:45:00.000Z",
  "completedAt": "2026-02-06T19:45:30.000Z"
}
// 3. Write back to tasks.json with updated statuses
```

### Summary Dashboard

At mission completion, update the workspace's summary dashboard file (defined in `workspace.json` summaryFile field):

1. **Read** `artifacts/summary/summary.md` (or configured location)
2. **Replace content** with complete batch results including:
   - Results table with qualified leads
   - Grade distribution
   - Immediate action items
   - Key insights and findings
   - Deliverables count
   - Process improvements
3. **Post to team feed** confirming summary update

This file drives the dashboard's summary view.

## Workflow Execution Pattern

**Standard mission flow (with skills):**

1. **Load Configuration** - Read workspace.json, tasks.json, mission.md, agent prompts
2. **Create Batch Tasks** - `create_tasks(batchId="batch-001", tasks=[...])`
3. **Start intake** - `start_task(taskId="batch-001-001")` + `post_update(message="Starting intake")`
4. **Dispatch Research Agents** (parallel) - Company + Contact intelligence
5. **Wait for Research Completion** - Verify all deliverables created
6. **Complete research** - `complete_task(taskId="batch-001-002")` + `post_insight(...)`
7. **Dispatch Analysis Agents** (parallel) - Scoring + Recommendations
8. **Wait for Analysis Completion** - Verify scorecards and recommendations
9. **Update Summary Dashboard** - Write final results to summary file
10. **Archive Tasks** - `archive_completed()` + `post_update(message="Batch complete")`

**Team feed cadence:** Post update every 2-3 major steps (not every file write, but every phase completion).

**Without skills (manual):** Follow same flow but manually edit tasks.json and team-feed.jsonl with proper JSONL formatting and timestamps.
