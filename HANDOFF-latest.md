# HANDOFF — 2026-04-14 19:38 GMT+8

## สิ่งที่ทำเสร็จแล้ว ✅ (ทั้งหมด)

### 1. 10 Features ฐาน (commit 5039459)
| # | Feature | Path | Status |
|---|---------|------|--------|
| 1 | Mailbox System (Tier 2) | `src/mailbox/index.ts` | ✅ |
| 2 | Agent Lineage (Yeast Model) | `src/lineage/index.ts` | ✅ |
| 3 | Session-End Archival | `src/archive/index.ts` | ✅ |
| 4 | Hybrid Search (BM25 + Vector) | `src/hybrid-search/index.ts` | ✅ |
| 5 | WASM Plugin Runtime | `src/wasm-runtime/index.ts` | ✅ |
| 6 | Standing Orders | `src/standing-orders/index.ts` | ✅ |
| 7 | Research Swarm | `src/swarm/index.ts` | ✅ |
| 8 | Fleet Oracle Scan | `src/fleet-scan/index.ts` | ✅ |
| 9 | Cost Model by Tier | `src/cost-model/index.ts` | ✅ |
| 10 | WireGuard P2P | `src/wireguard/index.ts` | ✅ |

### 2. Wire + Integration — 9 API routes, 10 CLI commands, tsc clean

### 3. Autonomous Modules
| Module | File |
|--------|------|
| Goal Engine | `src/goals/index.ts` |
| Planning Loop | `src/planning/index.ts` |
| Experience Memory | `src/experience/index.ts` |
| Self-Healing | `src/healing/index.ts` |
| Orchestrator | `src/orchestrator/index.ts` |
| Orchestrator API | `src/api/orchestrator-api.ts` |

### 4. Agent Auto-Spawning — `spawn_agent` tool + auto-spawn listener

### 5. LLM Integration
- MiMo client (`src/agents/mimo-client.js`) + Gemini + PromptDee
- `.env` มี `MIMO_API_KEY` + `MIMO_API_BASE` (key จริงแล้ว)
- `LLM_PROVIDER=mimo`, `AGENT_MODEL=mimo-v2-pro`

### 6. Priority 1-5 (commit a2077fb)
- `llm-client.ts` — LLM wrapper (MiMo + Gemini)
- `executeTask()` เรียก LLM จริง + fallback
- 4 tools ใหม่: read_file, write_file, call_api, query_data
- `tools-api.ts` — file ops + data query endpoints
- Auto-tick setInterval 15s
- Agent TTL cleanup ทุก 5min

### 7. Parallel + Full Autonomy (commit 0862447)
- `tick()` — `Promise.allSettled()` parallel batch
- `getReadyTasksForGoal()` — strict dependency check
- `executeTask()` — full pipeline with LLM + fallback
- Auto-tick + `/tick/start|stop|stats`
- Cleanup auto-agents idle > 30min

### 8. Tool Chaining (commit caa1818) ← ล่าสุด
- `callLLMWithTools()` — multi-turn loop: ส่ง tool defs → execute tool → ส่งผลกลับ LLM → loop
- `ORCHESTRATOR_TOOL_DEFS` — 5 tools (read_file, write_file, call_api, query_data, remember)
- `ToolExecutor` type — pluggable tool execution callback
- Orchestrator `executeTask()` ใช้ `callLLMWithTools()` แทน single-shot
- Unified tool dispatch `POST /api/tools/:name` — รองรับ underscore + dash
- `hubUrl` config field สำหรับ tool executor routing
- Falls back to single-shot for Gemini provider

### 9. Tests
```
test/test-10-features.mjs      → 49/49  ✅
test/test-integration.mjs      → 34/34  ✅
test/test-autonomous-e2e.mjs   → 17/17  ✅
test/test-tool-chaining.mjs    → 15/15  ✅
Total: 115/115 ✅
```

---

## สิ่งที่เริ่มทำแล้วยังไม่เสร็จ — 4 Modules ใหม่

จากการศึกษาหนังสือ Multi-Agent Orchestration Book + maw guide — พบว่าขาด 8 features สำคัญ
**ได้สร้าง 4 modules แล้ว แต่ยังไม่ได้ wire เข้า API + orchestrator**

### ไฟล์ที่สร้างแล้ว (uncommitted)

| Module | File | สถานะ |
|--------|------|--------|
| **Message Bus** | `src/messaging/index.ts` | ✅ โค้ดเสร็จ — ❌ ยังไม่ได้ wire API |
| **Task Board** | `src/board/index.ts` | ✅ โค้ดเสร็จ — ❌ ยังไม่ได้ wire API |
| **Loops** | `src/loops/index.ts` | ✅ โค้ดเสร็จ — ❌ ยังไม่ได้ wire API |
| **Fleet** | `src/fleet/index.ts` | ✅ โค้ดเสร็จ — ❌ ยังไม่ได้ wire API |

---

## สิ่งที่ต้องทำต่อ ❌ (agent ตัวถัดไป)

### Step 1: Wire 4 modules เข้า API (ง่าย — copy pattern จาก orchestrator-api.ts)

สร้าง API routes สำหรับแต่ละ module:

**Messaging API** (`src/api/messaging-api.ts`):
```
POST /api/messaging/send          — sendMessage({from, to, content, summary, type})
GET  /api/messaging/:agent/inbox  — getMessages(agent)
POST /api/messaging/:agent/read   — markRead(agent)
POST /api/messaging/broadcast     — broadcast({from, content, agents})
POST /api/messaging/report        — reportCompletion({agent, taskId, summary})
POST /api/messaging/blocker       — reportBlocker({agent, taskId, blocker})
GET  /api/messaging/stats         — getMessageStats()
GET  /api/messaging/all           — getAllMessages()
```

**Board API** (`src/api/board-api.ts`):
```
POST /api/board/tasks             — createTask({subject, description, owner, priority})
GET  /api/board/tasks             — listTasks(filter)
GET  /api/board/tasks/:id         — getTask(id)
PATCH /api/board/tasks/:id        — updateTask(id, {status, owner})
POST /api/board/tasks/:id/claim   — claimTask(id, agentName)
POST /api/board/tasks/:id/log     — addLog(id, {agent, type, message})
GET  /api/board/tasks/:id/timeline — getTaskTimeline(id)
GET  /api/board/kanban            — getKanban() + formatKanban()
POST /api/board/projects          — createProject(name, description)
GET  /api/board/projects          — listProjects()
POST /api/board/projects/:id/add  — addTaskToProject(projectId, taskId)
GET  /api/board/projects/:id      — formatProject(id)
GET  /api/board/stats             — getBoardStats()
```

**Loops API** (`src/api/loops-api.ts`):
```
POST /api/loops                   — createLoop({name, agent, schedule, prompt})
GET  /api/loops                   — listLoops()
GET  /api/loops/:id               — getLoop(id)
POST /api/loops/:id/enable        — enableLoop(id)
POST /api/loops/:id/disable       — disableLoop(id)
DELETE /api/loops/:id             — deleteLoop(id)
POST /api/loops/:id/trigger       — triggerLoop(id) — trigger ทันที
GET  /api/loops/:id/history       — getLoopHistory(id)
POST /api/loops/wakeup            — scheduleWakeup({agent, delaySeconds, prompt, reason})
GET  /api/loops/wakeups           — listWakeups()
GET  /api/loops/stats             — getLoopStats()
GET  /api/loops/format            — formatLoops() — text view
```

**Fleet API** (`src/api/fleet-api.ts`):
```
POST /api/fleet/register          — registerAgent({name, role, worktree})
POST /api/fleet/:name/wake        — wakeAgent(name, task?)
POST /api/fleet/:name/sleep       — sleepAgent(name)
POST /api/fleet/:name/idle        — idleAgent(name)
POST /api/fleet/:name/assign      — assignWork(name, task)
GET  /api/fleet/:name/peek        — peekAgent(name)
GET  /api/fleet                   — listFleet() + formatFleet()
GET  /api/fleet/overview          — getFleetOverview()
POST /api/fleet/wake-all          — wakeAll()
POST /api/fleet/stop-all          — stopAll()
DELETE /api/fleet/:name           — deregisterAgent(name)
```

**Wire เข้า `src/api/index.ts`** — import + app.route(...)

### Step 2: เชื่อม Modules เข้า Orchestrator

- **Message Bus → executeTask()**: เพิ่ม reporting contract — agent ต้อง reportCompletion() เมื่อเสร็จ
- **Board → Goal decomposition**: เมื่อ createGoal/decomposeGoal → auto-createTask on board
- **Loops → orchestrator tick**: listen on `loop:execute` event → createGoal from prompt
- **Fleet → agent management**: registerAgent เมื่อ spawn, wakeAgent/sleepAgent lifecycle

### Step 3: Dashboard Module (ยังไม่ได้สร้าง)

สร้าง `src/dashboard/index.ts` + `src/api/dashboard-api.ts`:
```
GET /api/dashboard/overview     — สรุปทั้งหมด (goals, agents, tasks, tokens)
GET /api/dashboard/goals/:id    — goal detail + progress bar
GET /api/dashboard/agents       — agent status + workload
GET /api/dashboard/experience   — experience stats + success rate
GET /api/dashboard/logs         — real-time event log (SSE)
GET /api/dashboard/kanban       — formatted kanban board
GET /api/dashboard/fleet        — formatted fleet status
GET /api/dashboard/loops        — formatted loop status
```

### Step 4: เชื่อม MiMo Client เข้า Board + Messaging

- `mimo-client.js` `_executeTool()` — เพิ่ม cases สำหรับ board tools:
  - `create_task` → ใช้ board.createTask() แทน generic
  - `log_task` → board.addLog()
  - `send_message` → messaging.sendMessage()
  - `report` → messaging.reportCompletion()

### Step 5: Tests สำหรับ modules ใหม่

สร้าง `test/test-new-modules.mjs`:
- Phase 1: Messaging — send, inbox, broadcast, report, blocker
- Phase 2: Board — create, claim, log, kanban, project
- Phase 3: Loops — create, trigger, disable, wakeup
- Phase 4: Fleet — register, wake, sleep, peek, overview
- Phase 5: Integration — messaging→board→orchestrator flow

### Step 6: State Hygiene

- JSONL atomic writes: writeFileSync(.tmp) → renameSync (แทน appendFileSync ตรงๆ)
- Monotonic IDs: เพิ่ม timestamp prefix ใน ID generation
- Consider SQLite migration สำหรับ modules ที่ query บ่อย

### Step 7: Push + Full Test

```bash
cd oracle-multi-agent
git add -A
git commit -m "feat: Message Bus, Task Board, Loops, Fleet, Dashboard — full maw parity"
git push origin main  # ต้อง set remote URL ด้วย token

# รัน tests ทั้งหมด
node test/test-10-features.mjs
node test/test-integration.mjs 3456
node test/test-autonomous-e2e.mjs 3456
node test/test-tool-chaining.mjs 3456
node test/test-new-modules.mjs 3456
```

---

## Architecture หลังจากนี้ (เป้าหมายสุดท้าย)

```
                     ┌─────────────────────────┐
                     │     Human Dashboard      │
                     │  /api/dashboard/*        │
                     └────────────┬────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
  ┌─────▼─────┐           ┌──────▼──────┐           ┌──────▼──────┐
  │   Board   │           │ Orchestrator │           │   Loops     │
  │ /api/board│◄─────────►│ /api/orchest│◄─────────►│ /api/loops  │
  │ kanban    │           │  tick()     │           │ cron-like   │
  │ logs      │           │  execute()  │           │ schedules   │
  └─────┬─────┘           └──────┬──────┘           └─────────────┘
        │                        │
  ┌─────▼─────┐           ┌──────▼──────┐
  │ Messaging │           │   Fleet     │
  │ send/hey  │◄─────────►│ wake/sleep  │
  │ inbox     │           │ peek/ls     │
  │ report    │           │ overview    │
  └─────┬─────┘           └──────┬──────┘
        │                        │
        └────────┬───────────────┘
                 │
          ┌──────▼──────┐
          │  MiMo Agent │
          │  (workers)  │
          │  tool chain │
          └─────────────┘
```

---

## Environment Setup
```bash
cd oracle-multi-agent
# .env:
LLM_PROVIDER=mimo
AGENT_MODEL=mimo-v2-pro
MIMO_API_KEY=<key>
MIMO_API_BASE=https://api.xiaomimimo.com/v1
HUB_PORT=3456
MAX_CONCURRENT_AGENTS=10
ORCHESTRATOR_TICK_MS=15000
AGENT_TTL_MS=1800000

# Run:
npx tsx src/index.ts

# Tests:
node test/test-10-features.mjs
node test/test-integration.mjs 3456
node test/test-autonomous-e2e.mjs 3456
node test/test-tool-chaining.mjs 3456
```

## Commits
```
5039459 feat: 10 base features + wire + CLI
a2077fb feat: Priority 1-5 — real LLM execution, tools, auto-tick
0862447 feat: parallel execution, full autonomy, tools registry
caa1818 feat: Priority 1 — Tool Chaining (multi-turn LLM + tool dispatch)
```

## Source
- https://github.com/dmz2001TH/oracle-multi-agent
- https://soul-brews-studio.github.io/multi-agent-orchestration-book/
- https://github.com/the-oracle-keeps-the-human-human/oracle-maw-guide
- https://github.com/Soul-Brews-Studio/maw-js
