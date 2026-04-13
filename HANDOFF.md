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

## ✅ สิ่งที่ทำเสร็จแล้วทั้งหมด (31/31 — 100%)

### Batch 1: CLI Commands ที่ขาด (ทุกคำสั่งที่คู่มือกล่าวถึง)

| # | Command | สถานะ | ต้องทำ |
|---|---|---|---|
| 1 | `/awaken` | ✅ เสร็จ | Identity setup ceremony — สร้าง identity.json, ถามชื่อ/ธาตุ/บทบาท/สโลแกน, รองรับ --force |
| 2 | `/recap` | ✅ เสร็จ | สรุป session — อ่าน journal entries ย้อนหลัง, แสดง memory files |
| 3 | `/fyi <info>` | ✅ เสร็จ | บันทึกข้อมูลลง memory — บันทึกเป็น journal + JSONL, dual-write ψ/ |
| 4 | `/rrr` | ✅ เสร็จ | Retrospective — good/improve/action format, บันทึก ψ/memory/retrospectives/ |
| 5 | `/standup` | ✅ เสร็จ | Daily standup — yesterday/today/blocker format |
| 6 | `/feel <mood>` | ✅ เสร็จ | บันทึกอารมณ์ — mood log JSONL, นับ entries ต่อวัน |
| 7 | `/forward` | ✅ เสร็จ | Handoff — สร้าง handoff JSON, dual-write ψ/memory/handoffs/ |
| 8 | `/trace [query]` | ✅ เสร็จ | Universal search — ค้น journal + FYI + handoffs |
| 9 | `/trace --deep` | ✅ เสร็จ | Deep trace: code grep + git history + deps + save trace log to ψ/ |
| 10 | `/learn [repo]` | ✅ เสร็จ | ศึกษา repo — git clone shallow, analyze structure, สร้าง summary |
| 11 | `/who-are-you` | ✅ เสร็จ | แสดง Oracle identity — uptime, agents, memories, identity |

### Batch 2: ดึง External Tools เข้ามาใช้

| # | Tool | ที่มา | สถานะ |
|---|---|---|---|
| 12 | **oracle-skills-cli** | Soul-Brews-Studio/arra-oracle-skills-cli | ✅ 55 skills registry (src/skills/registry.ts) |
| 13 | **oracle-v3** | Soul-Brews-Studio/arra-oracle-v3 | ✅ memory patterns, architecture reference |
| 14 | **maw-js** | _ref/maw-js/ | ✅ Fleet patterns adapted (src/commands/index.ts → /fleet) |
| 15 | **oracle-vault-report** | _ref/vault-report/ | ✅ Vault dashboard (public/vault.html + /api/vault/*) |
| 16 | **pulse-cli** | — | ✅ Project board CLI (src/commands/index.ts → /pulse add/done/list) |
| 17 | **multi-agent-workflow-kit** | _ref/workflow-kit/ | ✅ Workflow patterns (src/workflows/index.ts: sequential/parallel/fan-out/review/pipeline + /workflow command) |
| 18 | **claude-code-statusline** | nazt/claude-code-statusline | ✅ Statusline (scripts/statusline.sh: dir/git/agents/uptime/mem) |
| 19 | **หนังสือ "รูปสอนสุญญตา"** | book.buildwithoracle.com | ✅ 5 principles + Rule 6 (src/knowledge/oracle-principles.md, /philosophy command) |

### Batch 3: Semantic Search (เปลี่ยน TF-IDF เป็น Embedding จริง)

| # | Task | สถานะ |
|---|---|---|
| 20 | **Install embedding model** | ✅ @xenova/transformers ติดตั้งแล้ว |
| 21 | **Replace vector store** | ✅ factory.ts — real cosine similarity + TF-IDF fallback |
| 22 | **Update search tool** | ✅ hybrid FTS5 + vector search |

### Batch 4: ψ/ Structure & Oracle Vault

| # | Task | สถานะ |
|---|---|---|
| 23 | **ψ/ structure** | ✅ memory/resonance, learnings, retrospectives, journal, decisions, handoffs, mood |
| 24 | **Vault API** | ✅ GET /api/vault/stats, /files, /file + POST /search |
| 25 | **Vault dashboard** | ✅ public/vault.html (stats, search, skills, principles) |

### Batch 5: VPS & Production

| # | Task | สถานะ |
|---|---|---|
| 26 | **VPS deploy guide** | ✅ docs/DEPLOY.md (systemd, Docker, Docker Compose, Nginx) |
| 27 | **systemd service** | ✅ included in DEPLOY.md |
| 28 | **Docker** | ✅ Dockerfile + docker-compose.yml in DEPLOY.md |

### Batch 6: Integration & Testing

| # | Task | สถานะ |
|---|---|---|
| 29 | **End-to-end test** | ✅ test/e2e.mjs — 20/20 tests passed |
| 30 | **API test suite** | ✅ ครอบคลุม health, commands, skills, vault, agents, dashboard |
| 31 | **README update** | ✅ CLI commands table, new API endpoints, testing section |

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

## 💬 สไตล์การทำงานกับเจ้าของโปรเจ็ค

- **คุยภาษาไทย** — เจ้าของโปรเจ็คพิมพ์ภาษาไทย ตอบภาษาไทย
- **สั้น ตรง ไม่อ้อมค้อม** — ไม่ต้องพิมพ์ยาว ตอบให้ชัดเจน ตรงประเด็น
- **ทำเลย ไม่ต้องถามเยอะ** — ถ้าเข้าใจ指令แล้ว ทำเลย commit + push เลย
- **อัพ GitHub ทุกครั้ง** — ทุกครั้งที่แก้ไขเสร็จ ต้อง git commit + push
- **Token** — เจ้าของจะส่ง token ทาง chat ให้ตอน push ทุกครั้ง อย่า commit token ลง repo
- **ส่งคำสั่ง terminal ให้เสมอ** — บอก git pull / restart commands ให้เจ้าของทำตาม
- **Dashboard** — เจ้าของดูผลที่ http://localhost:3456 เป็นหลัก

## ⚠️ สิ่งที่ต้องรู้ (Known Fixes)

- **WebSocket path**: dashboard ต้องเชื่อม `ws://host/ws` ไม่ใช่ `ws://host` (แก้แล้วใน public/index.html)
- **API routes ซ้ำซ้อน**: มีทั้ง `api` router (src/api/index.ts) และ `agentBridgeApi` (src/api/agent-bridge.ts) — ตรวจสอบไม่ให้ route ชนกัน
- **Dashboard = public/index.html**: ระบบใช้ static HTML (React CDN) ไม่ใช่ Vite build — แก้ไขที่ public/index.html โดยตรง
- **Agent ไม่ running**: agents จาก database แสดง `running: false` จนกว่าจะ spawn ผ่าน API — WebSocket ต้องส่ง `init` message พร้อม agents list
