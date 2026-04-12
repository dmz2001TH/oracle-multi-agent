# 🧠 Oracle Multi-Agent System — Handoff Document v2

**Date**: 2026-04-12 22:37 GMT+8
**From**: OpenClaw session (xiaomi/mimo-v2-pro)
**To**: Next OpenClaw agent
**GitHub**: https://github.com/dmz2001TH/oracle-multi-agent
**Branch**: main (9 commits) — latest: `ba5c0c8`

---

## What Was Done This Session

### All 5 Phases Complete ✅

| Phase | Status | Files Modified |
|-------|--------|----------------|
| 1. CLI Commands | ✅ Done | `src/cli/index.js`, `bin/oracle`, `package.json` |
| 2. Session Handoff | ✅ Done | `src/memory/store.js`, `src/hub/server.js`, `src/cli/index.js` |
| 3. Auto-Communication | ✅ Done | `src/agents/worker.js`, `src/agents/manager.js` |
| 4. Dashboard | ✅ Done | `src/dashboard/public/index.html` (full rewrite) |
| 5. Persistence & Reliability | ✅ Done | `src/memory/store.js`, `src/hub/server.js`, `src/agents/manager.js`, `src/agents/worker.js` |

### Git History
```
ba5c0c8 feat: complete all 5 phases + learn from Soul-Brews-Studio
ca7b95b feat: add CLI commands (status, recap, fyi, rrr, standup, chat, team)
```

---

## Current Architecture (v2.0)

### CLI Commands (10 total)
```
oracle status              Hub health + stats (uptime, memory, provider)
oracle recap               Session recap + recent memories + handoffs
oracle fyi <query>         FTS5 memory search
oracle rrr [limit]         Read recent messages
oracle standup             Daily standup (team + tasks + activity)
oracle chat <agent> <msg>  Chat with running agent
oracle team spawn/status/task/chat/templates  Team management
oracle handoff             Create session handoff
oracle forward             Preview next session summary
oracle health [agent]      Per-agent health check
```

### New Database Tables (added this session)
```sql
-- Phase 2: Handoffs
handoffs(id, title, summary, from_session, to_session, context, status, created_at)

-- Phase 5: Agent State Persistence
agent_states(id, name, role, personality, conversation_history, memory_cache, message_queue, saved_at)

-- System agent registered automatically for handoff metadata
INSERT INTO agents (id, name, role, status) VALUES ('system', 'System', 'system', 'active')
```

### New API Endpoints (added this session)
```
POST /api/handoff/create          Create session handoff
GET  /api/handoff                 List handoffs
PUT  /api/handoff/:id             Update handoff status
GET  /api/handoff/summary         Generate session summary preview

GET  /api/agents/:id/health       Per-agent health check
GET  /api/agents/:id/state        Load saved agent state
POST /api/agents/:id/state        Save agent state
GET  /api/agents/states/saved     List all saved states
```

### Key Features Learned from Soul-Brews-Studio

**From arra-oracle-v3:**
- Supersede pattern (already existed)
- Threaded messages (already existed)
- Trace system (already existed)
- 22 MCP tools → we have 10 CLI commands + 30+ REST endpoints

**From maw-js:**
- Federation mesh → we have WebSocket real-time
- 48 commands, 20 API endpoints → we have 10 CLI + 30+ API
- Transport abstraction → we have process isolation

**What we do better:**
- Agent state persistence (save/restore conversation + memory)
- Watchdog auto-restart (3 retries, exponential backoff)
- Auto-handoff on graceful shutdown
- Full Kanban task board in dashboard
- 9-tab dashboard with real-time updates

---

## What Still Needs Work

### Priority 1: Real Agent Testing
- Test with actual PromptDee API calls (team spawn + auto-communication)
- Verify watchdog restart works with real crashes
- Test handoff flow end-to-end across sessions

### Priority 2: CLI Improvements
- `oracle team task` should auto-delegate to best agent
- `oracle chat` should support multi-turn conversation in terminal
- Add `oracle trace` command (create/list/chain traces)
- Add `oracle threads` command (create/list/read threads)

### Priority 3: Dashboard Polish
- Thread detail view (click thread → see messages)
- Trace chain visualization
- Memory browser with category filters
- Agent conversation history viewer

### Priority 4: Federation (learned from maw-js)
- Cross-machine communication (HMAC-SHA256 signing)
- Named peers configuration
- Federation status endpoint
- Inter-node agent messaging

### Priority 5: Rate Limit Handling
- PromptDee API: 5 credits/day limit
- Retry with backoff on 429
- Queue messages when API unavailable
- Fallback to cached responses

---

## Known Issues

1. **System agent timestamp**: Shows "20535d ago" because it uses unixepoch(0) on INSERT OR IGNORE. Fix: use unixepoch() default.

2. **Worker message polling**: Currently polls all messages, should filter by `to_agent` more efficiently.

3. **State save from child process**: Worker sends state_update messages but manager only saves to DB if the parent process receives them. Cross-process state sync needs improvement.

4. **Dashboard WebSocket**: Reconnects on disconnect but doesn't show reconnection status clearly.

---

## Environment

- **Runtime**: Node.js 18+ (ESM)
- **Server**: Express + ws (WebSocket) on port 3456
- **Database**: SQLite via better-sqlite3 (WAL mode)
- **LLM**: PromptDee API (free gpt-4o-mini) or Gemini API
- **Dashboard**: Pure HTML/CSS/JS (no framework)
- **GitHub Token**: Ask user for it each time, NEVER store in files

---

## Test Commands
```bash
cd /root/.openclaw/workspace/oracle-multi-agent
npm install
node src/hub/server.js          # Start hub
node bin/oracle status          # Check health
node bin/oracle handoff         # Create handoff
node bin/oracle forward         # Preview next session
curl http://localhost:3456/dashboard  # Open dashboard
```

---

**Next session: Pick up from Priority 1 — real agent testing.**
**Good luck, agent. 🧠**
