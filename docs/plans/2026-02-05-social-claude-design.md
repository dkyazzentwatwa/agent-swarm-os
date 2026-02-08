# Social Claude: Multi-Platform Content Creation Agent Team

## Design Document — 2026-02-05

## Overview

A multi-platform content creation system using Claude Code Agent Teams with a real-time web dashboard. 9 specialized agents (1 lead + 5 platform + 3 supporting) transform raw ideas into platform-optimized content for YouTube, Instagram, TikTok, Threads, and Substack.

## Architecture

### Agent Team (9 agents)

**Lead:** Content Strategist — coordination only (delegate mode), breaks down ideas, creates tasks, reviews for brand consistency.

**Platform Specialists (5):**
1. YouTube Producer — scripts, descriptions, thumbnails, B-roll notes
2. Instagram Curator — feed posts, carousels, Stories
3. TikTok Creator — viral hooks, short scripts, trending audio
4. Threads Specialist — thread structure (10-15 posts), conversation starters
5. Substack Writer — long-form articles + Notes

**Supporting Specialists (3):**
1. Visual Designer — thumbnails, quote graphics, brand assets
2. SEO & Analytics Tracker — keywords, hashtags, timing
3. Content Librarian — asset management, metadata, deduplication

### Dashboard (Read-Only)

- **Frontend:** React 18 + Vite + Tailwind CSS + shadcn/ui (clean minimal)
- **Backend:** Node.js + Express + chokidar
- **Updates:** 2-second polling
- **Pages:** Mission Control, Coffee Room, Content Gallery, Analytics

### Data Flow

```
Agent Teams files (~/.claude/teams/, ~/.claude/tasks/)
         ↓ chokidar watches
Express API (localhost:3001)
         ↓ polling every 2s
React Dashboard (localhost:5173)
```

## Agent Teams API Alignment

**Native features used:**
- Team config: `~/.claude/teams/{team-name}/config.json`
- Task list: `~/.claude/tasks/{team-name}/` with dependencies + file locking
- Mailbox messaging (direct + broadcast)
- Delegate mode for lead
- CLAUDE.md auto-loaded by all teammates

**Custom additions:**
- Coffee Room: `~/.claude/teams/{team-name}/coffee-room.jsonl` (agents append via bash)
- Content folders: `~/social-claude/content/{date}-{slug}/` per-platform
- Brand config: `brand-config.md` referenced by all prompts

## Design Decisions

- **Clean minimal UI** with shadcn/ui — professional, readable
- **Tech/AI default brand** with configurable `brand-config.md`
- **Dashboard is strictly read-only** — never writes to agent files
- **Each agent owns their platform folder exclusively** — no file conflicts
- **5-6 tasks per teammate** — optimal per Agent Teams docs
- **Detailed spawn prompts** — teammates don't inherit lead conversation history
- **Coffee room is custom** — agents instructed to append JSONL after tasks

## Brand Configuration

`brand-config.md` at project root defines tone, vocabulary, target audience, content pillars, visual style. Default: Tech/AI. Swap one file to rebrand everything.

## Weekly Workflow

1. **Monday:** User provides idea → Lead creates tasks → Agents spawn
2. **Mon-Wed:** Parallel creation, agents claim tasks, post to coffee room
3. **Wed-Thu:** Cross-pollination via messages, asset sharing
4. **Thu-Fri:** Review, revisions, final packaging
5. **Friday:** Publishing schedule, archive, analytics monitoring
