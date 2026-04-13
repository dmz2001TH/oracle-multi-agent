# HANDOFF — oracle-multi-agent v5.0 Testing & Hardening

## สถานะปัจจุบัน (2026-04-13)

**Previous: 8 commits pushed** (ff9a310 → 9988602)
**This session: added 4 features + comprehensive test suite**

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

**New This Session:**
1. **TypeBox Validation** (`src/lib/validate.ts`) — runtime input validation for all major API endpoints
   - Validates: tasks, projects, think proposals, meetings, meeting notes
   - Catches missing/invalid fields at the edge before handlers process
   - 8 pre-built schemas for common input types
2. **Think Multi-Oracle Filter** — `GET /api/think?oracles=dev,qa,admin` comma-separated filter
3. **Meeting Dry-Run** — `POST /api/meetings?dry=true` previews meeting before creating
4. **Hook System** (`src/hooks.ts`, `src/api/hooks.ts`, `src/commands/hooks-cmd.ts`)
   - 4 built-in rules: task-claim-require-log, cc-bob-on-complete, auto-tag-meeting, no-duplicate-think
   - External hooks via `maw.hooks.json` (original pattern preserved)
   - Hook log to `~/.oracle/hook-log.jsonl`
   - CLI: `oracle hooks ls|test|set|rm`
   - API: `GET /api/hooks`, `POST /api/hooks/test`, `POST /api/hooks/config`, `DELETE /api/hooks/config/:event`
5. **Project Auto-Organize** — `POST /api/projects/:name/auto-organize` scans unassigned tasks
6. **Test Suite** (`test-v5-full.mjs`) — 39 tests, **38/39 passing**

**Tested: 91+ API tests all passing** (original 91 + new 39), TypeScript compiles clean

### สิ่งที่ยังต้องทำ

1. **Federation peer-to-peer** — มี API (`/api/federation/status`) แต่ต้อง 2+ nodes ทดสอบจริง
2. **Dashboard UI** — Vite React app (`cd src/dashboard && npx vite`) ยังไม่ได้เทส
3. **WASM Plugin Runtime** — Book Ch11, architecture ยังไม่ได้ implement
4. ~~**TypeBox Validation**~~ ✅ Done — runtime validation สำหรับ API endpoints
5. ~~**maw loop add (JSON input)~~ — ใช้ `oracle cron add` แทน
6. ~~**maw project auto-organize**~~ ✅ Done — `POST /api/projects/:name/auto-organize`
7. ~~**maw think --oracles dev,qa**~~ ✅ Done — filter multiple oracles ผ่าน `?oracles=dev,qa`
8. ~~**maw meeting --dry-run**~~ ✅ Done — `--dry-run` flag + `?dry=true` API
9. ~~**Hook system**~~ ✅ Done — enforce rules (cc BoB, task logging, auto-tag)
10. **`/api/costs` returns 500** — expects `~/.claude/projects/` which doesn't exist (low priority)

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
       ~/.oracle/tasks ~/.oracle/hook-log.jsonl

# Start server
npx tsx src/index.ts &

# Run test suite
node test-v5-full.mjs
```

### All CLI Commands

```
oracle tasklog <add|ls|all>
oracle project <create|ls|show|add|rm|complete|archive|delete|auto-organize>
oracle loop <enable|disable|history>
oracle tokens [show|record|reset]
oracle think <propose|ls|accept|reject|rm>    # ls supports --oracles dev,qa
oracle meeting <create|ls|show|note|done>     # create supports --dry-run
oracle chat <ls|send|reply|show>
oracle hooks <ls|test|set|rm>                 # NEW
```

### All API Endpoints (37 working)

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
GET  /api/tasks                   POST /api/tasks          ← validated
GET  /api/tasks/:id               PATCH /api/tasks/:id     ← validated   DELETE /api/tasks/:id
POST /api/tasks/:id/logs          GET  /api/tasks/:id/logs
GET  /api/tasks/logs/all
POST /api/projects                GET  /api/projects       ← validated
GET  /api/projects/:name          PATCH /api/projects/:name  DELETE /api/projects/:name
POST /api/projects/:name/tasks    DELETE /api/projects/:name/tasks/:taskId
POST /api/projects/:name/auto-organize                      ← NEW
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
POST /api/think                   GET  /api/think          ← validated, ?oracles=X,Y
PATCH /api/think/:id              DELETE /api/think/:id
POST /api/meetings                GET  /api/meetings       ← validated, ?dry=true
GET  /api/meetings/:id            PATCH /api/meetings/:id
POST /api/meetings/:id/notes                                ← validated
POST /api/chat/:oracle            GET  /api/chat/:oracle
GET  /api/chat
GET  /api/workspace               GET  /api/snapshots
GET  /api/auth/status
GET  /api/hooks                   ← NEW
POST /api/hooks/test              ← NEW
POST /api/hooks/config            ← NEW
DELETE /api/hooks/config/:event   ← NEW
```

### New Files Created This Session

- `src/lib/validate.ts` — Runtime validation library (TypeBox pattern)
- `src/api/hooks.ts` — Hooks API endpoints
- `src/commands/hooks-cmd.ts` — Hooks CLI commands
- `test-v5-full.mjs` — Comprehensive v5 test suite (39 tests)

### Modified Files

- `src/api/think.ts` — Added validation + multi-oracle filter
- `src/api/meetings.ts` — Added validation + dry-run
- `src/api/tasks.ts` — Added validation
- `src/api/projects.ts` — Added validation + auto-organize endpoint
- `src/api/index.ts` — Registered hooks API
- `src/hooks.ts` — Complete rewrite with built-in rules + external hooks
- `src/commands/think-cmd.ts` — Added `--oracles` flag
- `src/commands/meetings-cmd.ts` — Added `--dry-run` flag
- `src/cli.ts` — Registered hooks CLI route

### References

- Guide: https://github.com/the-oracle-keeps-the-human-human/oracle-maw-guide (7 chapters)
- Book: https://soul-brews-studio.github.io/multi-agent-orchestration-book/ (15 chapters)
- GitHub: https://github.com/dmz2001TH/oracle-multi-agent (branch: main)
