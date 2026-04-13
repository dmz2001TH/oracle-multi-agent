# Stub Fixes — v5.0 → v5.1

## Summary

All 6 stub implementations have been completed to reach 100% functionality.

## Fixed Stubs

### 1. ✅ Server Logging (`src/memory/server/logging.ts`)
- **Before**: Empty function, no-op
- **After**: Full SQLite-backed logging system
  - `logSearch()` — Persists search queries with results count, timing, project context
  - `logLearn()` — Logs learning/pattern events
  - `getSearchStats()` — Aggregated analytics (total searches, avg time, top queries)
  - Auto-creates `search_log` and `learn_log` tables with indexes

### 2. ✅ Project Detection (`src/memory/server/project-detect.ts`)
- **Before**: Just returned cwd
- **After**: Smart git-based project detection
  - Tries `git remote -v` command (fast)
  - Falls back to reading `.git/config` directly (no subprocess)
  - Normalizes URLs to ghq-style format (`github.com/owner/repo`)
  - Caches result per working directory
  - Supports HTTPS and SSH git URLs

### 3. ✅ Vector Store Factory (`src/memory/vector/factory.ts`)
- **Before**: Always returned null
- **After**: SQLite-based TF-IDF vector store
  - Full `VectorStoreAdapter` implementation
  - TF-IDF scoring with cosine-like similarity
  - Supports `addDocuments()`, `query()`, `queryById()`, `getStats()`
  - Thai + English tokenization with stop word filtering
  - WAL mode for performance
  - Ready for ChromaDB upgrade (checks `VECTOR_DB=chroma` env var)

### 4. ✅ LoRa Transport (`src/transports/lora.ts`)
- **Before**: 10-line stub, all methods no-ops
- **After**: Full LoRa mesh transport implementation
  - RYLR998/RYLR896 AT command support
  - Message fragmentation for LoRa packet size limits
  - Fragment reassembly with timeout
  - Mesh flooding with configurable TTL
  - Auto-initialization of LoRa module
  - Graceful degradation (optional `serialport` dependency)
  - Proper TypeScript types matching `Transport` interface

### 5. ✅ UI State API (`src/index.ts` → `/api/ui-state`)
- **Before**: Returned empty `{}`
- **After**: Full state management
  - `GET /api/ui-state` — Returns theme, sidebar, activeView, sound settings
  - `POST /api/ui-state` — Merge updates
  - `GET /api/pin-info` — List pinned items
  - `POST /api/pin-info` — Pin/unpin items
  - `GET /api/tokens/rate` — Token usage rate tracking

### 6. ✅ Plugins API (`src/index.ts` → `/api/plugins`)
- **Before**: Returned empty `[]`
- **After**: Real plugin discovery
  - Lists built-in plugins (logger, stats)
  - Scans `./plugins/` directory for user plugins
  - Returns plugin names, hooks, and load status

## New Agent Roles Added

| Role | Definition File |
|---|---|
| `data-analyst` | `src/agents/definitions/data-analyst.md` |
| `devops` | `src/agents/definitions/devops.md` |
| `qa-tester` | `src/agents/definitions/qa-tester.md` |
| `translator` | `src/agents/definitions/translator.md` |

## Documentation Added

- `docs/HOW-TO-ADD-AGENTS.md` — Guide for adding new agents (in Thai)

## TypeScript Status

All files compile with `tsc --noEmit` — 0 errors.

## Remaining Known Limitations

- **LoRa hardware**: Requires physical LoRa module + `serialport` npm package
- **ChromaDB**: Falls back to SQLite TF-IDF; set `VECTOR_DB=chroma` when ChromaDB is available
- **Dashboard build**: Requires `cd src/dashboard && npx vite build` before production
