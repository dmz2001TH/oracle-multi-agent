# 🔄 HANDOFF — Oracle Multi-Agent v5.0

**Repo**: `https://github.com/dmz2001TH/oracle-multi-agent`
**Branch**: `main` (latest commit `dd0b8bb`)
**Date**: 2026-04-14 00:31 GMT+8

---

## 🎯 Goal
Oracle Multi-Agent — AI agent system with HTTP API. Spawn agents, chat, remember, search memory, agent-to-agent communication. Uses **MiMo** (Xiaomi) as LLM provider via OpenAI-compatible API.

## ✅ What's Done (working 100%)

### Commits (in order):
| Commit | Description |
|--------|-------------|
| `c9828a9` | Base: agent-bridge.ts + memory-bridge.ts wired into Hono |
| `fffa000` | **BUG1 fix**: FTS5 sync triggers (messages_fts + memories_fts). **BUG2 fix**: searchMemories positional args |
| `eb19207` | **MiMo provider**: mimo-client.js, worker.js, manager.js, agent-bridge.ts |
| `09d1a9e` | **Legacy route aliases**: agent hub communication (agent workers call /api/* not /api/v2/*) |
| `dd0b8bb` | **Dashboard on port 3456**: serveStatic from built React app, no need for Vite dev server |

### Verified working (end-to-end tested, zero errors):
- ✅ Server starts → `provider: mimo, model: mimo-v2-pro`
- ✅ `POST /api/v2/agents/spawn` → agent runs MiMo via function calling
- ✅ `POST /api/v2/agents/:id/chat` → conversation works
- ✅ **Function calling**: agent calls `remember()` → hub callback → SQLite stored
- ✅ `GET /api/v2/memory/search?q=...` → FTS search works
- ✅ `POST /api/v2/memory` → add memory works
- ✅ `DELETE /api/v2/agents/:id` → stop agent
- ✅ Dashboard served from `http://localhost:3456` (after `vite build`)
- ✅ `tsc --noEmit` passes clean

---

## 🔧 Setup Instructions

```bash
git clone https://github.com/dmz2001TH/oracle-multi-agent.git
cd oracle-multi-agent
npm install

# Create .env
cat > .env << 'EOF'
LLM_PROVIDER=mimo
AGENT_MODEL=mimo-v2-pro
MIMO_API_KEY=<REDACTED — get from user or platform.xiaomimimo.com>
EOF

# Build dashboard (one-time)
cd src/dashboard && npm install && npx vite build && cd ../..

# Run server
npx tsx src/index.ts
# → http://localhost:3456 (API + Dashboard)
```

### MiMo API Info
- Endpoint: `https://api.xiaomimimo.com/v1/chat/completions`
- Auth: `Authorization: Bearer <API_KEY>`
- Models available: `mimo-v2-flash`, `mimo-v2-pro`, `mimo-v2-omni`, `mimo-v2-tts`
- List models: `GET /v1/models`
- OpenAI-compatible, supports function calling (tools)

---

## 🐛 Known Issues (non-critical, dashboard cosmetic)

### Dashboard 404s (doesn't break functionality)
The built dashboard calls these endpoints that don't exist yet:

1. **`GET /api/ui-state`** (no key) — route exists as `/api/ui-state/:key` (needs key param)
   - File: `src/api/ui-state.ts`
   - Fix: add route `GET /api/ui-state` that returns `{}` or all keys

2. **`GET /api/pin-info`** — route doesn't exist at all
   - File: `src/api/ui-state.ts` or new file
   - Fix: add stub route returning `{ locked: false }`

3. **`GET /api/tokens/rate`** — route exists as `/api/tokens` only
   - File: `src/api/tokens.ts`
   - Fix: add `GET /api/tokens/rate` returning `{ rate: 0, window: 3600 }`

4. **`GET /favicon.svg`** — static file not in dist
   - Fix: copy `src/dashboard/public/favicon.svg` or serve from public dir

5. **WebSocket `/ws`** — not set up
   - Dashboard wants real-time updates via `ws://localhost:3456/ws`
   - Fix: add WebSocket upgrade handler in `src/index.ts` (bigger task)
   - Or: suppress WebSocket errors in dashboard code

### Hub warnings (silenced by legacy aliases)
Old error: `Hub GET error: Unexpected non-whitespace character after JSON`
Fixed in `09d1a9e` — legacy aliases now return proper JSON.

---

## 📁 Key Files

```
src/
├── index.ts                    # Entry point — Hono server + static serving
├── agents/
│   ├── mimo-client.js          # ★ MiMo LLM client (OpenAI-compatible)
│   ├── gemini-client.js        # Gemini client (needs API key)
│   ├── promptdee-client.js     # Alternative provider
│   ├── manager.js              # AgentManager — spawn/stop/chat via fork worker
│   └── worker.js               # Child process — selects provider, handles messages
├── api/
│   ├── agent-bridge.ts         # ★ v2 agent API + legacy aliases + hub callbacks
│   ├── memory-bridge.ts        # ★ v2 memory API + legacy aliases
│   └── index.ts                # All other API routers (30+ files)
├── memory/
│   └── store.js                # ★ MemoryStore — SQLite (917 lines), FTS5, triggers
└── dashboard/
    ├── src/                    # React source
    └── dist/                   # Built output (gitignored)
```

**★ = files modified in this handoff**

---

## 🧪 Test Commands

```bash
# Health
curl http://localhost:3456/health

# Spawn agent
curl -X POST http://localhost:3456/api/v2/agents/spawn \
  -H 'Content-Type: application/json' \
  -d '{"name":"bot1","role":"general"}'

# Chat (replace AGENT_ID)
curl -X POST http://localhost:3456/api/v2/agents/AGENT_ID/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"say hi in 5 words"}'

# Memory
curl http://localhost:3456/api/v2/memory/stats
curl "http://localhost:3456/api/v2/memory/search?q=test"
curl -X POST http://localhost:3456/api/v2/memory \
  -H 'Content-Type: application/json' \
  -d '{"content":"test memory","agentId":"system"}'

# Stop agent
curl -X DELETE http://localhost:3456/api/v2/agents/AGENT_ID
```

---

## ⚠️ Budget Note
MiMo API has limited balance (~$2.72). Keep tests minimal. Use short prompts and low `max_tokens`.

---

## 🚀 Next Steps for New Agent
1. Fix dashboard 404s (add stub routes for ui-state, pin-info, tokens/rate, favicon)
2. Optionally add WebSocket `/ws` for real-time dashboard updates
3. Test agent-to-agent communication (`tell` tool)
4. Test task creation and completion flow
5. Improve error handling in mimo-client.js tool execution
