# HANDOFF — oracle-multi-agent v5.0 Testing & Hardening

## สถานะปัจจุบัน (2026-04-13)

**8 commits pushed** ใน session นี้ (ff9a310 → 9988602)

### สิ่งที่ทำแล้ว

**Bug Fixes (3):**
1. `agents-status` คืน 200 ให้ agent ที่ตายแล้ว → แก้ให้คืน 404
2. `spawn.ts` ใช้ `require("node:fs")` runtime → แก้เป็น static import
3. Log บอก URL dashboard ผิด → แก้ให้บอก Vite dev server

**New Features (14 API endpoints + 7 CLI routes):**
- Task Log: audit trail (log/commit/blocker)
- Project: task grouping + progress tracking
- Loop Management: enable/disable/history
- Tokens: budget monitoring
- Think: agent proposals (improvement/bug/feature)
- Meeting: team coordination + notes
- Chat Log: conversation history per oracle

**Tested: 91 API tests all passing**, TypeScript compiles clean

### สิ่งที่ยังต้องทำ

1. **Federation peer-to-peer** — มี API (`/api/federation/status`) แต่ต้อง 2+ nodes ทดสอบจริง
2. **Dashboard UI** — Vite React app (`cd src/dashboard && npx vite`) ยังไม่ได้เทส
3. **WASM Plugin Runtime** — Book Ch11, architecture ยังไม่ได้ implement
4. **TypeBox Validation** — Book Ch10, runtime validation ยังไม่มี
5. **maw loop add (JSON input)** — Guide Ch5, ตอนนี้ใช้ `oracle cron add` แทน
6. **maw project auto-organize** — Guide Ch4, ยังไม่มี
7. **maw think --oracles dev,qa** — filter multiple oracles ยังไม่มี
8. **maw meeting --dry-run** — Guide Ch6, ยังไม่มี
9. **Hook system** — enforce rules (cc BoB, task logging) — Guide Ch7

### How to Run

```bash
cd ~/.openclaw/workspace/oracle-multi-agent
npm install
npx tsc --noEmit        # should pass clean
npx tsx src/index.ts    # starts server on :3456
```

### Test on Clean Data

```bash
# Clean all data first
rm -rf ~/.oracle/task-logs ~/.oracle/projects ~/.oracle/cron ~/.oracle/wake \
       ~/.oracle/think ~/.oracle/meetings ~/.oracle/chat ~/.oracle/tokens.json \
       ~/.oracle/tasks

# Start server
npx tsx src/index.ts &

# Run test suite (create test-v5-full.mjs from previous session or write new one)
npx tsx test-v5-full.mjs
```

### All CLI Commands

```
oracle tasklog <add|ls|all>
oracle project <create|ls|show|add|rm|complete|archive|delete>
oracle loop <enable|disable|history>
oracle tokens [show|record|reset]
oracle think <propose|ls|accept|reject|rm>
oracle meeting <create|ls|show|note|done>
oracle chat <ls|send|reply|show>
```

### All API Endpoints (33 working)

```
GET  /health
GET  /api/identity
GET  /api/sessions
GET  /api/feed                    POST /api/feed
GET  /api/teams
GET  /api/config                  POST /api/config
GET  /api/config-files            GET  /api/config-file
GET  /api/fleet                   GET  /api/fleet-config
GET  /api/costs
GET  /api/federation/status
GET  /api/worktrees
GET  /api/triggers                POST /api/triggers/fire
GET  /api/oracle/search|stats|traces
GET  /api/transport
GET  /api/logs                    GET  /api/logs/agents
GET  /api/pulse                   GET  /api/ping
GET  /api/avengers/status|health|best
GET  /api/asks                    POST /api/asks
GET  /api/tasks                   POST /api/tasks
GET  /api/tasks/:id               PATCH /api/tasks/:id    DELETE /api/tasks/:id
POST /api/tasks/:id/logs          GET  /api/tasks/:id/logs
GET  /api/tasks/logs/all
POST /api/projects                GET  /api/projects
GET  /api/projects/:name          PATCH /api/projects/:name  DELETE /api/projects/:name
POST /api/projects/:name/tasks    DELETE /api/projects/:name/tasks/:taskId
GET  /api/inbox                   POST /api/inbox
GET  /api/cron                    POST /api/cron
GET  /api/cron/:id                DELETE /api/cron/:id
POST /api/cron/:id/run
PATCH /api/cron/:id/enable        PATCH /api/cron/:id/disable
GET  /api/cron/:id/history        POST /api/cron/:id/history
GET  /api/cron/:id/backlog        PUT  /api/cron/:id/backlog
GET  /api/agents/status           GET  /api/agents/status/:name
POST /api/wake/schedule           GET  /api/wake/pending
GET  /api/tokens                  POST /api/tokens
POST /api/think                   GET  /api/think
PATCH /api/think/:id              DELETE /api/think/:id
POST /api/meetings                GET  /api/meetings
GET  /api/meetings/:id            PATCH /api/meetings/:id
POST /api/meetings/:id/notes
POST /api/chat/:oracle            GET  /api/chat/:oracle
GET  /api/chat
GET  /api/workspace               GET  /api/snapshots
GET  /api/auth/status
```

### References

- Guide: https://github.com/the-oracle-keeps-the-human-human/oracle-maw-guide (7 chapters)
- Book: https://soul-brews-studio.github.io/multi-agent-orchestration-book/ (15 chapters)
- GitHub: https://github.com/dmz2001TH/oracle-multi-agent (branch: main)
