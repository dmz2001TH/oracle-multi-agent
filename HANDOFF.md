# 🔄 HANDOFF — Oracle Multi-Agent v5.0

> สำหรับ AI agent ตัวใหม่ที่จะสานต่อโปรเจ็คนี้

## สถานะปัจจุบัน (2026-04-14 03:49 GMT+8)

**Repo**: https://github.com/dmz2001TH/oracle-multi-agent
**Branch**: main
**Commands**: 33 | **API Endpoints**: 40+ | **_ref repos**: 25

## ✅ สิ่งที่เสร็จแล้วทั้งหมด

### Dashboard Pages (7 หน้าใหม่ — inspired by Soul-Brews-Studio/maw-ui)
| # | Route | Description |
|---|-------|-------------|
| 1 | `/terminal` | Agent terminal — sidebar เลือก agent/session, terminal output + command input, WebSocket real-time |
| 2 | `/mission` | Mission Control — Pulse stats, task progress bars, task list CRUD, workflow templates |
| 3 | `/inbox` | Inbox dashboard — messages/handoffs/FYI/resonance แบบ filterable, stats, quick actions |
| 4 | `/agents` | Agent detail — card grid, spawn form, restart/sleep/stop actions, per-agent chat, detail panel |
| 5 | `/fleet` | Fleet overview — big-number stats, agent grid, sessions, health checks, system pulse |
| 6 | `/workspace` | Workspace — workspace configs, agent overview, skills overview, broadcast |
| 7 | `/config` | Config viewer — system info, agent config, plugins, commands list, fleet config JSON, env vars |

### Dashboard Navigation
- ทุกหน้ามี nav bar เชื่อมถึงกัน: Home → Terminal → Mission → Inbox → Agents → Fleet → Workspace → Config → Vault
- `index.html` (Home) เพิ่ม nav links ไปทุกหน้า
- `vault.html` เพิ่ม nav links ไปทุกหน้า
- Routing: `src/index.ts` เพิ่ม 7 routes ใหม่ (app.get('/terminal'), etc.)
- TypeScript: 0 errors

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

### Infrastructure
- Hono server on port 3456
- WebSocket /ws for real-time dashboard
- Agent system: 9 roles (general, researcher, coder, writer, manager, data-analyst, devops, qa-tester, translator)
- Agent system prompts include CLI command awareness
- Oracle-v2 bridge API (/api/oracle-v2/*)
- ψ/ full oracle-framework structure (active/inbox/writing/lab/incubate/learn/archive + memory)
- 55 skills registry
- 5 workflow patterns (sequential/parallel/fan-out/review/pipeline)
- Semantic search (@xenova/transformers)
- E2E tests (25/25 passed)

### _ref/ Repositories (25)
Soul-Brews-Studio: maw-js, maw-ui, maw-plugins, maw-core-plugins, maw-incarnation-plugin, maw-cell-plugin, arra-oracle-v3, oracle-framework, oracle-v2, opensource-nat-brain-oracle, shrimp-oracle, skills-cli, vault-report

the-oracle-keeps-the-human-human: agents-that-remember, the-agent-bus, oracle-maw-guide, graph-oracle-v2, oracle-step-by-step, oracle-federation-guide, oracle-office-guide, oracle-auto-rrr-hooks, oracle-hooks-auto-cc, oracle-custom-skills

Other: nat-brain, safety-hooks, workflow-kit

### Bug Fixes
- /learn รองรับ GitHub org URL (แสดง repos list)
- Agent system prompts เพิ่ม CLI command awareness

## Architecture

```
src/
├── index.ts                 ← Hono server (port 3456) + WebSocket + routing
├── commands/index.ts        ← 33 CLI commands
├── api/
│   ├── index.ts             ← API router (registers all sub-routers)
│   ├── agent-bridge.ts      ← Agent API (spawn, chat, stop)
│   ├── oracle-v2-bridge.ts  ← Oracle-v2 proxy (port 47778)
│   └── *.ts                 ← 35+ more routers
├── agents/
│   ├── manager.js           ← AgentManager + AGENT_ROLES (9 roles)
│   ├── worker.js            ← Agent child process
│   └── *-client.js          ← LLM clients
├── skills/registry.ts       ← 55 skills
├── workflows/index.ts       ← 5 workflow patterns
├── knowledge/oracle-principles.md
├── memory/                  ← SQLite + vector store
└── ...
public/
├── index.html               ← Main dashboard
└── vault.html               ← Vault dashboard
_ref/                        ← 25 reference repos
ψ/                           ← Knowledge root
```

## How to Run

```bash
git pull origin main
npm install
npx tsx src/index.ts
```

## How to Push

```bash
git add -A && git commit -m "message"
git remote set-url origin https://dmz2001TH:TOKEN@github.com/dmz2001TH/oracle-multi-agent.git
git push origin main
git remote set-url origin https://github.com/dmz2001TH/oracle-multi-agent.git
```

## กฎเหล็ก

1. "Nothing is Deleted" — ไม่ลบโค้ดเก่า ปรับปรุงแทน
2. Dashboard = public/index.html (static HTML)
3. WebSocket path = /ws — อย่าเผลอลบ
4. TypeScript compile ต้องผ่าน: npx tsc --noEmit
5. อย่า commit token ลง repo
6. อัพเดท HANDOFF.md, README.md, AGENT-PROMPT.md ทุกครั้งที่ทำอะไรเสร็จ
7. ส่งคำสั่ง git pull + restart ให้เจ้าของทุกครั้งหลัง push
