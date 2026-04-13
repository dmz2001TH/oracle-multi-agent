# 📋 Book Pattern TODO — oracle-multi-agent v5.0

> สถานะ: ทำจากหนังสือ [Multi-Agent Orchestration](https://soul-brews-studio.github.io/multi-agent-orchestration-book/docs/intro)
> Commit ล่าสุด: `ea6fa98` — schemas, SDK, tasks API, CLI commands แล้ว

## ✅ เสร็จแล้ว

| ไฟล์ | บทที่ | สิ่งที่ทำ |
|------|-------|-----------|
| `src/lib/schemas.ts` | Ch 10 | Type system ครบ (Identity, Peer, Team, Task, Inbox, Plugin, Trace, Forum, AgentStatus, CronJob) |
| `src/sdk.ts` | Ch 10 | Typed SDK + `maw.fetch<T>()` escape hatch + print helpers + ทุก endpoint |
| `src/api/tasks.ts` | Ch 4 | TaskCreate/TaskList/TaskUpdate CRUD + blockedBy enforcement |
| `src/api/inbox-api.ts` | Ch 3 | Persistent inbox API (file-backed, survives session death) |
| `src/commands/tasks.ts` | Ch 4 | CLI: `oracle tasks ls/create/update/claim/done/rm` |
| `src/cli/route-tasks.ts` | Ch 4 | Route wiring for tasks CLI |
| `src/api/index.ts` | — | Wired tasks + inbox APIs |
| `src/cli.ts` | — | Wired tasks route |

## 🔲 ยังต้องทำ

### Batch 1: Spawn Skeleton + Reporting Contract (Ch 3, 8)

**ไฟล์ใหม่:** `src/commands/spawn.ts`
```typescript
// spawn_agent(name, task, opts)
// 1. tmux new-session -d -s <name> -c <cwd>
// 2. maw hey <name> "claude -p '<task>\n---\nWHEN DONE:\n maw hey <orchestrator> \"[<name>] DONE: <summary>\"\n maw inbox write \"[<name>] <branch>\"'"
// 3. Heartbeat: prompt ต้องมี PROGRESS ทุก 5 นาที + STUCK: ถ้าติด
```

**Reporting contract template** (ใส่ใน prompt ทุกครั้งที่ spawn):
```
STEP 5: Report progress AT LEAST every 5 minutes with:
  maw hey <parent> "[<name>] PROGRESS: <what you just did>"
STEP 6: When done OR stuck, send:
  maw hey <parent> "[<name>] DONE: <branch>" | "[<name>] STUCK: <reason>"
Do not exit until that command has run successfully.
```

### Batch 2: Cron Loop (Ch 9)

**ไฟล์ใหม่:** `src/commands/cron.ts` + `src/api/cron.ts`
- `CronCreate({ schedule, prompt, name })` — register recurring job
- `CronDelete({ id })` — remove job
- `CronList` — list all jobs
- State on disk: `~/.oracle/cron/<name>/backlog.md`
- Sentinel termination: write "ALL CLEAR" when done
- ScheduleWakeup: `delaySeconds` + prompt re-injection

### Batch 3: Plugin Registry (Ch 10)

**ไฟล์ใหม่:** `src/cli/plugin-registry.ts`
- Scan `~/.oracle/commands/*.ts` → dynamic import()
- Validate `export const command = { name, description }`
- Longest-prefix match dispatch
- Support `.wasm` files via WASM bridge

### Batch 4: maw agents status (Ch 13, 14)

**ไฟล์ใหม่:** `src/commands/agents-status.ts`
- Scan tmux sessions → list running agents
- Last heartbeat time
- Current branch / task
- Flag idle > threshold as "stuck"
- CLI: `oracle agents [status]`

### Batch 5: Worktree Management (Ch 7)

**ไฟล์ใหม่:** `src/commands/worktree-ops.ts`
- `oracle worktree create <branch>` — create isolated worktree
- `oracle worktree ls` — list with agent ownership
- `oracle worktree prune` — remove merged/abandoned
- Auto-cleanup as part of team shutdown

### Batch 6: Heartbeat Protocol (Ch 14)

**ไฟล์ใหม่:** `src/agents/heartbeat.ts`
- Agent writes heartbeat to `~/.oracle/agents/<name>/heartbeat.json` every N min
- Schema: `{ name, ts, status, task, branch }`
- Monitor checks staleness → flags STUCK
- Integration with spawn skeleton

### Batch 7: Lead-Compiles Pattern Helper (Ch 4, 7)

**ไฟล์ใหม่:** `src/commands/merge-team.ts`
- `oracle merge <team>` — read TaskList, merge completed branches in order
- Respect dependency order (safety first → tester → verifier)
- Run tests after merge
- Clean up worktrees after merge

### Batch 8: Federation Agent Status (Ch 8, 15)

**อัปเดต:** `src/api/federation.ts`
- `/api/agents/status` — list all running agents across fleet
- Heartbeat-based staleness detection
- Integration with `maw overview` command

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
