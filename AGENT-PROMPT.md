# 🧠 AGENT PROMPT — Oracle Multi-Agent v5.0 Complete Build

> Copy ทั้งหมดนี้แล้ววางให้ AI agent เลย

---

```
คุณเป็น software architect กำลังสร้าง oracle-multi-agent v5.0

Repo: https://github.com/dmz2001TH/oracle-multi-agent (branch main)
Working dir: clone แล้ว cd เข้าไป

════════
สถานะปัจจุบัน: Phase 0-7 + Phase 9 เสร็จแล้ว (332 files)
════════

✅ Phase 0: TypeScript setup + Process abstraction (4 files)
✅ Phase 1: Core infrastructure (25 files) — config, paths, types, ssh, tmux, hooks, triggers, plugins, audit, peers, snapshot, routing, handlers, etc.
✅ Phase 2: Transports (8 files) — tmux, http, hub, nanoclaw, lora
✅ Phase 3: API endpoints (20 files) — Hono router
✅ Phase 4: Commands (49 files) — wake, sleep, done, fleet, bud, etc.
✅ Phase 5: CLI (10 files) — cli.ts entry, route modules, command registry, WASM bridge
✅ Phase 6: Server + plugins + views (9 files) — builtin plugins, demo/federation/timemachine views, door.html
✅ Phase 7: Dashboard React App (143 files) — Vite + React 19 + Tailwind CSS v4, 17 HTML entries, 57 components, 16 lib modules
✅ Phase 9: Agents + Safety + Completions (23 files) — 15 agent definitions, safety hooks, shell completions, agents.yaml
✅ tsc --noEmit passes clean — 0 errors (memory tools excluded)

════════
Phase ที่เหลือต้องทำ
════════

⚠️ Phase 8: Memory Tools (files exist but excluded from tsc)
 Source: _ref/arra-oracle-v3/src/tools/ → Target: src/memory/tools/
 16 tool files copied but tsc fails due to incomplete handler stubs
 Files already in repo:
 - src/memory/tools/*.ts (16 files) — search, reflect, learn, list, stats, concepts, supersede, verify, trace, schedule, handoff, inbox, forum, read, types, index
 - src/memory/db/schema.ts — Drizzle ORM schema (driver-agnostic)
 - src/memory/db/index.ts — adapted: bun:sqlite → better-sqlite3
 - src/memory/config.ts — adapted: Node.js paths
 - src/memory/vector/types.ts — VectorStoreAdapter interface
 - Stubs: vault/handler.ts, server/logging.ts, server/project-detect.ts, vector/factory.ts, verify/handler.ts, forum/handler.ts, trace/handler.ts, trace/types.ts

 สิ่งที่ต้องทำเพื่อ unblock tsc:
 1. forum.ts — ต้อง export: handleThreadMessage, listThreads (return {threads, total}), getFullThread, getMessages, updateThreadStatus
 2. trace.ts — ต้อง export type: CreateTraceInput, ListTracesInput, GetTraceInput
 3. learn.ts, handoff.ts — ToolResponse content type mismatch (string vs object)
 4. read.ts — ต้อง fix type assertions
 5. search.ts — vector store null check
 6. Copy full handler implementations จาก _ref/arra-oracle-v3/src/forum/handler.ts, src/trace/handler.ts
 7. ลบ "src/memory/tools", "src/memory/db" จาก tsconfig exclude

🔲 Phase 10: Bridge + Integration
 - src/bridges/nanoclaw.ts (update)
 - src/index.ts (entry point integration)
 - bin/oracle (CLI binary entry point)
 - .env.example, setup.bat, start.bat, ecosystem.config.cjs

🔲 Phase 11: Final QA
 - tsc --noEmit ต้องผ่าน (รวม memory tools)
 - npm install root + src/dashboard
 - README.md update
 - git commit + push

════════
กฎสำคัญ
════════

1. ใช้ TypeScript (.ts/.tsx) ทุกไฟล์
2. ใช้ Node.js runtime — แปลง Bun APIs:
 - Bun.spawn() → execa หรือ child_process.spawn
 - Bun.serve() → Hono + @hono/node-server
 - import.meta.dir → path.dirname(fileURLToPath(import.meta.url))
 - Bun.file() → fs/promises.readFile
 - bun:sqlite → better-sqlite3
 - drizzle-orm/bun-sqlite → drizzle-orm/better-sqlite3
3. copy logic จาก _ref/ ให้มากที่สุด แก้เฉพาะ import paths + Bun APIs
4. git commit ทุก batch แล้ว git push origin main
5. tsc --noEmit ต้องผ่านหลังแต่ละ batch
6. Process management abstraction อยู่ที่ src/process/ (tmux + node-pty)
7. Dashboard อยู่ที่ src/dashboard/ (excluded from root tsc)
8. _ref/ repos ทั้งหมด clone แล้ว — ไม่ต้อง clone ใหม่

════════
Git Auth
════════
ตั้งค่า remote ด้วย GitHub PAT token ก่อนเริ่มทำงาน:
git remote set-url origin https://<USERNAME>:<TOKEN>@github.com/dmz2001TH/oracle-multi-agent.git

════════
ไฟล์สำคัญใน repo
════════
- HANDOFF.md — สถานะ build ละเอียด
- AGENT-PROMPT.md — ไฟล์นี้
- _ref/ — 9 reference repos (clone แล้ว)
- tsconfig.json — ตั้งค่า exclude แล้ว
- package.json — dependencies ครบ
```
