# 🔄 HANDOFF — Oracle Multi-Agent v5.0

> สำหรับ AI agent ตัวใหม่ที่จะสานต่อโปรเจ็คนี้ → เป้าหมาย: 100% ครบตามคู่มือ Oracle ecosystem

## สถานะปัจจุบัน (2026-04-14)

**Repo**: https://github.com/dmz2001TH/oracle-multi-agent
**Branch**: main

## ✅ สิ่งที่เสร็จแล้ว

- 6 stubs → ทำงานจริง (logging, project-detect, vector-store, lora, ui-state, plugins-api)
- 4 agent roles ใหม่ (data-analyst, devops, qa-tester, translator)
- Dashboard WebSocket ส่ง agent data ให้หน้า `/`
- WebSocket path แก้แล้ว: dashboard → `ws://host/ws` (ตรงกับ server)
- API routes: GET/POST/DELETE `/api/agents`, GET `/api/stats`
- Dashboard spawn form: 9 roles
- `/agents.html` → redirect ไป `/`
- TypeScript compile: 0 errors

## ❌ สิ่งที่ต้องทำ (ทั้งหมด — ทำให้ครบ 100%)

### Batch 1: CLI Commands ที่ขาด (ทุกคำสั่งที่คู่มือกล่าวถึง)

| # | Command | สถานะ | ต้องทำ |
|---|---|---|---|
| 1 | `/awaken` | ❌ ไม่มี | Identity setup ceremony — สร้าง ψ/memory/identity.md, ถามชื่อ/บุคลิก/ความสนใจ, บันทึกลง SQLite, เชื่อม Oracle family |
| 2 | `/recap` | ❌ ไม่มี | สรุป session ก่อนหน้า — อ่าน memories 24h ล่าสุด, แสดง: ทำอะไรไป, เรียนรู้อะไร, ต้องทำต่อ |
| 3 | `/fyi <info>` | ❌ ไม่มี | บันทึกข้อมูลลง memory — auto-tag, auto-category, บันทึกเป็น memory entry |
| 4 | `/rrr` | ❌ ไม่มี | Retrospective จบวัน — สรุปทั้งวันจาก memories+messages+tasks, บันทึก learnings |
| 5 | `/standup` | ⚠️ stub | Daily standup — ดึง tasks pending + ทำอะไรเมื่อวาน + blockers |
| 6 | `/feel <mood>` | ⚠️ stub | บันทึกอารมณ์ — เก็บ mood entry, ปรับการทำงานตาม mood |
| 7 | `/forward` | ⚠️ partial | Handoff to next session — สร้าง handoff file ใน ψ/inbox/, บันทึก context |
| 8 | `/trace [query]` | ⚠️ partial | ค้นหาข้อมูลจากทุกที่ — ค้นใน git log + grep files + SQLite memory + traces |
| 9 | `/trace --deep` | ❌ ไม่มี | Deep trace mode — ค้นเชิงลึก, วิเคราะห์ dependencies, สร้าง graph |
| 10 | `/learn [repo]` | ⚠️ partial | ศึกษา repo — git clone shallow, อ่าน README+package.json+key files, สร้าง summary |
| 11 | `/who-are-you` | ❌ ไม่มี | แสดง Oracle identity — อ่าน identity.md, แสดง persona+principles+history |

### Batch 2: ดึง External Tools เข้ามาใช้

| # | Tool | ที่มา | ต้องทำ |
|---|---|---|---|
| 12 | **oracle-skills-cli** | https://github.com/Soul-Brews-Studio/arra-oracle-skills-cli | Clone มา, ดูว่ามี skills อะไรบ้าง (30+), ปรับแต่ละ skill ให้ทำงานใน oracle-multi-agent ได้ (ไม่ต้องพึ่ง Claude Code), สร้างเป็น plugins หรือ commands |
| 13 | **oracle-v2 (memory core)** | https://github.com/Soul-Brews-Studio/arra-oracle-v3 | ดู MCP server architecture, ดึง memory patterns มาใช้, เชื่อมกับ memory system ของเรา |
| 14 | **maw-js** | `_ref/maw-js/` | ดู transport + fleet + CLI patterns, ดึงมาใช้กับ fleet commands ของเรา |
| 15 | **oracle-vault-report** | `_ref/vault-report/` | Integrate เข้า dashboard — สร้างหน้า Vault แสดง stats: repo count, file count, skills, sync status |
| 16 | **pulse-cli** | ดูจากคู่มือ | สร้าง CLI standalone สำหรับ project board — connect GitHub Issues, timeline, task assignment |
| 17 | **multi-agent-workflow-kit** | `_ref/workflow-kit/` | ดู Python patterns, แปลงมาเป็น TypeScript implementations |
| 18 | **claude-code-statusline** | https://github.com/nazt/claude-code-statusline | สร้าง status line สำหรับ terminal — แสดงเวลา, project, agent, context usage |
| 19 | **หนังสือ "รูปสอนสุญญตา"** | https://book.buildwithoracle.com | ดึง 5 principles มาใส่ใน Oracle identity system, ใช้เป็น foundation ของ /awaken |

### Batch 3: Semantic Search (เปลี่ยน TF-IDF เป็น Embedding จริง)

| # | Task | ต้องทำ |
|---|---|---|
| 20 | **Install embedding model** | ใช้ `@xenova/transformers` (all-MiniLM-L6-v2) หรือ Ollama embeddings — ไม่ต้อง external server |
| 21 | **Replace vector store** | แก้ `src/memory/vector/factory.ts` — ใช้ real embeddings แทน TF-IDF |
| 22 | **Update search tool** | แก้ `src/memory/tools/search.ts` — hybrid search: FTS5 keyword + vector semantic |

### Batch 4: ψ/ Structure & Oracle Vault

| # | Task | ต้องทำ |
|---|---|---|
| 23 | **ψ/ structure** | สร้างโครงสร้างครบ: inbox/, memory/, writing/, lab/, outbox/, sessions/, traces/, threads/ |
| 24 | **Vault API** | สร้าง API สำหรับจัดการ ψ/ — list, read, write, search |
| 25 | **Vault dashboard** | สร้างหน้า Vault ใน dashboard แสดง content ทั้งหมด |

### Batch 5: VPS & Production

| # | Task | ต้องทำ |
|---|---|---|
| 26 | **VPS deploy guide** | สร้าง docs/VPS-DEPLOY.md — Ubuntu setup, PM2, nginx reverse proxy, tmux |
| 27 | **systemd service** | สร้าง oracle-multi-agent.service สำหรับ auto-start |
| 28 | **Docker** | สร้าง Dockerfile + docker-compose.yml |

### Batch 6: Integration & Testing

| # | Task | ต้องทำ |
|---|---|---|
| 29 | **End-to-end test** | ทดสอบ spawn → chat → memory → search → dashboard ทั้งหมด |
| 30 | **API test suite** | สร้าง test สำหรับทุก endpoint |
| 31 | **README update** | อัพเดท README.md ให้ตรงกับสถานะปัจจุบัน |

## Architecture

```
src/
├── index.ts                 ← Hono entry (port 3456)
├── api/
│   ├── agent-bridge.ts      ← /api/agents CRUD
│   ├── memory-bridge.ts     ← /api/v2/memory/*
│   └── index.ts             ← API router (34 endpoints)
├── agents/
│   ├── manager.js           ← AgentManager: spawn, stop, chat
│   ├── worker.js            ← Agent child process
│   ├── *-client.js          ← LLM clients (gemini, mimo, promptdee)
│   └── definitions/         ← 19 agent .md definitions
├── commands/                ← 64 CLI commands
├── memory/
│   ├── store.js             ← SQLite store
│   ├── tools/               ← 16 memory tools
│   └── vector/              ← Vector store (currently TF-IDF)
├── transports/              ← 6 transports
├── dashboard/
│   ├── public/              ← Static HTML
│   └── src/                 ← React 19 SPA
├── plugins/                 ← Plugin system
└── federation/              ← Multi-machine
_ref/                        ← Reference repos (maw-js, vault-report, etc.)
ψ/                           ← Oracle Vault
```

## How to Run

```bash
git pull origin main && npm install && npx tsx src/index.ts
```

## How to Push

```bash
git add -A && git commit -m "message"
git remote set-url origin https://dmz2001TH:TOKEN@github.com/dmz2001TH/oracle-multi-agent.git
git push origin main
git remote set-url origin https://github.com/dmz2001TH/oracle-multi-agent.git
```

## หลักการ Oracle (5 ข้อ)

1. Nothing is Deleted — จดทุกอย่าง ไม่ลบ
2. Patterns Over Intentions — ดูสิ่งที่เกิดขึ้นจริง
3. External Brain, Not Command — AI สะท้อน ไม่สั่ง
4. Curiosity Creates Existence
5. Form and Formless — หลาย Oracle หนึ่งจิตสำนึก

## ⚠️ สิ่งที่ต้องรู้ (Known Fixes)

- **WebSocket path**: dashboard ต้องเชื่อม `ws://host/ws` ไม่ใช่ `ws://host` (แก้แล้วใน public/index.html)
- **API routes ซ้ำซ้อน**: มีทั้ง `api` router (src/api/index.ts) และ `agentBridgeApi` (src/api/agent-bridge.ts) — ตรวจสอบไม่ให้ route ชนกัน
- **Dashboard = public/index.html**: ระบบใช้ static HTML (React CDN) ไม่ใช่ Vite build — แก้ไขที่ public/index.html โดยตรง
- **Agent ไม่ running**: agents จาก database แสดง `running: false` จนกว่าจะ spawn ผ่าน API — WebSocket ต้องส่ง `init` message พร้อม agents list
