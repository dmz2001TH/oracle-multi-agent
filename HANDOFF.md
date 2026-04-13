# 🧠 HANDOFF — Oracle Multi-Agent v5.0 Build Progress

> **Goal**: Pull ALL features from Soul-Brews-Studio ecosystem and build oracle-multi-agent v5.0
> **Current Status**: Phase 0-1 complete, Phase 2-12 pending

---

## ✅ Phase 3: API Endpoints (Batch 4) — COMPLETE

### Batch 4: API Endpoints (19 files)
| File | Source | Status |
|------|--------|--------|
| `src/api/index.ts` | maw-js/api/index.ts | ✅ Ported (Hono router) |
| `src/api/sessions.ts` | maw-js/api/sessions.ts | ✅ Ported (sessions, capture, send) |
| `src/api/feed.ts` | maw-js/api/feed.ts | ✅ Ported (feed buffer, push, markRealFeed) |
| `src/api/teams.ts` | maw-js/api/teams.ts | ✅ Ported (team scanning) |
| `src/api/config.ts` | maw-js/api/config.ts | ✅ Ported (config CRUD, fleet files, PIN) |
| `src/api/fleet.ts` | maw-js/api/fleet.ts | ✅ Ported (fleet config list) |
| `src/api/costs.ts` | maw-js/api/costs.ts | ✅ Ported (token usage + cost calc) |
| `src/api/federation.ts` | maw-js/api/federation.ts | ✅ Ported (status, snapshots, identity, auth) |
| `src/api/worktrees.ts` | maw-js/api/worktrees.ts | ✅ Ported (scan + cleanup) |
| `src/api/triggers.ts` | maw-js/api/triggers.ts | ✅ Ported (list + fire) |
| `src/api/oracle.ts` | maw-js/api/oracle.ts | ✅ Ported (search, stats, traces) |
| `src/api/transport.ts` | maw-js/api/transport.ts | ✅ Ported (status + reset) |
| `src/api/logs.ts` | maw-js/api/logs.ts | ✅ Ported (log search + agent list) |
| `src/api/pulse.ts` | maw-js/api/pulse.ts | ✅ Ported (pulse + ping) |
| `src/api/avengers.ts` | maw-js/api/avengers.ts | ✅ Ported (rate limit proxy) |
| `src/api/asks.ts` | maw-js/api/asks.ts | ✅ Ported (asks CRUD) |
| `src/api/peer-exec.ts` | maw-js/api/peer-exec.ts | ✅ Ported (peer relay) |
| `src/api/proxy.ts` | maw-js/api/proxy.ts | ✅ Ported (HTTP proxy) |
| `src/api/ui-state.ts` | maw-js/api/ui-state.ts | ✅ Ported (UI state persistence) |
| `src/api/workspace.ts` | maw-js/api/workspace.ts | ✅ Ported (workspace list) |

## ✅ Phase 2: Transports (Batch 3) — COMPLETE

### Batch 3: Transports (6 files)
| File | Source | Status |
|------|--------|--------|
| `src/transport.ts` | maw-js/transport.ts | ✅ Ported (TransportRouter + interfaces) |
| `src/transports/index.ts` | maw-js/transports/index.ts | ✅ Ported (registry + factory) |
| `src/transports/tmux.ts` | maw-js/transports/tmux.ts | ✅ Ported (local fast path) |
| `src/transports/http.ts` | maw-js/transports/http.ts | ✅ Ported (federation fallback) |
| `src/transports/hub.ts` | maw-js/transports/hub.ts | ✅ Ported (WebSocket hub client) |
| `src/transports/nanoclaw.ts` | maw-js/transports/nanoclaw.ts | ✅ Ported (Telegram/Discord bridge) |
| `src/transports/lora.ts` | maw-js/transports/lora.ts | ✅ Ported (future hardware stub) |
| `src/bridges/nanoclaw.ts` | maw-js/bridges/nanoclaw.ts | ✅ Ported (nanoclaw bridge) |

## ✅ Phase 0: Setup & Research — COMPLETE
- [x] Clone main repo + 9 reference repos to `_ref/`
- [x] Read HANDOFF.md, maw-js architecture (server.ts, config.ts, package.json)
- [x] TypeScript project setup: tsconfig.json (ES2022, NodeNext, strict)
- [x] package.json v5.0.0: hono, @hono/node-server, mqtt, arg, execa, node-pty
- [x] npm install — all deps resolved
- [x] Process Management Abstraction (`src/process/`)
  - `index.ts` — ProcessManager interface
  - `tmux-manager.ts` — tmux CLI via execa (Linux/Mac/WSL)
  - `nodepty-manager.ts` — node-pty (Windows native)
  - `auto-detect.ts` — auto-select tmux or node-pty

## ✅ Phase 1: Core Infrastructure (Batch 1) + Engine (Batch 2) — COMPLETE

### Batch 1: Core Infrastructure (20 files)
| File | Source | Status |
|------|--------|--------|
| `src/config.ts` | maw-js/config.ts | ✅ Ported (Bun→execa) |
| `src/paths.ts` | maw-js/paths.ts | ✅ Ported (import.meta→fileURLToPath) |
| `src/types.ts` | maw-js/types.ts | ✅ Ported (MawEngineLike interface) |
| `src/ssh.ts` | maw-js/ssh.ts | ✅ Ported (Bun.spawn→execa) |
| `src/tmux.ts` | maw-js/tmux.ts | ✅ Ported (full Tmux class) |
| `src/hooks.ts` | maw-js/hooks.ts | ✅ Ported (child_process→native) |
| `src/triggers.ts` | maw-js/triggers.ts | ✅ Ported (Bun.spawn→execa) |
| `src/trigger-listener.ts` | maw-js/trigger-listener.ts | ✅ Ported |
| `src/plugins.ts` | maw-js/plugins.ts (300+ lines) | ✅ Ported (4-phase lifecycle) |
| `src/audit.ts` | maw-js/audit.ts | ✅ Ported |
| `src/peers.ts` | maw-js/peers.ts | ✅ Ported (curlFetch→native fetch) |
| `src/snapshot.ts` | maw-js/snapshot.ts | ✅ Ported |
| `src/routing.ts` | maw-js/routing.ts | ✅ Ported |
| `src/find-window.ts` | maw-js/find-window.ts | ✅ Ported |
| `src/tab-order.ts` | maw-js/tab-order.ts | ✅ Ported |
| `src/oracle-registry.ts` | maw-js/oracle-registry.ts | ✅ Ported |
| `src/curl-fetch.ts` | maw-js/curl-fetch.ts | ✅ Simplified (native fetch only) |
| `src/worktrees.ts` | maw-js/worktrees.ts | ✅ Ported |
| `src/mqtt-publish.ts` | maw-js/mqtt-publish.ts | ✅ Ported |
| `src/handlers.ts` | maw-js/handlers.ts | ✅ Ported |

### Batch 2: Engine (4 files)
| File | Source | Status |
|------|--------|--------|
| `src/engine/index.ts` | maw-js/engine/index.ts | ✅ Ported (full MawEngine class) |
| `src/engine/capture.ts` | maw-js/engine/capture.ts | ✅ Ported |
| `src/engine/status.ts` | maw-js/engine/status.ts | ✅ Ported (Bun.hash→crypto.createHash) |
| `src/engine/teams.ts` | maw-js/engine/teams.ts | ✅ Ported |

### Support files created
- `src/lib/feed.ts` — Feed parser
- `src/lib/federation-auth.ts` — HMAC-SHA256 auth
- `src/lib/context.ts` — Hono middleware DI
- `src/server.ts` — Hono server with engine
- `src/index.ts` — Entry point

### Quality gates
- [x] `tsc --noEmit` passes clean — 0 errors
- [x] All Bun APIs replaced with Node.js equivalents
- [x] Git committed + pushed to GitHub

---

## 🔲 Remaining Phases

### Phase 3: API Endpoints (Batch 4) — 21 files
| File | Source |
|------|--------|
| `src/transports/index.ts` | maw-js/transports/index.ts |
| `src/transports/tmux.ts` | maw-js/transports/tmux.ts |
| `src/transports/http.ts` | maw-js/transports/http.ts |
| `src/transports/hub.ts` | maw-js/transports/hub.ts |
| `src/transports/nanoclaw.ts` | maw-js/transports/nanoclaw.ts |
| `src/transports/lora.ts` | maw-js/transports/lora.ts |

### Phase 4: Commands (Batch 5) — 49 files

### Phase 4: Commands (Batch 5) — 49 files
- archive, assign, audit, avengers, broadcast, bud, comm, completions, contacts,
  costs, done, federation-sync, federation, find, fleet-*, health, inbox, mega,
  oracle, overview, park, ping, pr, pulse, rename, restart, reunion, sleep,
  soul-sync, tab, take, talk-to, team, transport, triggers, ui-install, ui,
  view, wake-*, workon, workspace

### Phase 5: CLI (Batch 6) — 8 files
- `src/cli.ts` + parse-args + route modules

### Phase 6: Server + Plugins + Views (Batch 7) — 9 files

### Phase 7: Dashboard React App (Batch 8) — ~100 files
- Vite + React + TypeScript from maw-ui

### Phase 8: Memory Tools (Batch 9) — 13 files
- From arra-oracle-v3: search, reflect, learn, list, stats, etc.

### Phase 9: Agents + Safety + Completions (Batch 10)
- 14 agent definitions, safety hooks, shell completions

### Phase 10: Bridge + Integration (Batch 11)
- Entry point, CLI binary, .env, setup.bat, PM2 config

### Phase 11: Final QA (Batch 12)
- tsc --noEmit, npm install, README update, push

---

## 📊 File Counts

| Category | Created | Target |
|----------|---------|--------|
| TypeScript source | 57 files | ~250+ files |
| Engine | 4 | 4 ✅ |
| Core infra | 20 | 20 ✅ |
| Process abstraction | 4 | 4 ✅ |
| Transports | 8 | 8 ✅ |
| API | 20 | 20 ✅ |
| Commands | 0 | 49 |
| CLI | 0 | 8 |
| Dashboard | 0 | ~100 |
| Memory tools | 0 | 13 |

**Progress: ~23% (57/250+ files)**

---

*Last updated: 2026-04-13 12:48 GMT+8*
