# 🧠 HANDOFF — Oracle Multi-Agent v5.0 Build Progress

> **Goal**: Pull ALL features from Soul-Brews-Studio ecosystem and build oracle-multi-agent v5.0
> **Current Status**: Phase 0-4 complete, Phase 5-11 pending

---

## ✅ Phase 0: Setup & Research — COMPLETE
- [x] Clone main repo + 9 reference repos to `_ref/`
- [x] Read HANDOFF.md, maw-js architecture
- [x] TypeScript project setup: tsconfig.json (ES2022, NodeNext, strict)
- [x] package.json v5.0.0: hono, @hono/node-server, mqtt, arg, execa, node-pty
- [x] Process Management Abstraction (`src/process/`)
  - `index.ts` — ProcessManager interface
  - `tmux-manager.ts` — tmux CLI via execa (Linux/Mac/WSL)
  - `nodepty-manager.ts` — node-pty (Windows native)
  - `auto-detect.ts` — auto-select tmux or node-pty

## ✅ Phase 1: Core Infrastructure (Batch 1) + Engine (Batch 2) — COMPLETE

### Batch 1: Core Infrastructure (20 files)
| File | Status |
|------|--------|
| `src/config.ts` | ✅ Ported |
| `src/paths.ts` | ✅ Ported |
| `src/types.ts` | ✅ Ported |
| `src/ssh.ts` | ✅ Ported |
| `src/tmux.ts` | ✅ Ported (full Tmux class + all methods) |
| `src/hooks.ts` | ✅ Ported |
| `src/triggers.ts` | ✅ Ported |
| `src/trigger-listener.ts` | ✅ Ported |
| `src/plugins.ts` | ✅ Ported (4-phase lifecycle) |
| `src/audit.ts` | ✅ Ported |
| `src/peers.ts` | ✅ Ported |
| `src/snapshot.ts` | ✅ Ported |
| `src/routing.ts` | ✅ Ported |
| `src/find-window.ts` | ✅ Ported |
| `src/tab-order.ts` | ✅ Ported |
| `src/oracle-registry.ts` | ✅ Ported |
| `src/curl-fetch.ts` | ✅ Ported |
| `src/worktrees.ts` | ✅ Ported |
| `src/mqtt-publish.ts` | ✅ Ported |
| `src/handlers.ts` | ✅ Ported |
| `src/lib/feed.ts` | ✅ Ported |
| `src/lib/federation-auth.ts` | ✅ Ported |
| `src/lib/context.ts` | ✅ Ported |
| `src/server.ts` | ✅ Ported |
| `src/index.ts` | ✅ Ported |

### Batch 2: Engine (4 files)
| File | Status |
|------|--------|
| `src/engine/index.ts` | ✅ Full MawEngine class |
| `src/engine/capture.ts` | ✅ Screen capture + broadcast |
| `src/engine/status.ts` | ✅ Hybrid status detection |
| `src/engine/teams.ts` | ✅ Team scanning |

## ✅ Phase 2: Transports (Batch 3) — COMPLETE (8 files)
- `src/transport.ts` — TransportRouter + interfaces
- `src/transports/index.ts` — Registry + factory
- `src/transports/tmux.ts` — Local fast path
- `src/transports/http.ts` — HTTP federation fallback
- `src/transports/hub.ts` — WebSocket hub client
- `src/transports/nanoclaw.ts` — Telegram/Discord bridge
- `src/transports/lora.ts` — Future hardware stub
- `src/bridges/nanoclaw.ts` — Nanoclaw bridge

## ✅ Phase 3: API Endpoints (Batch 4) — COMPLETE (20 files)
- `src/api/index.ts` — Hono router
- 19 endpoint files: sessions, feed, teams, config, fleet, costs,
  federation, worktrees, triggers, oracle, transport, logs, pulse,
  avengers, asks, peer-exec, proxy, ui-state, workspace

## ✅ Phase 4: Commands (Batch 5) — COMPLETE (49 files)
All 49 command files ported from maw-js:
- archive, assign, audit, avengers, broadcast, bud, comm, completions,
  contacts, costs, done, federation-sync, federation, find, fleet-*,
  health, inbox, mega, oracle, overview, park, ping, pr, pulse,
  rename, restart, reunion, sleep, soul-sync, tab, take, talk-to,
  team, transport, triggers, ui-install, ui, view, wake-*,
  workon, workspace

### Quality gates
- [x] `tsc --noEmit` passes clean — 0 errors
- [x] All Bun APIs replaced with Node.js equivalents
- [x] Git committed + pushed to GitHub

---

## 🔲 Remaining Phases

### Phase 5: CLI (Batch 6) — 8 files
- `src/cli.ts` — Entry point + arg parser
- `src/cli/parse-args.ts` — Argument parsing
- Route modules: route-agent, route-comm, route-fleet, route-team,
  route-tools, route-workspace, usage

### Phase 6: Server + Plugins + Views (Batch 7) — 9 files
- Server with full WebSocket support
- Builtin plugins: shell-hooks, mqtt-publish
- Views: demo, federation, plugins, timemachine
- Static: door.html

### Phase 7: Dashboard React App (Batch 8) — ~100 files
- Vite + React + TypeScript from maw-ui
- 15 apps, 68 components, hooks, lib, core

### Phase 8: Memory Tools (Batch 9) — 13 files
- From arra-oracle-v3: search, reflect, learn, list, stats, concepts,
  supersede, verify, thread, trace, schedule, handoff, inbox

### Phase 9: Agents + Safety + Completions (Batch 10)
- 14 agent definition .md files
- Safety hooks (shell scripts)
- Shell completions (bash, zsh, PowerShell)

### Phase 10: Bridge + Integration (Batch 11)
- Full entry point integration
- CLI binary `bin/oracle`
- .env.example, setup.bat/start.bat, PM2 config

### Phase 11: Final QA (Batch 12)
- `tsc --noEmit`, npm install, README update, push

---

## 📊 File Counts

| Category | Created | Target |
|----------|---------|--------|
| TypeScript source | ~106 files | ~250+ files |
| Process abstraction | 4 | 4 ✅ |
| Core infra | 25 | 25 ✅ |
| Engine | 4 | 4 ✅ |
| Transports | 8 | 8 ✅ |
| API | 20 | 20 ✅ |
| Commands | 49 | 49 ✅ |
| CLI | 0 | 8 |
| Dashboard | 0 | ~100 |
| Memory tools | 0 | 13 |
| Agents + safety | 0 | ~20 |

**Progress: ~42% (106/250+ files)**

---

*Last updated: 2026-04-13 13:10 GMT+8*
