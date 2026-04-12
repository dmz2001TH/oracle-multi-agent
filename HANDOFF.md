# 🧠 Oracle Multi-Agent System — Handoff Document

**Date**: 2026-04-12 21:38 GMT+8
**From**: OpenClaw session (xiaomi/mimo-v2-pro)
**To**: Next OpenClaw agent (mimo claw)
**GitHub**: https://github.com/dmz2001TH/oracle-multi-agent
**Branch**: main (7 commits)

---

## Project Summary

Multi-Agent AI system inspired by Oracle (Soul-Brews-Studio). Agents can:
- Talk to each other (Manager → Coder delegation)
- Remember things (SQLite FTS5 persistent memory)
- Work as teams (Manager + Coder + Researcher)
- Use free AI API (promptdee.net — gpt-4o-mini, no API key needed)

---

## Current State

### What Works (tested E2E with real AI):
- ✅ Hub server (Express + WebSocket, port 3456)
- ✅ Agent spawning (fork per agent process)
- ✅ Agent chat (PromptDee API)
- ✅ Agent-to-agent communication (Manager uses tell() to delegate to Coder)
- ✅ Memory system (SQLite FTS5, search, supersede pattern)
- ✅ Threaded messages (Oracle forum pattern)
- ✅ Trace system (discovery sessions)
- ✅ Analytics logging (search_log, learn_log, access_log)
- ✅ Task queue
- ✅ Team orchestrator (spawn team, broadcast task)
- ✅ Web dashboard (OLED dark mode, real-time WebSocket)
- ✅ Security headers + CORS validation
- ✅ Graceful shutdown

### What Needs Work:
- ❌ CLI commands (recap, fyi, rrr, standup)
- ❌ Session handoff / auto-summary
- ❌ Agent auto-communication (currently manual)
- ❌ Dashboard threads/traces/tasks views
- ❌ Persistent sessions (restore on restart)
- ❌ Auto-restart crashed agents
- ❌ Better agent prompts (currently very short)
- ❌ Rate limit handling for PromptDee API

---

## Architecture

```
oracle-multi-agent/
├── src/
│   ├── hub/
│   │   ├── index.js          # Entry point
│   │   ├── server.js         # Express + WebSocket + all routes
│   │   └── team.js           # Team orchestrator (spawn team, broadcast)
│   ├── agents/
│   │   ├── manager.js        # Agent lifecycle (spawn/stop/fork)
│   │   ├── worker.js         # Agent process (selects provider)
│   │   ├── gemini-client.js  # Gemini API client with tool calling
│   │   └── promptdee-client.js # PromptDee API client (free, no key)
│   ├── memory/
│   │   └── store.js          # SQLite FTS5 (agents, memories, messages, threads, traces, tasks, analytics)
│   └── dashboard/
│       └── public/
│           └── index.html    # OLED dark mode dashboard
├── scripts/
│   └── setup.js              # Auto-setup script
├── docs/
│   ├── queue-system.md       # 50-agent scaling design
│   └── soul-brews-analysis.md # Learnings from Soul-Brews-Studio
├── .env.example
├── .gitignore
├── package.json
├── test.js                   # Unit tests (17 tests)
├── test-team.js              # Team communication test
├── start.bat                 # Windows start
└── setup.bat                 # Windows setup
```

### Tech Stack:
- **Runtime**: Node.js 18+ (ESM)
- **Server**: Express + ws (WebSocket)
- **Database**: SQLite via better-sqlite3 (WAL mode)
- **Search**: SQLite FTS5 full-text search
- **AI**: PromptDee API (free gpt-4o-mini) or Gemini API
- **Dashboard**: Pure HTML/CSS/JS (no framework)

### Key Design Decisions (from Oracle/Soul-Brews-Studio):
1. **"Nothing is Deleted"** — memories use supersede pattern, never deleted
2. **Threaded messages** — forum_threads + messages with thread_id
3. **Trace system** — parent/child traces with chain linking
4. **Analytics logging** — search_log, learn_log, access_log
5. **Security** — X-Content-Type-Options, X-Frame-Options, CORS validation
6. **Process isolation** — each agent is a forked child process

---

## API Endpoints

```
GET  /api/health                    # Health + version + uptime
GET  /api/stats                     # All counts (agents, memories, messages, tasks, threads, traces)
GET  /api/analytics/search          # Search stats (avg time, avg results)
GET  /api/analytics/timeline?hours=24  # Activity timeline

# Agents
GET  /api/agents                    # List all agents
POST /api/agents                    # Spawn agent {name, role, personality}
DELETE /api/agents/:id              # Stop agent
POST /api/agents/:id/chat           # Chat with agent {message}
POST /api/agents/:fromId/tell/:toId # Agent-to-agent message {message}

# Threads (Oracle forum pattern)
GET  /api/threads                   # List threads
POST /api/threads                   # Create thread {title, createdBy, assignedTo}
GET  /api/threads/:id               # Get thread with messages
PUT  /api/threads/:id               # Update thread {status}

# Messages (threaded + flat)
GET  /api/messages?threadId=&limit= # Get messages (flat or threaded)
POST /api/messages                  # Send message {from, to, threadId, content, role}
GET  /api/messages/search?q=        # FTS5 search messages

# Tasks
GET  /api/tasks                     # List pending tasks
POST /api/tasks                     # Create task {title, description, assignedTo, priority}
PUT  /api/tasks/:id                 # Update task {status, result}

# Memory (with supersede)
GET  /api/memory/search?q=&agent=   # FTS5 search memories
GET  /api/memory/all?limit=         # List all memories
POST /api/memory/:id/supersede      # Supersede {newId, reason, agentId}

# Traces
GET  /api/traces                    # List traces
POST /api/traces                    # Create trace {query, queryType, agentId}
GET  /api/traces/:traceId           # Get trace
PUT  /api/traces/:traceId           # Update trace
POST /api/traces/link               # Link traces {prevTraceId, nextTraceId}
GET  /api/traces/:traceId/chain     # Get trace chain

# Team
POST /api/team/spawn                # Spawn team {template: 'default'|'full'|'dev'|'minimal'}
GET  /api/team/status               # Team status
POST /api/team/task                 # Broadcast task {task}
POST /api/team/chat                 # Team chat {message}
GET  /api/team/templates            # List templates

# Agent callback (agents report back)
POST /api/agent-callback/:agentId   # {type: 'thought'|'response'|'memory'|'message'|'status'|'trace', data}

# Dashboard
GET  /dashboard                     # Web UI
```

---

## Database Schema (14 tables)

```sql
-- Core
agents(id, name, role, status, personality, created_at, last_active)
memories(id, agent_id, category, content, importance, tags, superseded_by, superseded_at, superseded_reason, source, project, created_at)

-- Threaded messages (Oracle forum pattern)
threads(id, title, created_by, status, assigned_to, project, created_at, updated_at)
messages(id, thread_id, from_agent, to_agent, role, content, metadata, read, created_at)

-- Tasks
tasks(id, thread_id, title, description, assigned_to, status, priority, result, created_at, completed_at)

-- Traces (Oracle trace system)
traces(id, trace_id, query, query_type, found_files, found_memories, found_messages, file_count, memory_count, parent_trace_id, depth, prev_trace_id, next_trace_id, status, insight, agent_id, session_id, duration_ms, created_at)

-- Analytics
search_log(id, query, agent_id, results_count, search_time_ms, created_at)
learn_log(id, agent_id, memory_id, content_preview, category, concepts, created_at)
access_log(id, agent_id, resource_type, resource_id, access_type, created_at)

-- Supersede audit trail
supersede_log(id, old_id, old_content, old_category, new_id, reason, agent_id, created_at)

-- FTS5 virtual tables
memories_fts(content, tags, category)
messages_fts(content)
```

---

## Team Templates

| Template | Members |
|----------|---------|
| default | Manager + Coder + Researcher |
| full | Manager + Coder + Researcher + Writer |
| dev | TechLead + Frontend + Backend |
| minimal | Manager + Worker |

---

## LLM Providers

### PromptDee (default, free, no API key)
- URL: https://www.promptdee.net/api/ai-chat
- Model: gpt-4o-mini
- Format: POST {"message": "..."}
- Limit: 5.00 credits/day

### Gemini (needs API key)
- URL: Google Generative AI API
- Model: gemini-2.0-flash
- Format: Standard Gemini API with tool calling
- Set in .env: GEMINI_API_KEY=...

---

## Priority TODO List

### Phase 1: CLI (start here)
```bash
# Create src/cli/index.js
# Commands: recap, fyi, rrr, standup, chat, team, status
# Use commander.js or simple arg parsing
# Calls Hub API (localhost:3456/api/*)
```

### Phase 2: Session Handoff
- Auto-summary on shutdown (already have session end memory)
- /recap reads last session summary + recent memories
- /forward creates handoff with current context
- Store handoff in memories with category='handoff'

### Phase 3: Agent Auto-Communication
- Manager agent's processMessage() should check for pending tasks
- When task completes, agent should auto-report to Manager
- Worker should check messages channel periodically

### Phase 4: Dashboard Improvements
- Add Threads tab (list + view thread messages)
- Add Traces tab (list + chain view)
- Add Tasks board (kanban: pending/active/done)
- Add Memory browser (search + browse)

### Phase 5: Persistence & Reliability
- Agent state save on shutdown (conversation history, memory cache)
- Agent restore on startup
- Watchdog: monitor agent processes, auto-restart on crash
- Health check endpoint per agent

---

## GitHub Setup

**Repo**: https://github.com/dmz2001TH/oracle-multi-agent
**User**: dmz2001TH

To push updates:
```bash
# Get a GitHub Personal Access Token from the user
# Then:
git remote set-url origin https://dmz2001TH:<TOKEN>@github.com/dmz2001TH/oracle-multi-agent.git
git push origin main
# Clean up after:
git remote set-url origin https://github.com/dmz2001TH/oracle-multi-agent.git
```

⚠️ NEVER store the token in files. Ask the user for it each time.

---

## Windows Setup

User has: Windows 10, 8GB RAM, 64-bit
Recommended: WSL2 for best experience

```powershell
# WSL2 setup (one-time):
wsl --install
# Restart, then in Ubuntu terminal:
cd /mnt/c/Users/<username>/path/to/oracle-multi-agent
npm install && npm start
```

Native Windows works but better-sqlite3 may need:
```powershell
npm install -g windows-build-tools
```

---

## Soul-Brews-Studio Key Learnings

From analyzing their repos (arra-oracle-v3, maw-js, arra-oracle-skills-cli):
1. Supersede pattern > hard delete
2. Threaded messages > flat channels
3. Trace system with parent/child/chain > flat logs
4. Analytics logging > no logging
5. Security headers > no headers
6. Graceful shutdown > kill
7. Tool groups config > all tools always on
8. Transport abstraction > hardcoded transport

Applied all of these in our v2.0.

---

## Test Commands

```bash
# Start server
cd oracle-multi-agent && npm start

# Run unit tests
node test.js

# Run team test
node test-team.js

# Manual test via curl
curl http://localhost:3456/api/health
curl -X POST http://localhost:3456/api/agents -H "Content-Type: application/json" -d '{"name":"Neo","role":"coder"}'
```

---

**End of Handoff. Good luck, agent. 🧠**
