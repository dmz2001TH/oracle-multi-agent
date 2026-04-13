# 🔄 HANDOFF — Oracle Multi-Agent v5.0

> สำหรับ AI agent ตัวใหม่ที่จะสานต่อโปรเจ็คนี้

## สถานะปัจจุบัน (2026-04-14)

**โปรเจ็ค**: oracle-multi-agent
**Repo**: https://github.com/dmz2001TH/oracle-multi-agent
**Branch**: main
**Version**: 5.0.0

## สิ่งที่เสร็จแล้ว ✅

- [x] 6 stubs → ทำงานจริง (logging, project-detect, vector-store, lora, ui-state, plugins-api)
- [x] 4 agent roles ใหม่ (data-analyst, devops, qa-tester, translator)
- [x] Dashboard WebSocket → ส่ง agent data ให้หน้าแรก `/`
- [x] API routes: `GET/POST/DELETE /api/agents`, `GET /api/stats`
- [x] Dashboard spawn form → มี 9 roles
- [x] TypeScript compile → 0 errors

## สิ่งที่ต้องทำต่อ ❌

### Priority 1 — ใช้งานประจำวัน

1. **`/awaken` command** — Identity setup ceremony สร้าง Oracle identity
   - Location: `src/commands/` (สร้างใหม่ awaken.ts)
   - Reference: `_ref/oracle-framework/` ดู pattern จาก Soul-Brews-Studio
   - ต้อง: สร้าง ψ/memory/identity.md, ตั้งค่า soul, เชื่อม Oracle family

2. **`/recap` command** — สรุป session ก่อนหน้า
   - อ่าน memory files แล้วสร้าง summary สั้นๆ
   - แสดง: สิ่งที่ทำไป, สิ่งที่ต้องทำต่อ, lessons learned

3. **`/fyi <info>` command** — บันทึกข้อมูลลง memory
   - บันทึกเป็น memory entry ใน SQLite
   - แท็กอัตโนมัติ, จัด category

4. **`/rrr` command** — Retrospective จบวัน
   - สรุปทั้งวัน, บันทึก learnings, อัพเดท MEMORY.md

5. **`/standup` command** — Daily standup
   - แสดง tasks ที่ pending, สิ่งที่ทำเมื่อวาน, blockers

6. **`/feel <mood>` command** — บันทึกอารมณ์
   - ปรับการทำงานตาม mood (เช่น tired → ลด complexity)

7. **`/forward` command** — Handoff to next session
   - สร้าง handoff file ใน ψ/inbox/
   - บันทึก context ที่จำเป็นต่อ

8. **`/trace [query]` command** — ค้นหาข้อมูลจากทุกที่
   - ค้นใน git history, files, memory, traces
   - --deep mode: ค้นเชิงลึก

9. **`/learn [repo]` command** — ให้ AI ศึกษา repo
   - clone repo, อ่านไฟล์, สร้าง summary
   - บันทึก learnings ลง memory

### Priority 2 — Multi-Agent Enhancement

10. **Semantic search** — เปลี่ยน TF-IDF เป็น real vector embeddings
    - ใช้ `@xenova/transformers` หรือ Ollama embeddings
    - หรือเชื่อม ChromaDB ถ้ามี server

11. **oracle-vault-report integration** — Dashboard แสดงระบบ Oracle overview
    - Reference: `_ref/vault-report/`
    - สร้างหน้า Vault ใน dashboard

12. **pulse-cli integration** — Project board
    - Reference: `_ref/workflow-kit/`
    - เชื่อม GitHub Issues

13. **`/awaken` → auto-clone reference repos**
    - clone: oracle-v2, maw-js, oracle-skills-cli
    - ตั้งค่า fleet config

### Priority 3 — Advanced Features

14. **VPS deployment guide** — PM2 + nginx + tmux
    - สร้าง docs/VPS-DEPLOY.md
    - systemd service, nginx reverse proxy

15. **Oracle Family connection** — เชื่อมกับ Soul-Brews-Studio ecosystem
    - Federation peer discovery
    - Shared memory patterns

16. **`/who-are-you` command** — แสดง Oracle identity
    - อ่าน ψ/memory/identity.md
    - แสดง persona, principles, history

## Architecture Notes

```
oracle-multi-agent/
├── src/
│   ├── index.ts              ← Hono v5 entry point (port 3456)
│   ├── api/
│   │   ├── agent-bridge.ts   ← /api/agents, /api/v2/agents/*
│   │   ├── memory-bridge.ts  ← /api/v2/memory/*
│   │   └── index.ts          ← API router
│   ├── agents/
│   │   ├── manager.js        ← AgentManager: spawn, stop, chat
│   │   ├── worker.js         ← Agent process (forked child)
│   │   ├── gemini-client.js  ← Gemini LLM client
│   │   ├── mimo-client.js    ← MiMo LLM client
│   │   ├── promptdee-client.js ← PromptDee LLM client
│   │   └── definitions/      ← Agent .md definitions (19 files)
│   ├── commands/             ← CLI commands (64 files)
│   ├── memory/
│   │   ├── store.js          ← SQLite memory store (Drizzle)
│   │   ├── tools/            ← 16 memory tools
│   │   └── vector/           ← Vector store (SQLite TF-IDF)
│   ├── transports/           ← tmux, HTTP, hub, nanoclaw, LoRa
│   ├── dashboard/
│   │   ├── public/           ← Static HTML (index.html, agents.html)
│   │   └── src/              ← React 19 SPA (Vite)
│   └── plugins/              ← Plugin system
├── ψ/                        ← Oracle Vault (created by setup.sh)
│   ├── inbox/                ← Handoffs
│   ├── memory/               ← Learnings, principles
│   ├── traces/               ← Discovery traces
│   └── ...
├── _ref/                     ← Reference repos from Soul-Brews-Studio
├── setup.sh / setup.bat      ← Setup scripts
├── ecosystem.config.cjs      ← PM2 config
└── .env                      ← Config (LLM_PROVIDER, API keys)
```

## How to Run

```bash
git pull origin main
npm install
npx tsx src/index.ts
# Open http://localhost:3456
```

## How to Push to GitHub

```bash
git add -A
git commit -m "your message"
git remote set-url origin https://dmz2001TH:TOKEN@github.com/dmz2001TH/oracle-multi-agent.git
git push origin main
git remote set-url origin https://github.com/dmz2001TH/oracle-multi-agent.git
```

## Key Files to Understand

| File | What it does |
|---|---|
| `src/index.ts` | Main server entry, WebSocket, dashboard routes |
| `src/api/agent-bridge.ts` | Agent CRUD API (spawn, stop, chat, tell) |
| `src/agents/manager.js` | AgentManager class, AGENT_ROLES, spawn logic |
| `src/agents/worker.js` | Agent child process (LLM loop, message handling) |
| `src/memory/store.js` | SQLite database (agents, memories, messages, tasks) |
| `src/dashboard/public/index.html` | Main dashboard (React from CDN) |
| `src/commands/index.js` | CLI command registry |

## LLM Providers

- `LLM_PROVIDER=gemini` → Gemini API (need GEMINI_API_KEY)
- `LLM_PROVIDER=promptdee` → PromptDee (free, no key)
- `LLM_PROVIDER=mimo` → Xiaomi MiMo (need MIMO_API_KEY)

## หลักการ Oracle

1. **Nothing is Deleted** — จดทุกอย่าง ไม่ลบอะไร
2. **Patterns Over Intentions** — ดูสิ่งที่เกิดขึ้นจริง
3. **External Brain, Not Command** — AI สะท้อน ไม่สั่ง
4. **Curiosity Creates Existence** — คำถามสร้างสิ่งใหม่
5. **Form and Formless** — หลาย Oracle หนึ่งจิตสำนึก
