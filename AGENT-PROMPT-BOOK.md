# 🧠 AGENT PROMPT — Oracle Multi-Agent Book Patterns (Continue Build)

> Copy ทั้งหมดนี้วางให้ AI agent เลย

```
คุณกำลังสร้าง oracle-multi-agent v5.0 ต่อจาก book-pattern scaffolding

Repo: https://github.com/dmz2001TH/oracle-multi-agent (branch main)
Working dir: clone แล้ว cd เข้าไป
Reference: https://soul-brews-studio.github.io/multi-agent-orchestration-book/docs/intro

════════
สถานะปัจจุบัน
════════

✅ BOOK-TODO.md — อ่านไฟล์นี้ก่อน มีรายการละเอียดว่าอะไรเสร็จแล้ว อะไรเหลือ
✅ src/lib/schemas.ts — type system ครบ (Identity, Peer, Team, Task, Inbox, Plugin, Trace, Forum, AgentStatus, CronJob)
✅ src/sdk.ts — typed SDK with maw.fetch<T>() + print helpers
✅ src/api/tasks.ts — TaskCreate/TaskList/TaskUpdate CRUD
✅ src/api/inbox-api.ts — persistent inbox API
✅ src/commands/tasks.ts — CLI tasks commands
✅ src/cli/route-tasks.ts — CLI routing
✅ Wired into API router + CLI entry

════════
สิ่งที่ต้องทำต่อ (อ่าน BOOK-TODO.md สำหรับรายละเอียด)
════════

Batch 1: Spawn Skeleton + Reporting Contract (Ch 3, 8)
- สร้าง src/commands/spawn.ts
- ฟังก์ชัน spawn_agent(name, task, orchestrator, cwd)
- ใช้ tmux new-session + maw hey ส่ง prompt พร้อม reporting contract
- Prompt template ต้องมี: PROGRESS ทุก 5 นาที, DONE/STUCK เมื่อเสร็จ/ติด
- Wire เข้า CLI: oracle spawn <name> "task" [--cwd X] [--orchestrator X]

Batch 2: Cron Loop (Ch 9)
- สร้าง src/commands/cron.ts + src/api/cron.ts
- CronCreate: register schedule + prompt
- State on disk: ~/.oracle/cron/<name>/backlog.md
- Sentinel termination: "ALL CLEAR"
- Wire เข้า CLI: oracle cron <add|ls|rm|run>

Batch 3: Plugin Registry (Ch 10)
- สร้าง src/cli/plugin-registry.ts
- Scan ~/.oracle/commands/*.ts, dynamic import()
- Validate export const command = { name, description }
- Longest-prefix match dispatch

Batch 4: Agent Status Monitor (Ch 13, 14)
- สร้าง src/commands/agents-status.ts
- Scan tmux sessions → list agents with heartbeat
- Flag idle > threshold as stuck
- Wire: oracle agents [status]

Batch 5: Worktree Operations (Ch 7)
- สร้าง src/commands/worktree-ops.ts
- oracle worktree create/ls/prune
- Auto-cleanup on team shutdown

Batch 6: Heartbeat Protocol (Ch 14)
- สร้าง src/agents/heartbeat.ts
- Write heartbeat.json every N min
- Monitor checks staleness

Batch 7: Lead-Compiles Merge Helper (Ch 4, 7)
- สร้าง src/commands/merge-team.ts
- oracle merge <team> — merge completed branches
- Respect dependency order

Batch 8: Federation Agent Status (Ch 8, 15)
- อัปเดต src/api/federation.ts
- /api/agents/status endpoint

════════
กฎสำคัญ
════════

1. ใช้ TypeScript (.ts) ทุกไฟล์
2. Node.js runtime — ไม่ใช่ Bun APIs
3. copy patterns จากหนังสือ reference
4. git commit ทุก batch แล้ว git push origin main
5. tsc --noEmit ต้องผ่านหลังแต่ละ batch
6. Dashboard อยู่ใน tsconfig exclude (ไม่ต้องแก้)
7. src/sdk.ts มี maw.fetch<T>() แล้ว — ใช้ได้เลยสำหรับ API calls

════════
Git Auth
════════
git remote set-url origin https://<USERNAME>:<TOKEN>@github.com/dmz2001TH/oracle-multi-agent.git
```
