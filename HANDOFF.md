# 🧠 HANDOFF — Oracle Multi-Agent v5.0 Complete Upgrade Plan

> **Goal**: Pull ALL features from Soul-Brews-Studio ecosystem and build oracle-multi-agent v5.0
> **Current Status**: v4.0 has ~40% of maw-js features, ~20% of maw-ui
> **Target**: 100% feature parity, adapted for Node.js + Windows native

---

## 📚 Soul-Brews-Studio Ecosystem Inventory

### 1. maw-js (17,000 lines TS, 123 files) — CORE ENGINE
**Repo**: https://github.com/Soul-Brews-Studio/maw-js

#### Commands (49 total) — WE HAVE ~30, MISSING 19:
| # | Command | Description | Status |
|---|---------|-------------|--------|
| 1 | `archive` | Archive old worktrees/sessions | ❌ MISSING |
| 2 | `assign` | Assign task to agent | ❌ MISSING |
| 3 | `audit` | View audit log | ❌ MISSING |
| 4 | `avengers` | Avengers assemble (multi-repo) | ❌ MISSING |
| 5 | `broadcast` | Broadcast to all agents | ✅ DONE |
| 6 | `bud` | Spawn new oracle (yeast budding) | ❌ MISSING |
| 7 | `comm` | Communication channel management | ❌ MISSING |
| 8 | `completions` | Shell completions (bash/zsh) | ❌ MISSING |
| 9 | `contacts` | List oracle contacts | ❌ MISSING |
| 10 | `costs` | API usage costs | ✅ DONE |
| 11 | `done` | Auto-save + cleanup + kill window | ❌ MISSING |
| 12 | `federation-sync` | Sync federation state | ❌ MISSING |
| 13 | `federation` | Federation management | ✅ PARTIAL |
| 14 | `find` | Search memory across oracles | ❌ MISSING |
| 15 | `fleet-consolidate` | Consolidate fleet configs | ❌ MISSING |
| 16 | `fleet-doctor` | Fleet diagnostics | ❌ MISSING |
| 17 | `fleet-health` | Fleet health report | ❌ MISSING |
| 18 | `fleet-init` | Initialize fleet config | ❌ MISSING |
| 19 | `fleet-load` | Load fleet entries | ❌ MISSING |
| 20 | `fleet-manage` | Fleet CRUD operations | ❌ MISSING |
| 21 | `fleet` | Fleet list/overview | ✅ DONE |
| 22 | `health` | Agent health check | ✅ DONE |
| 23 | `inbox` | View/add inbox items | ✅ DONE |
| 24 | `mega` | Mega command (batch ops) | ❌ MISSING |
| 25 | `oracle` | Oracle management | ❌ MISSING |
| 26 | `overview` | System overview | ✅ DONE |
| 27 | `park` | Park (pause) agent | ❌ MISSING |
| 28 | `ping` | Ping federation peers | ✅ DONE |
| 29 | `pr` | GitHub PR management | ❌ MISSING |
| 30 | `pulse` | Pulse (heartbeat) management | ❌ MISSING |
| 31 | `rename` | Rename agent/oracle | ❌ MISSING |
| 32 | `restart` | Restart agent/hub | ❌ MISSING |
| 33 | `reunion` | Reunion (sync ψ/memory back) | ❌ MISSING |
| 34 | `sleep` | Gracefully stop agent | ❌ MISSING |
| 35 | `soul-sync` | Sync memory across peers | ❌ MISSING |
| 36 | `tab` | Tab/window management | ❌ MISSING |
| 37 | `take` | Take over agent/window | ❌ MISSING |
| 38 | `talk-to` | Talk to specific agent | ❌ MISSING |
| 39 | `team` | Team operations | ✅ PARTIAL |
| 40 | `transport` | Transport diagnostics | ❌ MISSING |
| 41 | `triggers` | Trigger management | ❌ MISSING |
| 42 | `ui-install` | Install UI dashboard | ❌ MISSING |
| 43 | `ui` | Open UI dashboard | ❌ MISSING |
| 44 | `view` | View agent screen/output | ❌ MISSING |
| 45 | `wake-resolve` | Resolve wake target | ❌ MISSING |
| 46 | `wake-target` | Parse wake target | ❌ MISSING |
| 47 | `wake` | Wake/start agent in tmux | ❌ MISSING |
| 48 | `workon` | Work on task/project | ❌ MISSING |
| 49 | `workspace` | Workspace management | ❌ MISSING |

#### Core Modules — WE HAVE SOME, MISSING KEY ONES:
| Module | File(s) | Description | Status |
|--------|---------|-------------|--------|
| tmux | `tmux.ts` (200+ lines) | Tmux wrapper: sessions, windows, panes, send-keys, capture | ❌ MISSING |
| ssh | `ssh.ts` | hostExec: local bash or remote SSH | ❌ MISSING (we have basic) |
| pty | `pty.ts` | PTY sessions for interactive terminals | ❌ MISSING |
| hooks | `hooks.ts` | Event hooks (maw.hooks.json) | ❌ MISSING |
| triggers | `triggers.ts` | Config-driven workflow triggers | ❌ MISSING |
| plugins | `plugins.ts` (300+ lines) | 4-phase plugin system (gate→filter→handle→late) | ⚠️ PARTIAL |
| worktrees | `worktrees.ts` | Git worktree management | ❌ MISSING |
| audit | `audit.ts` | Audit logging (JSONL) | ❌ MISSING |
| mqtt | `mqtt-publish.ts` | MQTT pub/sub messaging | ❌ MISSING |
| ssh | `ssh.ts` + hostExec | Remote command execution | ❌ MISSING |
| config | `config.ts` (400+ lines) | Full config with validation, defaults, typed accessors | ⚠️ PARTIAL |
| peers | `peers.ts` | Peer discovery/management | ❌ MISSING |
| snapshot | `snapshot.ts` | System snapshots | ❌ MISSING |
| routing | `routing.ts` | Message routing | ❌ MISSING |
| find-window | `find-window.ts` | Window discovery | ❌ MISSING |
| tab-order | `tab-order.ts` | Tab ordering | ❌ MISSING |
| oracle-registry | `oracle-registry.ts` | Oracle registry/discovery | ❌ MISSING |
| curl-fetch | `curl-fetch.ts` | HTTP client with curl fallback | ❌ MISSING |
| handlers | `handlers.ts` | WebSocket message handlers | ❌ MISSING |

#### Engine (4 files):
| File | Description | Status |
|------|-------------|--------|
| `engine/index.ts` | MawEngine: main orchestrator | ✅ PARTIAL |
| `engine/capture.ts` | Screen capture for agents | ❌ MISSING |
| `engine/status.ts` | Status monitoring | ❌ MISSING |
| `engine/teams.ts` | Team orchestration engine | ❌ MISSING |

#### API Endpoints (20 files):
| Endpoint | Description | Status |
|----------|-------------|--------|
| `api/index.ts` | API router | ✅ DONE |
| `api/asks.ts` | Ask system | ❌ MISSING |
| `api/avengers.ts` | Avengers API | ❌ MISSING |
| `api/config.ts` | Config management | ❌ MISSING |
| `api/costs.ts` | Cost tracking | ✅ DONE |
| `api/deprecated.ts` | Deprecated endpoints | ❌ N/A |
| `api/federation.ts` | Federation API | ✅ PARTIAL |
| `api/feed.ts` | Feed system | ✅ DONE |
| `api/fleet.ts` | Fleet management | ⚠️ PARTIAL |
| `api/logs.ts` | Log streaming | ❌ MISSING |
| `api/oracle.ts` | Oracle management | ❌ MISSING |
| `api/peer-exec.ts` | Peer execution | ✅ DONE |
| `api/proxy.ts` | HTTP proxy relay | ❌ MISSING |
| `api/pulse.ts` | Pulse/heartbeat | ❌ MISSING |
| `api/sessions.ts` | Session management | ❌ MISSING |
| `api/teams.ts` | Team API | ⚠️ PARTIAL |
| `api/transport.ts` | Transport API | ❌ MISSING |
| `api/triggers.ts` | Trigger API | ❌ MISSING |
| `api/ui-state.ts` | UI state persistence | ❌ MISSING |
| `api/workspace.ts` | Workspace API | ❌ MISSING |
| `api/worktrees.ts` | Worktree API | ❌ MISSING |

#### Transports (6 files):
| Transport | Description | Status |
|-----------|-------------|--------|
| `transports/index.ts` | Transport router | ✅ DONE |
| `transports/tmux.ts` | Tmux transport | ❌ MISSING |
| `transports/http.ts` | HTTP federation | ✅ DONE |
| `transports/hub.ts` | Hub relay | ❌ MISSING |
| `transports/nanoclaw.ts` | Nanoclaw bridge | ❌ MISSING |
| `transports/lora.ts` | LoRa mesh transport | ❌ MISSING |

#### Dependencies:
- `hono` — HTTP framework (we use Express)
- `mqtt` — MQTT client
- `@xterm/xterm` + `@xterm/addon-fit` — Terminal emulator
- `react`, `react-dom`, `three`, `zustand` — Frontend
- `arg` — CLI argument parser

---

### 2. maw-ui (22,000 lines React/TSX, 68 components) — DASHBOARD
**Repo**: https://github.com/Soul-Brews-Studio/maw-ui

#### Views (15 total) — WE HAVE 12 (basic), NEED PROPER REACT:
| View | Description | Status |
|------|-------------|--------|
| Office | Agent grid with chibi avatars, 8-bit mode | ⚠️ BASIC |
| Chat | Chat interface with threads | ⚠️ BASIC |
| Dashboard | System metrics, charts | ⚠️ BASIC |
| Federation 2D | Canvas visualization of mesh | ❌ MISSING |
| Federation | Federation management view | ⚠️ BASIC |
| Fleet | Fleet management with health | ⚠️ BASIC |
| Arena | Agent battle/comparison view | ❌ MISSING |
| Inbox | Action items | ⚠️ BASIC |
| Mission | Mission control view | ❌ MISSING |
| Terminal | Terminal emulator (xterm.js) | ⚠️ BASIC |
| Overview | System overview | ❌ MISSING |
| Config | Configuration editor | ⚠️ BASIC |
| Feed Monitor | Real-time feed | ⚠️ BASIC |
| Party | Agent party/social view | ❌ MISSING |
| Workspace | Workspace management | ❌ MISSING |

#### Key Components (68 total) — MISSING ALL:
- AgentAvatar, AgentCard, AgentRow
- BoardView, BoBFaceView, BottomStats
- ChatBubble, ChibiAvatar, ThreadCard
- ChatView, ChibiPortrait, ConfigView
- DashboardPro, DashboardView, ErrorBoundary
- Canvas2D (federation), FederationView
- FleetGrid, FootballPitch, FpsCounter
- HallOfFameView, HoverPreviewCard, InboxView
- iPadDashboard, JarvisView, Joystick, JumpOverlay
- KVTable, LoadingSkeleton, LoopsView, MiniMonitor
- MiniPreview, MissionControlCluster, MissionControlHub
- NodeBadge, OracleSearch, OrbitalView, OverviewGrid
- PeerStatusPanel, PinLock, ProjectBoardView
- RoomGrid, ServerFields, ShortcutOverlay
- StageSection, StatusBar, TaskDetailOverlay
- TeamPanel, TerminalModal, TerminalView
- ToolCard, UniverseBg, VSAgentPanel, VSView
- WorktreeView, XTerminal

#### Special Features:
- **8-bit Office** — Rust/WASM game-like office with sprite animations
- **Shrine** — Cloudflare Worker-based feature
- **Sound effects** — Saiyan aura sounds
- **Federation 2D** — Real-time force-directed graph

---

### 3. arra-oracle-v3 (MCP Server, 22 tools) — MEMORY LAYER
**Repo**: https://github.com/Soul-Brews-Studio/arra-oracle-v3

#### MCP Tools (22):
| Tool | Description | Status |
|------|-------------|--------|
| oracle_search | Hybrid search (FTS5 + ChromaDB) | ⚠️ PARTIAL (FTS5 only) |
| oracle_reflect | Random wisdom | ❌ MISSING |
| oracle_learn | Add new patterns | ❌ MISSING |
| oracle_list | Browse documents | ❌ MISSING |
| oracle_stats | Database statistics | ❌ MISSING |
| oracle_concepts | List concept tags | ❌ MISSING |
| oracle_supersede | Mark documents as superseded | ❌ MISSING |
| oracle_handoff | Session handoff | ✅ DONE |
| oracle_inbox | Inbox messages | ✅ DONE |
| oracle_verify | Verify documents | ❌ MISSING |
| oracle_thread | Create thread | ❌ MISSING |
| oracle_threads | List threads | ❌ MISSING |
| oracle_thread_read | Read thread | ❌ MISSING |
| oracle_thread_update | Update thread | ❌ MISSING |
| oracle_trace | Create trace | ⚠️ PARTIAL |
| oracle_trace_list | List traces | ⚠️ PARTIAL |
| oracle_trace_get | Get trace | ❌ MISSING |
| oracle_trace_link | Link traces | ❌ MISSING |
| oracle_trace_unlink | Unlink traces | ❌ MISSING |
| oracle_trace_chain | Trace chain | ❌ MISSING |
| oracle_schedule_add | Add schedule entry | ❌ MISSING |
| oracle_schedule_list | List schedule | ❌ MISSING |

#### Tech Stack:
- Bun runtime (>=1.2.0)
- SQLite + FTS5 for full-text search
- ChromaDB for vector/semantic search ← WE DON'T HAVE THIS
- Drizzle ORM for type-safe queries ← WE DON'T HAVE THIS
- Hono for HTTP API ← WE USE EXPRESS
- MCP protocol for Claude integration ← WE DON'T HAVE THIS

---

### 4. oracle-framework (README only) — PHILOSOPHY & COMMANDS
**Repo**: https://github.com/Soul-Brews-Studio/oracle-framework

Defines the Oracle framework: commands (/awaken, /recap, /rrr, /fyi, /trace, /learn, /standup, /feel, /forward, /who-are-you), ψ/ structure, principles, and identity system.

---

### 5. opensource-nat-brain-oracle — BRAIN/PHILOSOPHY
**Repo**: https://github.com/Soul-Brews-Studio/opensource-nat-brain-oracle

Contains:
- `.claude/agents/` — 17 specialized agent definitions (coder, critic, executor, etc.)
- `.claude/hooks/` — Safety hooks, greeting hooks, task logging
- `.claude/knowledge/` — Knowledge base
- Philosophy, principles, safety rules
- CLAUDE.md — Master configuration

---

### 6. arra-oracle-skills-cli — SKILLS INSTALLER
**Repo**: https://github.com/Soul-Brews-Studio/arra-oracle-skills-cli

CLI tool that installs 30+ skill packs into Claude Code. Includes hooks (auto-scale, safety-check, session-start, statusline), plugins (oracle-skills.ts for OpenCode), and CI/CD workflows.

---

### 7. oracle-vault-report — VAULT DASHBOARD
**Repo**: https://github.com/Soul-Brews-Studio/oracle-vault-report

HTML report generator that shows vault statistics: repo count, file count, skills, sync status.

---

### 8. arra-safety-hooks — SAFETY HOOKS
**Repo**: https://github.com/Soul-Brews-Studio/arra-safety-hooks

Shell scripts for safety validation: `install.sh`, `safety-check.sh`

---

### 9. multi-agent-workflow-kit (Python) — PREDECESSOR
**Repo**: https://github.com/Soul-Brews-Studio/multi-agent-workflow-kit

Python-based multi-agent toolkit. Contains:
- Agent definitions (agents.yaml)
- tmux profiles (profile0-4.sh)
- Shell completions (bash/zsh)
- Documentation (architecture, branching, operations)

---

### 10. shrimp-oracle — RESEARCH ORACLE
**Repo**: https://github.com/Soul-Brews-Studio/shrimp-oracle

Go-based agent-net app with:
- SIWE (Sign-In with Ethereum) authentication
- PocketBase backend
- React web UI
- Blockchain/Web3 integration

---

## 🔨 What Needs to Be Built (v5.0)

### Priority 1 — CORE (Must Have)

#### 1A. Tmux Orchestration Layer (from maw-js tmux.ts)
```
src/tmux/index.js
```
- `Tmux` class wrapping tmux CLI
- Methods: listSessions, listWindows, sendText, capturePane, newWindow, killWindow, splitWindow
- Works on Windows via WSL fallback or native tmux (if available)
- Windows alternative: use child_process.spawn for process management

#### 1B. Process/PTY Management (from maw-js pty.ts)
```
src/pty/index.js
```
- PTY sessions for interactive terminals
- WebSocket-based terminal streaming
- Attach/detach/resize support

#### 1C. Complete Remaining 19 Commands
```
src/commands/
  archive.js      — Archive old sessions/worktrees
  assign.js       — Assign tasks to agents
  audit.js        — View audit log
  bud.js          — Spawn new oracle (yeast budding)
  comm.js         — Communication channels
  contacts.js     — Oracle contact list
  done.js         — Auto-save + cleanup
  find.js         — Search across oracles
  fleet-doctor.js — Fleet diagnostics
  fleet-health.js — Fleet health report
  fleet-init.js   — Initialize fleet
  fleet-manage.js — Fleet CRUD
  mega.js         — Batch operations
  oracle.js       — Oracle management
  park.js         — Pause agent
  pr.js           — GitHub PR management
  pulse.js        — Heartbeat management
  rename.js       — Rename agent
  restart.js      — Restart agent/hub
  reunion.js      — Sync memory back
  sleep.js        — Graceful stop
  soul-sync.js    — Memory sync across peers
  tab.js          — Tab management
  take.js         — Take over agent
  talk-to.js      — Talk to specific agent
  transport.js    — Transport diagnostics
  triggers.js     — Trigger management
  ui-install.js   — Install dashboard
  ui.js           — Open dashboard
  view.js         — View agent output
  wake.js         — Wake agent in tmux/process
  workon.js       — Work on task
  workspace.js    — Workspace management
```

#### 1D. Trigger System (from maw-js triggers.ts)
```
src/triggers/index.js
```
- Config-driven workflow triggers
- Events: issue-close, pr-merge, agent-idle, agent-wake, agent-crash
- Template variables: {agent}, {repo}, {issue}, {event}
- Once-fire support (self-destruct after first trigger)

#### 1E. Hook System (from maw-js hooks.ts)
```
src/hooks/index.js
```
- Load hooks from maw.hooks.json
- Events: message-send, agent-start, agent-stop, task-complete
- Environment variable expansion
- Async execution with timeout

#### 1F. Worktree Management (from maw-js worktrees.ts)
```
src/worktrees/index.js
```
- Scan git worktrees across repos
- Classify: active, stale, orphan
- Create/remove worktrees
- Fleet config integration

#### 1G. Audit System (from maw-js audit.ts)
```
src/audit/index.js
```
- JSONL audit logging
- Track: command, args, user, pid, timestamp, result
- Read/query audit log

#### 1H. Enhanced Plugin System (upgrade from v4)
```
src/plugins/index.js (upgrade)
```
- 4-phase lifecycle: gate → filter → handle → late
- Scoped plugins (builtin vs user)
- Hot-reload on file change
- Teardown callbacks

### Priority 2 — IMPORTANT (Should Have)

#### 2A. Config System (from maw-js config.ts)
```
src/config/index.js
```
- Full typed config with validation
- Typed defaults for intervals, timeouts, limits
- Config file: maw.config.json
- Environment variable overrides
- Config display with masking (secrets)

#### 2B. SSH/Remote Transport (from maw-js ssh.ts)
```
src/transport/ssh.js
```
- hostExec: local bash or remote SSH
- Shell substitution injection prevention
- Session listing across hosts

#### 2C. MQTT Integration (from maw-js mqtt-publish.ts)
```
src/mqtt/index.js
```
- Lightweight MQTT publish client
- Topic: oracle/{name}/inbox
- Config: mqttPublish.broker

#### 2D. Fleet System Enhancement
```
src/fleet/index.js
```
- Fleet entries with sync_peers and lineage
- Fleet health reports
- Fleet doctor (config diagnostics)
- Fleet consolidation

#### 2E. Soul Sync (memory sync across peers)
```
src/federation/soul-sync.js
```
- Sync ψ/memory/ between oracles
- Bidirectional sync
- Conflict resolution

#### 2F. Reunion (sync worktree memory back)
```
src/federation/reunion.js
```
- Copy ψ/memory/ from worktree to main oracle
- Merge learnings, retrospectives, traces

### Priority 3 — NICE TO HAVE

#### 3A. Proper React Dashboard (from maw-ui)
```
src/dashboard/
  package.json
  vite.config.ts
  src/
    apps/ (15 views)
    components/ (68 components)
    hooks/
    lib/
    core/
```
- Vite + React + TypeScript
- All 15 views from maw-ui
- WebSocket real-time updates
- Sound effects

#### 3B. ChromaDB Vector Search (from arra-oracle-v3)
```
src/memory/vector.js
```
- ChromaDB integration for semantic search
- Hybrid search (FTS5 + vectors)

#### 3C. MCP Protocol (from arra-oracle-v3)
```
src/mcp/index.js
```
- MCP server (stdio)
- 22 oracle tools
- Claude Code integration

#### 3D. 8-bit Office View (from maw-ui office-8bit)
```
src/dashboard/public/office-8bit/
```
- Rust/WASM game-like office
- Sprite animations
- Agent avatars in pixel art

#### 3E. Oracle Vault Report Generator
```
src/vault/report.js
```
- HTML report of vault statistics
- Auto-generate on sync

#### 3F. Shell Completions
```
completions/
  oracle.bash
  oracle.zsh
  oracle.ps1  (PowerShell for Windows)
```

---

## 📋 Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
1. ✅ Tmux/Process orchestration (src/tmux/, src/pty/)
2. ✅ Config system (src/config/)
3. ✅ Hook system (src/hooks/)
4. ✅ Audit system (src/audit/)
5. ✅ Enhanced plugin system (upgrade src/plugins/)
6. ✅ Trigger system (src/triggers/)

### Phase 2: Commands (Week 2)
1. ✅ All 19 missing commands
2. ✅ Command argument parser
3. ✅ Shell completions (bash/zsh/PowerShell)

### Phase 3: Federation & Fleet (Week 3)
1. ✅ SSH transport
2. ✅ MQTT integration
3. ✅ Soul sync
4. ✅ Reunion
5. ✅ Fleet system enhancement
6. ✅ Worktree management

### Phase 4: Dashboard (Week 4)
1. ✅ React app scaffold (Vite)
2. ✅ All 15 views
3. ✅ Key components (~30 essential ones)
4. ✅ WebSocket integration
5. ✅ Sound effects

### Phase 5: Advanced Features (Week 5)
1. ✅ ChromaDB vector search
2. ✅ MCP protocol server
3. ✅ Oracle vault report
4. ✅ 8-bit office (if time permits)

---

## 🔧 Technical Decisions

### Runtime: Node.js (not Bun)
- Our project uses Node.js for Windows compatibility
- Adapt all Bun-specific APIs to Node.js equivalents:
  - `Bun.spawn()` → `child_process.spawn()` or `execa`
  - `Bun.serve()` → Express (already using)
  - `import.meta.dir` → `__dirname` via `fileURLToPath`

### Framework: Express (not Hono)
- Keep Express for HTTP API (already established)
- Can add Hono routes later if needed

### Dashboard: Vite + React + TypeScript
- Separate sub-project in src/dashboard/
- Build to dist/, serve via Express static
- Fallback: CDN React (current) for quick testing

### Windows tmux Alternative
- Primary: Use tmux via WSL if available
- Fallback: Native process management (child_process)
- Use conpty on Windows for PTY support

### Config Format: maw.config.json + .env
- maw.config.json for runtime config
- .env for secrets (API keys, tokens)
- Validate with custom validator (not Zod, to keep deps minimal)

---

## 📊 Estimated Effort

| Phase | Lines of Code | Time |
|-------|--------------|------|
| Phase 1: Core Infrastructure | ~3,000 | 1 week |
| Phase 2: Commands | ~2,500 | 1 week |
| Phase 3: Federation & Fleet | ~2,000 | 1 week |
| Phase 4: Dashboard | ~8,000 | 1 week |
| Phase 5: Advanced | ~3,000 | 1 week |
| **Total** | **~18,500** | **5 weeks** |

Current project: ~7,000 lines
Target: ~25,000 lines

---

*Generated: 2026-04-13 | ARRA Office — Oracle Multi-Agent v5.0 Planning*
*Source: Deep analysis of all Soul-Brews-Studio repositories*
