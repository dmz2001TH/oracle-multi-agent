# 📋 Book Pattern TODO — oracle-multi-agent v5.0

> สถานะ: ทำจากหนังสือ [Multi-Agent Orchestration](https://soul-brews-studio.github.io/multi-agent-orchestration-book/docs/intro)
> Commit ล่าสุด: `d15fbfe` — Batch 1-8 complete: spawn, cron, agents, worktree, heartbeat, merge

## ✅ เสร็จแล้ว

| ไฟล์ | บทที่ | สิ่งที่ทำ |
|------|-------|-----------|
| `src/lib/schemas.ts` | Ch 10 | Type system ครบ (Identity, Peer, Team, Task, Inbox, Plugin, Trace, Forum, AgentStatus, CronJob) |
| `src/sdk.ts` | Ch 10 | Typed SDK + `maw.fetch<T>()` escape hatch + print helpers + ทุก endpoint |
| `src/api/tasks.ts` | Ch 4 | TaskCreate/TaskList/TaskUpdate CRUD + blockedBy enforcement |
| `src/api/inbox-api.ts` | Ch 3 | Persistent inbox API (file-backed, survives session death) |
| `src/commands/tasks.ts` | Ch 4 | CLI: `oracle tasks ls/create/update/claim/done/rm` |
| `src/cli/route-tasks.ts` | Ch 4 | Route wiring for tasks CLI |
| `src/api/index.ts` | — | Wired all APIs |
| `src/cli.ts` | — | Wired all routes |
| `src/commands/spawn.ts` | Ch 3, 8 | Spawn skeleton via tmux + claude -p with reporting contract |
| `src/cli/route-spawn.ts` | Ch 8 | CLI: `oracle spawn name "task"` |
| `src/api/cron.ts` | Ch 9 | File-backed cron job CRUD (config.json + backlog.md) |
| `src/commands/cron.ts` | Ch 9 | CLI: `oracle cron add/ls/get/rm/run` |
| `src/cli/route-cron.ts` | Ch 9 | Route wiring for cron CLI |
| `src/commands/agents-status.ts` | Ch 13, 14 | tmux scan + heartbeat + stuck detection |
| `src/cli/route-agents-status.ts` | Ch 13 | CLI: `oracle agents status/kill` |
| `src/commands/worktree-ops.ts` | Ch 7 | create/ls/prune with agent ownership |
| `src/cli/route-worktree-ops.ts` | Ch 7 | CLI: `oracle worktree create/ls/prune` |
| `src/agents/heartbeat.ts` | Ch 14 | write/read/staleness check protocol |
| `src/commands/merge-team.ts` | Ch 4, 7 | Topological merge by blockedBy deps |
| `src/cli/route-merge-team.ts` | Ch 4, 7 | CLI: `oracle merge <team>` |
| `src/api/agents.ts` | Ch 8, 15 | GET /api/agents/status endpoint |

## 🔲 ยังต้องทำ

### Batch 3: Plugin Registry (Ch 10) — ข้ามได้
`src/cli/command-registry.ts` มีอยู่แล้ว — scanCommands(), matchCommand(), longest-prefix match, WASM support. แค่ต้อง wire `oracle plugin ls` command เท่านั้น

### Batch 9: ScheduleWakeup (Ch 9)
- สร้าง `src/commands/wakeup.ts` — self-paced re-invocation
- API: POST /api/wake/schedule — { delaySeconds, prompt, reason }
- Integration: agent calls wakeup() when waiting for background process

### Batch 10: maw overview command (Ch 13)
- CLI: `oracle overview [agent1] [agent2] ...`
- แสดง live status ของหลาย agents พร้อมกัน
- ใช้ tmux capture-pane + agents-status API

### Batch 11: Feed + Audit integration
- Wire spawn/merge/cron events into feed API
- Audit log for all agent lifecycle events

---

## 📖 หนังสืออ้างอิง

| บท | หัวข้อ | Pattern |
|----|--------|---------|
| Ch 1 | Why One Agent Isn't Enough | Context compaction problem |
| Ch 2 | The Three Tiers | Agent tool / TeamCreate / tmux federation |
| Ch 3 | The Message Bus | SendMessage / maw hey / Inbox |
| Ch 4 | Task Tracking | TaskCreate / TaskUpdate / lead-compiles |
| Ch 5 | Research Swarm | 3-5 Haiku agents, parallel read |
| Ch 6 | Architecture Debate | Advocate / Counter / Architect (Opus) |
| Ch 7 | Implementation Team | Named roles, worktree isolation |
| Ch 8 | Federation Agent | tmux + claude -p, spawn skeleton |
| Ch 9 | Cron Loop | CronCreate / ScheduleWakeup |
| Ch 10 | Plugin Architecture | Typed SDK, maw.fetch<T>() |
| Ch 11 | WASM Plugin Runtime | Host functions, memory protocol |
| Ch 12 | Framework Migration | 3-phase: schema → DI → swap |
| Ch 13 | What The Human Sees | Honesty principle |
| Ch 14 | Failure Modes | Silent agent, error() bug, merge conflicts |
| Ch 15 | Tier 4 | maw wake --issue --team |

## ⚠️ สำคัญ
- ใช้ Node.js runtime (ไม่ใช่ Bun)
- ทุกไฟล์ TypeScript (.ts)
- `tsc --noEmit` ต้องผ่านหลังแต่ละ batch
- git commit ทุก batch แล้ว push origin main
- Dashboard (`src/dashboard/`) อยู่ใน tsconfig exclude
