# 🤖 PROMPT สำหรับ AI Agent ตัวใหม่

คัดลอกทั้งหมดใน code block ด้านล่าง วางให้ AI agent ตัวใหม่ได้เลย

---

```
คุณกำลังสานต่อโปรเจ็ค oracle-multi-agent v5.0
Repo: https://github.com/dmz2001TH/oracle-multi-agent
Working dir: clone แล้ว cd เข้าไป

════════════════════════════════════════════
บทบาทของคุณ
════════════════════════════════════════════

คุณเป็น AI agent ที่ดูแลโปรเจ็คนี้ต่อจาก agent ตัวก่อน
งานของคุณ: ดูแลระบบ + แก้บั๊ก + เพิ่มฟีเจอร์ตามที่เจ้าของสั่ง

════════════════════════════════════════════
สถานะปัจจุบัน: 31/31 tasks ✅ เสร็จหมดแล้ว
════════════════════════════════════════════

ทุกอย่างที่ HANDOFF.md สั่งทำเสร็จหมดแล้ว
อ่าน HANDOFF.md เพื่อดูรายละเอียดสถานะแต่ละ task

════════════════════════════════════════════
ขั้นตอนแรก (อ่านก่อนทำงานทุกครั้ง)
════════════════════════════════════════════

1. git pull origin main (ดึงโค้ดล่าสุด)
2. อ่าน HANDOFF.md — สถานะ tasks ทั้งหมด
3. อ่าน src/index.ts — entry point (Hono server, WebSocket, static files, routing)
4. อ่าน src/commands/index.ts — CLI commands ทั้ง 16 ตัว
5. อ่าน src/api/index.ts — API routers 35+ endpoints
6. อ่าน src/api/agent-bridge.ts — Agent API (spawn, chat, stop)
7. อ่าน src/agents/manager.js — AgentManager + AGENT_ROLES
8. อ่าน public/index.html — Dashboard (static HTML, WebSocket)
9. อ่าน public/vault.html — Vault dashboard
10. อ่าน test/e2e.mjs — E2E tests (25/25 passed)

════════════════════════════════════════════
สิ่งที่มีอยู่แล้ว (อย่าสร้างซ้ำ)
════════════════════════════════════════════

## CLI Commands (16 ตัว)

ทุกคำสั่งอยู่ใน src/commands/index.ts
ส่งผ่าน API: POST /api/commands/execute {"input": "/command args"}

| Command | Description | Location |
|---------|-------------|----------|
| /awaken | Identity setup ceremony (name|element|role|motto) | commands/index.ts |
| /recap | Session summary (days) | commands/index.ts |
| /fyi <info> | Save to memory + ψ/ | commands/index.ts |
| /rrr | Daily retrospective (good|improve|action) | commands/index.ts |
| /standup | Daily standup (yesterday|today|blocker) | commands/index.ts |
| /feel <mood> | Mood logger | commands/index.ts |
| /forward | Session handoff | commands/index.ts |
| /trace <query> | Universal search (--deep: code+git+deps) | commands/index.ts |
| /learn [repo] | Study repository (clone+analyze) | commands/index.ts |
| /who-are-you | Oracle identity | commands/index.ts |
| /philosophy | 5 Principles + Rule 6 | commands/index.ts |
| /skills | List/search 55 skills | commands/index.ts |
| /resonance | Capture what resonates | commands/index.ts |
| /fleet | Fleet census (agents, nodes, skills, --deep) | commands/index.ts |
| /pulse | Project board (add/done/list tasks) | commands/index.ts |
| /workflow | Multi-agent workflow templates (list/show) | commands/index.ts |

## API Endpoints

ทุก endpoint อยู่ใน src/api/*.ts

Core:
- GET  /health                          — Health check
- GET  /api/commands                    — List CLI commands
- POST /api/commands/execute            — Execute CLI command
- POST /api/commands/:name              — Execute by name

Skills & Knowledge:
- GET  /api/skills                      — List/search 55 skills
- GET  /api/skills/:name                — Get skill details
- GET  /api/vault/stats                 — ψ/ directory statistics
- GET  /api/vault/files                 — List ψ/ files
- GET  /api/vault/file                  — Read ψ/ file
- POST /api/vault/search                — Search ψ/ files

Workflows:
- GET  /api/workflows                   — List workflow templates
- GET  /api/workflows/:name             — Get template details

Agents:
- GET  /api/v2/agents                   — List agents
- POST /api/v2/agents/spawn             — Spawn agent
- POST /api/v2/agents/:id/chat          — Chat with agent
- GET  /api/v2/memory/search            — Search memory
- GET  /api/v2/memory/stats             — Memory stats
- POST /api/v2/agents/broadcast         — Broadcast to all agents

Legacy (src/api/index.ts):
- 20+ more endpoints (sessions, tasks, projects, cron, federation, etc.)

## Dashboard

- http://localhost:3456 — Main dashboard (public/index.html)
  - Sidebar: Agent list + spawn button
  - Chat: คุยกับ agent หรือพิมพ์ /command
  - Right panel: Stats, commands list, event log
- http://localhost:3456/vault — Vault dashboard (public/vault.html)
  - ψ/ stats, search, skills overview, 5 principles
- http://localhost:3456/favicon.ico — Redirects to /favicon.svg

## ψ/ Knowledge Root

โครงสร้าง memory ที่ dual-write จาก CLI commands:
ψ/
├── memory/
│   ├── journal/         — Daily journal entries (/fyi)
│   ├── resonance/       — What resonates (/resonance)
│   ├── retrospectives/  — RRR entries (/rrr)
│   ├── handoffs/        — Session handoffs (/forward)
│   ├── mood/            — Mood tracking (/feel)
│   ├── traces/          — Deep trace logs (/trace --deep)
│   └── pulse/           — Project tasks (/pulse)

## Skills Registry (55 skills)

อยู่ใน src/skills/registry.ts
Categories: identity, session, memory, emotion, dev, github, team, research, automation, meta
Source: adapted from oracle-skills-cli

## 5 Principles (รูปสอนสุญญตา)

Source: https://book.buildwithoracle.com
1. สร้างใหม่ ไม่ลบ (Nothing is Deleted)
2. ดูสิ่งที่เกิดขึ้นจริง (Patterns Over Intentions)
3. เป็นกระจก ไม่ใช่เจ้านาย (External Brain, Not Command)
4. ความอยากรู้สร้างการมีอยู่ (Curiosity Creates Existence)
5. รูป และ สุญญตา (Form and Formless)
Rule 6: ความโปร่งใส — "Oracle ไม่แกล้งทำเป็นคน"

## Workflow Patterns (5 patterns)

อยู่ใน src/workflows/index.ts
- sequential: Agent A → B → C
- parallel: Agent A + B + C → merge
- fan-out: Split → distribute → collect
- review: Do → review → fix
- pipeline: Chain of transformations
Templates: research-report, code-review, parallel-analysis, translate-verify, deploy-pipeline

## Semantic Search

- @xenova/transformers ติดตั้งแล้ว
- src/memory/vector/xenova-embedding.ts — Real embedding provider
- src/memory/vector/factory.ts — Cosine similarity + TF-IDF fallback
- Default model: Xenova/all-MiniLM-L6-v2 (384-dim)

## External References

_ref/skills-cli/ — 55 skills from oracle-skills-cli
_ref/oracle-v3/ — Memory patterns from oracle-v3
_ref/claude-code-statusline/ — Terminal statusline patterns
_ref/maw-js/ — Fleet patterns (empty dir, patterns already adapted)
_ref/vault-report/ — Vault patterns (already adapted)
_ref/workflow-kit/ — Workflow patterns (empty dir, patterns already built)

## E2E Tests

test/e2e.mjs — 25/25 passed
Tests: health, commands, skills, vault, agents, dashboard, workflows

## Deploy

docs/DEPLOY.md — systemd, Docker, Docker Compose, Nginx reverse proxy
scripts/statusline.sh — Terminal status bar (source it in .bashrc)

## Terminal Statusline

scripts/statusline.sh — แสดง: dir • git branch • agents • uptime • mem
Usage: bash scripts/statusline.sh หรือ source scripts/statusline.sh

════════════════════════════════════════════
วิธีรัน
════════════════════════════════════════════

```bash
git pull origin main
npm install
npx tsx src/index.ts
# เปิด http://localhost:3456
```

════════════════════════════════════════════
วิธีเทส
════════════════════════════════════════════

```bash
# Terminal 1: เริ่ม server
npx tsx src/index.ts

# Terminal 2: รัน E2E tests
npx tsx test/e2e.mjs

# หรือเทสแบบ manual
curl -s http://localhost:3456/health | python3 -m json.tool
curl -s -X POST http://localhost:3456/api/commands/execute \
  -H 'Content-Type: application/json' \
  -d '{"input":"/help"}' | python3 -m json.tool
```

════════════════════════════════════════════
วิธีอัพ GitHub
════════════════════════════════════════════

```bash
git add -A
git commit -m "descriptive message"
git remote set-url origin https://dmz2001TH:TOKEN@github.com/dmz2001TH/oracle-multi-agent.git
git push origin main
git remote set-url origin https://github.com/dmz2001TH/oracle-multi-agent.git
```

TOKEN = เจ้าของจะส่งทาง chat ทุกครั้งตอน push
อย่า commit token ลง repo เด็ดขาด

════════════════════════════════════════════
สไตล์การทำงานกับเจ้าของโปรเจ็ค
════════════════════════════════════════════

- คุยภาษาไทย ตอบภาษาไทย
- สั้น ตรง ไม่อ้อมค้อม — ทำเลยไม่ต้องถามเยอะ
- แก้เสร็จ → commit + push + อัพเดท HANDOFF.md ทุกครั้ง
- ส่งคำสั่ง git pull + restart ให้เจ้าของทำตาม
- Token ส่งทาง chat ตอน push อย่า commit ลง repo
- เจ้าของดูผลที่ http://localhost:3456
- อย่าให้เหตุการณ์ "ลืมอัพเดทไฟล์" เกิดขึ้นอีก — อัพเดททุกไฟล์ที่เกี่ยวข้อง

════════════════════════════════════════════
สำคัญ (อ่านทุกข้อ)
════════════════════════════════════════════

1. หลักการ: "Nothing is Deleted" — ไม่ลบโค้ดเก่า แต่ปรับปรุงแทน
2. Dashboard = public/index.html (static HTML) — แก้ไขที่นี่โดยตรง ไม่ใช่ Vite build
3. WebSocket path ต้องเป็น /ws — อย่าเผลอลบ
4. มี API routers หลายตัว (src/api/index.ts + agent-bridge.ts + ไฟล์อื่น) — ระวัง route ชน
5. TypeScript compile ต้องผ่าน: npx tsc --noEmit
6. E2E tests ต้องผ่าน: npx tsx test/e2e.mjs
7. อย่า commit token ลง repo เด็ดขาด
8. รัน E2E tests ก่อน push ทุกครั้ง
9. อัพเดท HANDOFF.md ทุกครั้งที่ทำอะไรเสร็จ
10. อัพเดททุกไฟล์ที่เกี่ยวข้อง — อย่าให้เจ้าของต้องมาทวง

════════════════════════════════════════════
Architecture Overview
════════════════════════════════════════════

```
src/
├── index.ts                  ← Hono server (port 3456) + WebSocket + routing
├── commands/index.ts         ← 16 CLI commands (awaken, recap, fyi, etc.)
├── skills/registry.ts        ← 55 skills from oracle-skills-cli
├── workflows/index.ts        ← 5 workflow patterns + templates
├── knowledge/                ← 5 Principles from รูปสอนสุญญตา
├── api/
│   ├── index.ts              ← API router (registers all sub-routers)
│   ├── agent-bridge.ts       ← Agent API (spawn, chat, stop, memory)
│   ├── commands.ts           ← Commands API
│   ├── skills.ts             ← Skills API
│   ├── vault.ts              ← Vault API (ψ/ scanner)
│   ├── workflows.ts          ← Workflows API
│   └── *.ts                  ← 20+ more API routers
├── agents/
│   ├── manager.js            ← AgentManager (spawn, stop, chat, roles)
│   ├── worker.js             ← Agent child process
│   ├── definitions/*.md      ← 19 agent definitions
│   └── *-client.js           ← LLM clients (gemini, mimo, promptdee)
├── memory/
│   ├── vector/factory.ts     ← Vector store (real embeddings + TF-IDF)
│   ├── vector/xenova-embedding.ts ← @xenova/transformers provider
│   ├── tools/search.ts       ← Hybrid FTS5 + vector search
│   └── tools/*.ts            ← 16 memory tools
└── ...

public/
├── index.html                ← Main dashboard (agents, chat, commands)
└── vault.html                ← Vault dashboard (ψ/, skills, principles)

scripts/
└── statusline.sh             ← Terminal status bar

test/
└── e2e.mjs                   ← E2E tests (25/25)

ψ/                            ← Knowledge root (memory, traces, pulse)
_ref/                         ← Reference repos (skills-cli, oracle-v3, etc.)
docs/
├── DEPLOY.md                 ← VPS deploy guide
└── HOW-TO-ADD-AGENTS.md      ← Agent adding guide
```
```
