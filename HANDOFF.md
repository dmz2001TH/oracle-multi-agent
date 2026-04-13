# 🧠 HANDOFF — Oracle Multi-Agent v5.0 Build Progress

> **Goal**: Pull ALL features from Soul-Brews-Studio ecosystem and build oracle-multi-agent v5.0
> **Current Status**: Phase 0-6 complete, Phase 7-11 pending

---

## ✅ Phase 0-6: COMPLETE (131 files committed)

| Phase | Description | Files | Status |
|-------|-------------|-------|--------|
| 0 | TypeScript setup + Process abstraction | 4 | ✅ |
| 1 | Core infrastructure (config, paths, types, ssh, tmux, hooks, triggers, plugins, audit, peers, snapshot, routing, handlers, lib) | 25 | ✅ |
| 2 | Transports (tmux, http, hub, nanoclaw, lora) | 8 | ✅ |
| 3 | API endpoints (Hono router, 19 endpoints) | 20 | ✅ |
| 4 | Commands (49 command modules) | 49 | ✅ |
| 5 | CLI (entry, parse-args, route modules, command-registry, wasm-bridge) | 10 | ✅ |
| 6 | Server + plugins + views (builtin plugins, demo/federation/timemachine views, door.html) | 9 | ✅ |

**Quality gates passed:**
- [x] `tsc --noEmit` passes clean — 0 errors
- [x] All Bun APIs replaced with Node.js equivalents
- [x] Git committed + pushed to GitHub

---

## 🔲 Remaining Phases

### Phase 7: Dashboard React App — ~100 files
**Source**: `_ref/maw-ui/src/` → **Target**: `src/dashboard/`

- Copy from `_ref/maw-ui/` (Vite + React 19 + Tailwind CSS v4)
- 57 components in `_ref/maw-ui/src/components/`
- 16 lib modules in `_ref/maw-ui/src/lib/`
- 17 HTML entry points (index.html, mission.html, fleet.html, etc.)
- Dependencies: react, react-dom, zustand, @monaco-editor/react, @xterm/xterm, three, mqtt
- Create `src/dashboard/package.json` from maw-ui's package.json
- Copy `vite.config.ts`, `tsconfig.json`, `index.css`

### Phase 8: Memory Tools — 13+ files
**Source**: `_ref/arra-oracle-v3/src/tools/` → **Target**: `src/memory/tools/`

Tools to port:
- search.ts, reflect.ts, learn.ts, list.ts, stats.ts
- concepts.ts, supersede.ts, verify.ts
- trace.ts, schedule.ts, handoff.ts, inbox.ts
- types.ts, index.ts, forum.ts, read.ts

### Phase 9: Agents + Safety + Completions — ~20 files

**Agent definitions** (14 .md files):
- Source: `_ref/nat-brain/.claude/agents/` → `src/agents/definitions/`
- Agents: coder, critic, executor, guest-logger, context-finder, marie-kondo, md-cataloger, new-feature, note-taker, oracle-keeper, project-keeper, project-organizer, repo-auditor, security-scanner

**Safety hooks**:
- Source: `_ref/safety-hooks/` → `scripts/`
- safety-check.sh, install.sh

**Shell completions**:
- Source: `_ref/workflow-kit/src/multi_agent_kit/assets/.agents/` → `completions/`
- maw.completion.zsh
- Profile scripts (profile0-5.sh)
- Various utility scripts

**Agent config**:
- Source: `_ref/workflow-kit/src/multi_agent_kit/assets/.agents/agents.yaml` → `config/agents.yaml`

### Phase 10: Bridge + Integration
- Update `src/bridges/nanoclaw.ts` with full integration
- Update `src/index.ts` entry point
- Verify `bin/oracle` CLI binary
- Verify `.env.example`, `setup.bat`, `start.bat`, `ecosystem.config.cjs`

### Phase 11: Final QA
- `npm install` root + `src/dashboard`
- `tsc --noEmit` must pass (root project)
- README.md update
- git commit + push

---

## 📊 File Counts

| Category | Created | Target | Remaining |
|----------|---------|--------|-----------|
| Process abstraction | 4 | 4 | ✅ |
| Core infra | 25 | 25 | ✅ |
| Engine | 4 | 4 | ✅ |
| Transports | 8 | 8 | ✅ |
| API | 20 | 20 | ✅ |
| Commands | 49 | 49 | ✅ |
| CLI | 10 | 10 | ✅ |
| Server + plugins + views | 9 | 9 | ✅ |
| Dashboard | 0 | ~100 | 🔲 |
| Memory tools | 0 | 13+ | 🔲 |
| Agents + safety | 0 | ~20 | 🔲 |
| Bridge + integration | partial | 5 | 🔲 |

**Progress: ~52% (131/250+ files)**

---

## 🔧 Technical Notes

### `_ref/` Repos (all cloned ✅)
| Repo | Files | Purpose |
|------|-------|---------|
| maw-js | 230 | v4 engine, commands, transport |
| maw-ui | 210 | Dashboard React app |
| arra-oracle-v3 | 284 | Memory tools, oracle engine |
| nat-brain | 158 | Agent definitions |
| safety-hooks | 31 | Safety shell scripts |
| workflow-kit | 99 | Completions, agent config |
| shrimp-oracle | 159 | Additional oracle patterns |
| skills-cli | 177 | CLI skills |
| vault-report | 36 | Vault reporting |

### Bun → Node.js Conversion Rules
- `Bun.spawn()` → `execa` or `child_process.spawn`
- `Bun.serve()` → Hono + `@hono/node-server`
- `import.meta.dir` → `path.dirname(fileURLToPath(import.meta.url))`
- `Bun.file()` → `fs/promises.readFile`

### Legacy .js files in src/
15 .js files exist from v4 (agents/, hub/, federation/, memory/, transport/, etc.). These are the old hub-based system. v5 TypeScript versions exist alongside for CLI/commands/engine. Leave .js files as-is — they don't conflict with tsc.

---

*Last updated: 2026-04-13 14:30 GMT+8*
