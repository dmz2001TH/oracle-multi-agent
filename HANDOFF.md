# 🔄 HANDOFF — Oracle Multi-Agent v5.0

> สำหรับ AI agent ตัวใหม่ที่จะสานต่อโปรเจ็คนี้

## สถานะปัจจุบัน (2026-04-15 00:43 GMT+8)

**Repo**: https://github.com/dmz2001TH/oracle-multi-agent
**Branch**: main
**Version**: 5.0.0 | **Commands**: 44 | **API Endpoints**: 50+ | **Plugins**: 11 | **Dashboard Pages**: 10 | **MCP Tools**: 12 | **_ref repos**: 25

## ✅ สิ่งที่เสร็จแล้วทั้งหมด

### Dashboard Pages (10 หน้า — inspired by Soul-Brews-Studio/maw-ui)
| # | Route | Description |
|---|-------|-------------|
| 1 | `/` | Main dashboard — agent list, chat, system stats, command list (ภาษาไทย) |
| 2 | `/chat` | Soul Brews style chat — ChibiAvatars, Bubble/Timeline/Threads views, per-agent persistence |
| 3 | `/feed` | Live Agent Feed — เห็นทุกการสื่อสารระหว่าง agent แบบ real-time |
| 4 | `/terminal` | Agent terminal — sidebar เลือก agent/session, terminal output + command input |
| 5 | `/mission` | Mission Control — Pulse stats, task progress bars, workflow templates |
| 6 | `/inbox` | Inbox dashboard — messages/handoffs/FYI/resonance filterable |
| 7 | `/agents` | Agent detail — card grid, spawn, restart/sleep/stop, per-agent chat |
| 8 | `/fleet` | Fleet overview — big-number stats, agent grid, health checks |
| 9 | `/federation` | Federation Mesh — canvas visualization, node health, soul sync |
| 10 | `/workspace` | Workspace — configs, skills overview, broadcast |
| 11 | `/config` | Config viewer — system info, plugins, commands, fleet config JSON |
| 12 | `/vault` | Vault dashboard (ψ/ stats, search, skills, principles) |
| 13 | `/workspace-files/` | File browser — serve agent-created files from ~/.oracle/ |

### New Features Added (2026-04-15)
1. **Federation Core** (`src/federation/index.ts`) — Full TypeScript federation system with HMAC-SHA256, health monitoring, soul sync
2. **MCP Bridge** (`src/bridges/mcp-bridge.ts`) — JSON-RPC 2.0 MCP endpoint, 12 tools for Claude Code/Cursor
3. **Enhanced Peer-Exec** (`src/api/peer-exec.ts`) — Session cookies, readonly protection, signature parsing
4. **Federation Lens UI** (`public/federation.html`) — Canvas mesh visualization with animated connections
5. **Chat UI** (`public/chat.html`) — Soul Brews style with ChibiAvatars, 3 view modes, per-agent persistence
6. **Live Feed** (`public/feed.html`) — Real-time feed of all agent communication and activity
7. **Workspace File Browser** — `/workspace-files/` serves agent-created files with directory listing
8. **Chat Persistence** — Messages saved per-agent to `~/.oracle/chat/<agent>/`, restored on refresh
9. **Inter-agent Broadcasting** — `tell` messages now visible in WebSocket feed
10. **Agent Brain** — MiMo agent has `remember`, `search_memory`, `tell`, `list_agents`, `read_file`, `write_file`, `call_api` tools

### Agent Tools (11 tools)
| Tool | ทำอะไร |
|------|--------|
| `remember` | บันทึกความจำ |
| `search_memory` | ค้นหาความจำ |
| `tell` | ส่งข้อความหา agent อื่น |
| `list_agents` | ดู agent ทั้งหมด |
| `create_task` | สร้าง task |
| `read_file` | อ่านไฟล์ |
| `write_file` | เขียนไฟล์ |
| `call_api` | เรียก API |
| `query_data` | ค้น goals/tasks/experiences |
| `get_messages` | เช็คข้อความ |
| `spawn_agent` | สร้าง agent ใหม่ |

### Dashboard Navigation
- ทุกหน้ามี nav bar เชื่อมถึงกัน
- `index.html` + `vault.html` + ทุกหน้าใหม่ — เพิ่ม nav links ไปทุกหน้า
- Routing: `src/index.ts` เพิ่ม 8 routes ใหม่ (terminal, mission, inbox, agents, fleet, workspace, config)
- Dashboard แสดงภาษาไทย — command descriptions 44 คำสั่ง, labels, placeholders

### Batch 1: Core CLI Commands (16)
| # | Command | Description |
|---|---------|-------------|
| 1 | /awaken | Identity setup ceremony |
| 2 | /recap | Session summary |
| 3 | /fyi | Save to memory |
| 4 | /rrr | Daily retrospective |
| 5 | /standup | Daily standup |
| 6 | /feel | Mood logger |
| 7 | /forward | Session handoff |
| 8 | /trace | Universal search (smart/deep/oracle) |
| 9 | /learn | Study repository (supports org URL) |
| 10 | /who-are-you | Oracle identity |
| 11 | /philosophy | 5 Principles + Rule 6 |
| 12 | /skills | List/search 55 skills |
| 13 | /resonance | Capture what resonates |
| 14 | /fleet | Fleet census |
| 15 | /pulse | Project board |
| 16 | /workflow | Multi-agent workflow templates |

### Batch 2: New Commands (7)
| # | Command | Description |
|---|---------|-------------|
| 17 | /distill | Extract patterns from journals |
| 18 | /inbox | Check inbox (tasks, handoffs, focus) |
| 19 | /overview | System overview |
| 20 | /find | Quick memory search |
| 21 | /soul-sync | Sync ψ/ ↔ ~/.oracle/ |
| 22 | /contacts | List oracle contacts |
| 23 | /oracle-v2 | Oracle-v2 MCP server bridge |

### Batch 3: maw-js Agent Management (10)
| # | Command | Description |
|---|---------|-------------|
| 24 | /ls | List all agents |
| 25 | /peek | See agent's latest output |
| 26 | /hey | Send message to agent |
| 27 | /wake | Spawn/wake agent |
| 28 | /sleep | Gracefully stop agent |
| 29 | /stop | Force stop agent |
| 30 | /done | Save state + clean up |
| 31 | /broadcast | Broadcast to all agents |
| 32 | /bud | Create oracle from parent |
| 33 | /restart | Restart agent |

### Batch 4: Plugin Architecture + maw-js Parity (11)
| # | Command | Description |
|---|---------|-------------|
| 34 | /plugin | Plugin management (list/install/remove) |
| 35 | /task | Task system (log --commit/--blocker, show, comment, done) |
| 36 | /project | Project trees (create, add, show with progress) |
| 37 | /loop | Loop management (add/remove/trigger/enable/disable/history) |
| 38 | /tokens | Token monitoring (--rebuild, --json) |
| 39 | /think | Think cycle — agents propose ideas |
| 40 | /meeting | Meeting orchestration — collect input from agents |
| 41 | /tab | Tab management (list/send to tmux sessions) |
| 42 | /view | Clean full-screen view for agent |
| 43 | /chat | Chat history per agent |
| 44 | /review | Review think cycle proposals |

### Plugin System (src/plugins/ + plugins/)
- `src/plugins/types.ts` — Plugin interfaces (manifest, handler, surfaces: cli/api/hook/peer/cron)
- `src/plugins/sdk.ts` — definePlugin() helper + cliPlugin/apiPlugin utilities
- `src/plugins/loader.ts` — Weight-based plugin loader with registries
- Plugin format: `plugin.json` (manifest) + `index.ts` (handler)
- Weight order: 00 (core) → 10 (infra) → 20 (tools) → 50 (features) → 90 (custom)

### Real Plugins (11 — tested, all load successfully)
| Weight | Plugin | Description |
|--------|--------|-------------|
| 00 | wake | Spawn/wake agent (cli + api) |
| 00 | sleep | Gracefully stop agent (cli + api) |
| 00 | hey | Send message to agent (alias: talk-to) |
| 00 | ls | List all agents (alias: oracle) |
| 20 | ping | Ping server health |
| 20 | health | System health check (API, WS, plugins, agents) |
| 20 | status | Quick status overview (alias: st) |
| 50 | bud | Create oracle from parent or root |
| 50 | about | Detailed agent/system info |
| 50 | contacts | Oracle contacts list |
| 50 | research-swarm | Research swarm — spawn N agents in parallel |

### MiMo LLM Integration
- `src/agents/mimo-client.js` — MiMo API client (OpenAI-compatible)
- Env vars: `LLM_PROVIDER=mimo`, `MIMO_API_KEY=<key>`, `AGENT_MODEL=mimo-v2-pro`, `MIMO_API_BASE=https://api.xiaomimimo.com/v1`
- Worker (`src/agents/worker.js`) auto-selects client based on LLM_PROVIDER

### Infrastructure
- Hono server on port 3456
- WebSocket /ws for real-time dashboard
- Agent system: 9 roles with CLI command awareness
- Oracle-v2 bridge API (/api/oracle-v2/*)
- ψ/ full oracle-framework structure
- 55 skills registry
- 5 workflow patterns (sequential/parallel/fan-out/review/pipeline)
- Semantic search (@xenova/transformers)
- TypeScript: 0 errors

## Architecture

```
src/
├── index.ts                  ← Hono server (port 3456) + WebSocket + routing
├── commands/index.ts         ← 44 CLI commands + 44 Thai descriptions
├── api/
│   ├── index.ts              ← API router (registers all sub-routers)
│   ├── agent-bridge.ts       ← Agent API (spawn, chat, stop)
│   ├── oracle-v2-bridge.ts   ← Oracle-v2 proxy (port 47778)
│   └── *.ts                  ← 35+ more routers
├── agents/
│   ├── manager.js            ← AgentManager + AGENT_ROLES (9 roles)
│   ├── worker.js             ← Agent child process (auto-selects LLM client)
│   ├── gemini-client.js      ← Gemini API client
│   ├── mimo-client.js        ← MiMo API client
│   └── promptdee-client.js   ← PromptDee API client
├── plugins/
│   ├── types.ts              ← Plugin interfaces
│   ├── sdk.ts                ← definePlugin() helper
│   └── loader.ts             ← Plugin loader (weight-based)
├── skills/registry.ts        ← 55 skills
├── workflows/index.ts        ← 5 workflow patterns
├── knowledge/oracle-principles.md
├── memory/                   ← SQLite + vector store
└── ...
plugins/                      ← 11 real plugins (00-core, 20-tools, 50-features)
├── 00-wake/, 00-sleep/, 00-hey/, 00-ls/
├── 20-ping/, 20-health/, 20-status/
└── 50-bud/, 50-about/, 50-contacts/, 50-research-swarm/
public/
├── index.html                ← Main dashboard (ภาษาไทย)
├── terminal.html             ← Terminal page
├── mission.html              ← Mission control
├── inbox.html                ← Inbox dashboard
├── agents.html               ← Agent detail
├── fleet.html                ← Fleet overview
├── workspace.html            ← Workspace
├── config.html               ← Config viewer
├── vault.html                ← Vault dashboard
└── favicon.svg               ← Favicon (cat with headphones)
_ref/                         ← 25 reference repos
ψ/                            ← Knowledge root
test/e2e.mjs                  ← E2E tests
docs/DEPLOY.md                ← VPS deploy guide
```

## How to Run

```bash
git pull origin main
npm install

# With MiMo
LLM_PROVIDER=mimo MIMO_API_KEY=<key> AGENT_MODEL=mimo-v2-pro npx tsx src/index.ts

# With Gemini (default)
GEMINI_API_KEY=<key> npx tsx src/index.ts
```

เปิด http://localhost:3456

## How to Push

```bash
git add -A && git commit -m "descriptive message"
git remote set-url origin https://dmz2001TH:TOKEN@github.com/dmz2001TH/oracle-multi-agent.git
git push origin main
git remote set-url origin https://github.com/dmz2001TH/oracle-multi-agent.git
```

TOKEN = เจ้าของจะส่งทาง chat ทุกครั้งตอน push
อย่า commit token ลง repo เด็ดขาด

## Workflow การทำงาน (ทำตามนี้ทุกครั้ง)

ขั้นตอนมาตรฐานเมื่อเจ้าของสั่งงาน:

```
ขั้นตอนที่ 1: เข้าใจงาน
- อ่านคำสั่งเจ้าของ
- ตอบสั้นๆ ว่าจะทำอะไร (1-2 บรรทัด)

ขั้นตอนที่ 2: ทำเลย
- แก้โค้ด / สร้างไฟล์
- อย่าถามยืนยัน ถ้าเข้าใจแล้วทำเลย

ขั้นตอนที่ 3: ตรวจคุณภาพ
- npx tsc --noEmit (ต้องไม่มี error)
- ถ้า error → แก้ก่อนไปขั้นตอนถัดไป

ขั้นตอนที่ 4: Commit + Push
- git add -A
- git commit -m "descriptive message"
- ขอ TOKEN จากเจ้าของ
- Push ขึ้น GitHub

ขั้นตอนที่ 5: อัพเดทไฟล์ (สำคัญมาก!)
- HANDOFF.md — เปลี่ยนสถานะ task ที่ทำเสร็จ
- README.md — ถ้ามี feature/command/endpoint ใหม่
- AGENT-PROMPT.md — ถ้ามีการเปลี่ยนแปลงโครงสร้าง

อย่าลืมอัพเดท! เจ้าของไม่ชอบให้ลืม!

ขั้นตอนที่ 6: บอกเจ้าของ
- ส่งสรุปสั้นๆ สิ่งที่ทำ
- ส่งคำสั่ง git pull + restart ให้เจ้าของทำตาม
```

## กฎเหล็ก

1. "Nothing is Deleted" — ไม่ลบโค้ดเก่า ปรับปรุงแทน
2. Dashboard = public/index.html (static HTML) — แก้ไขที่นี่โดยตรง
3. WebSocket path = /ws — อย่าเผลอลบ
4. TypeScript compile ต้องผ่าน: npx tsc --noEmit
5. อย่า commit token ลง repo
6. อัพเดท HANDOFF.md, README.md, AGENT-PROMPT.md ทุกครั้งที่ทำอะไรเสร็จ
7. ส่งคำสั่ง git pull + restart ให้เจ้าของทุกครั้งหลัง push
8. ถ้าไม่แน่ใจ → ถามเจ้าของ อย่าเดา
9. เทสก่อน push ทุกครั้ง
10. Dashboard แสดงภาษาไทย — command descriptions, labels, placeholders

## สิ่งที่ยังขาด (เปรียบเทียบกับ maw-js)

| สิ่งที่ขาด | สถานะ | หมายเหตุ |
|-----------|-------|---------|
| WASM plugin support | ❌ ยังไม่ทำ | maw-js ก็ยังไม่สมบูรณ์ — low priority |
| Task เชื่อม GitHub Issues | ❌ มี task system แต่ไม่เชื่อม GitHub | ทำได้แต่ต้อง GitHub token |
| Project tree auto-organize | ❌ มี manual แต่ไม่มี auto | ต่อได้ |
| Loop persistent + cron trigger | ⚠️ มี CLI แต่ยังไม่ trigger จริง | ต้องเชื่อมกับ cron system |
| War room overview (split panes) | ❌ มี /overview แต่เป็น stats | ต้องทำ tmux split |
| React/Three.js UI | ❌ Static HTML 8 pages | ใหญ่ — ทำตอนหลัง |
