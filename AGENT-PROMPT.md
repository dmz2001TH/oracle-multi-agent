# 🧠 AGENT PROMPT — Oracle Multi-Agent v5.0 Complete Build

> Copy ทั้งหมดนี้แล้ววางให้ MiMo Claw agent เลย

---

```
คุณเป็น software architect กำลังสร้าง oracle-multi-agent v5.0
เป้าหมาย: ดึงโค้ดทั้งหมดจาก Soul-Brews-Studio มาให้ครบ ใช้ TypeScript
โปรเจ็ครันบน Windows ได้โดยไม่ต้องมี tmux

═══════════════════════════════════════════════════════════
ขั้นตอนแรก — ตั้งค่าโปรเจ็ค
═══════════════════════════════════════════════════════════

1. clone ทุก repo:

cd /root/.openclaw/workspace  (หรือโฟลเดอร์ทำงานของคุณ)
git clone https://github.com/dmz2001TH/oracle-multi-agent.git
cd oracle-multi-agent

git clone https://github.com/Soul-Brews-Studio/maw-js.git _ref/maw-js
git clone https://github.com/Soul-Brews-Studio/maw-ui.git _ref/maw-ui
git clone https://github.com/Soul-Brews-Studio/arra-oracle-v3.git _ref/arra-oracle-v3
git clone https://github.com/Soul-Brews-Studio/opensource-nat-brain-oracle.git _ref/nat-brain
git clone https://github.com/Soul-Brews-Studio/multi-agent-workflow-kit.git _ref/workflow-kit
git clone https://github.com/Soul-Brews-Studio/oracle-vault-report.git _ref/vault-report
git clone https://github.com/Soul-Brews-Studio/arra-oracle-skills-cli.git _ref/skills-cli
git clone https://github.com/Soul-Brews-Studio/arra-safety-hooks.git _ref/safety-hooks
git clone https://github.com/Soul-Brews-Studio/shrimp-oracle.git _ref/shrimp-oracle

2. อ่าน HANDOFF.md ในโปรเจ็คเรา — มีรายการทุกอย่างที่ต้องทำ + feature inventory

3. อ่าน _ref/maw-js/package.json, _ref/maw-js/src/server.ts, _ref/maw-js/src/config.ts
   เพื่อเข้าใจ architecture หลัก

4. ตั้งค่า TypeScript:

   npm install -D typescript @types/node tsx
   npm install hono @hono/node-server mqtt arg execa node-pty

   สร้าง tsconfig.json:
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "outDir": "dist",
       "rootDir": "src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true,
       "resolveJsonModule": true,
       "declaration": true,
       "declarationMap": true,
       "sourceMap": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist", "_ref", "src/dashboard"]
   }

   อัปเดต package.json:
   {
     "name": "oracle-multi-agent",
     "version": "5.0.0",
     "type": "module",
     "main": "dist/index.js",
     "scripts": {
       "start": "tsx src/index.ts",
       "build": "tsc",
       "dev": "tsx watch src/index.ts",
       "dashboard:dev": "cd src/dashboard && npx vite",
       "dashboard:build": "cd src/dashboard && npx vite build"
     }
   }

═══════════════════════════════════════════════════════════
สำคัญ: Windows Compatibility Rules
═══════════════════════════════════════════════════════════

โปรเจ็คต้องรันบน Windows ได้โดยไม่ต้องมี tmux

แทนที่ Bun APIs ด้วย Node.js equivalents:
- Bun.spawn() → execa (npm install execa) หรือ child_process.spawn
- Bun.serve() → Hono + @hono/node-server หรือ Express
- import.meta.dir → path.dirname(fileURLToPath(import.meta.url))
- Bun.file() → fs/promises.readFile
- require() → import (ESM)

Process Management Abstraction — สร้างไฟล์นี้ก่อนไฟล์อื่น:

src/process/index.ts — export interface ProcessManager:
  spawn(name: string, command: string, opts?: {cwd?:string, env?:Record<string,string>}): Promise<ProcessHandle>
  sendText(target: string, text: string): Promise<void>
  capture(target: string, lines?: number): Promise<string>
  kill(target: string): Promise<void>
  killAll(): Promise<void>
  list(): Promise<ProcessInfo[]>
  listWindows(session?: string): Promise<ProcessInfo[]>
  isActive(target: string): Promise<boolean>

src/process/tmux-manager.ts — ใช้ tmux CLI (Linux/Mac/WSL):
  ใช้ execa เรียก tmux commands
  methods ตรงตาม maw-js/src/tmux.ts ทุกอย่าง

src/process/nodepty-manager.ts — ใช้ node-pty (Windows native):
  ใช้ node-pty.spawn() สร้าง pseudo-terminal
  เก็บ processes ใน Map<string, node-pty.IPty>
  จัดการ output ผ่าน onData event
  เก็บ buffer สำหรับ capture

src/process/auto-detect.ts — auto-select manager:
  ตรวจสอบว่า tmux มีอยู่ใน PATH หรือไม่
  ถ้ามี → คืน TmuxManager
  ถ้าไม่มี → คืน NodePtyManager
  export function createProcessManager(): ProcessManager

ทุกไฟล์อื่นที่ต้องจัดการ process ให้ import จาก src/process/ ไม่ใช่ tmux โดยตรง

═══════════════════════════════════════════════════════════
BATCH 1: Core Infrastructure (16 ไฟล์)
═══════════════════════════════════════════════════════════

อ่านไฟล์ต้นฉบับใน _ref/maw-js/src/ แล้วสร้างไฟล์เหล่านี้ใน src/:

src/config.ts — จาก _ref/maw-js/src/config.ts
  ทั้งหมด: MawConfig, TriggerConfig, loadConfig, saveConfig, validateConfig,
  buildCommand, cfgInterval, cfgTimeout, cfgLimit, DEFAULTS
  แปลง execSync("ghq root") → execa("ghq", ["root"]) หรือ fallback path

src/paths.ts — จาก _ref/maw-js/src/paths.ts
  CONFIG_DIR, CONFIG_FILE, FLEET_DIR paths
  ใช้ os.homedir() ข้ามแพลตฟอร์ม

src/types.ts — จาก _ref/maw-js/src/types.ts
  WSData, FeedEvent, FeedEventType types

src/ssh.ts — จาก _ref/maw-js/src/ssh.ts
  hostExec(cmd, host) function
  SHELL_SUBSTITUTION tripwire
  listSessions()
  แปลง Bun.spawn → execa

src/tmux.ts — จาก _ref/maw-js/src/tmux.ts
  Tmux class: run, listSessions, listWindows, sendText, capturePane,
  newWindow, killWindow, splitWindow, switchClient
  ใช้ execa แทน Bun.spawn
  เพิ่ม try-catch สำหรับ platforms ที่ไม่มี tmux

src/hooks.ts — จาก _ref/maw-js/src/hooks.ts
  runHook(event, data) — เรียก shell scripts
  load hooks จาก ~/.oracle/maw.hooks.json

src/triggers.ts — จาก _ref/maw-js/src/triggers.ts
  fire(event, ctx) — trigger matching events
  expandAction() — แทนที่ template variables
  idleTimers, agentPrevState tracking
  getTriggers(), getTriggerHistory()

src/trigger-listener.ts — จาก _ref/maw-js/src/trigger-listener.ts
  setupTriggerListener() — hook into feed events

src/plugins.ts — จาก _ref/maw-js/src/plugins.ts (300+ lines)
  PluginSystem class: gate, filter, on, late phases
  Scoped plugins (builtin vs user)
  loadFromDir, reloadUserPlugins, watchUserPlugins
  PluginInfo type

src/audit.ts — จาก _ref/maw-js/src/audit.ts
  logAudit(cmd, args, result) — JSONL audit logging
  readAudit(count)

src/peers.ts — จาก _ref/maw-js/src/peers.ts
  Peer discovery and management

src/snapshot.ts — จาก _ref/maw-js/src/snapshot.ts
  takeSnapshot(reason) — system state snapshots

src/routing.ts — จาก _ref/maw-js/src/routing.ts
  Message routing logic

src/handlers.ts — จาก _ref/maw-js/src/handlers.ts
  WebSocket message handlers

src/find-window.ts — จาก _ref/maw-js/src/find-window.ts
  Window/session discovery

src/tab-order.ts — จาก _ref/maw-js/src/tab-order.ts
  Tab ordering management

src/oracle-registry.ts — จาก _ref/maw-js/src/oracle-registry.ts
  Oracle registration/discovery

src/curl-fetch.ts — จาก _ref/maw-js/src/curl-fetch.ts
  HTTP client with curl fallback

src/worktrees.ts — จาก _ref/maw-js/src/worktrees.ts
  Git worktree management: scanWorktrees, createWorktree, removeWorktree

src/mqtt-publish.ts — จาก _ref/maw-js/src/mqtt-publish.ts
  MQTT publish client
  mqttPublish(topic, payload)

git add -A && git commit -m "feat(v5): batch 1 — core infrastructure (16 files)"

═══════════════════════════════════════════════════════════
BATCH 2: Engine (4 ไฟล์)
═══════════════════════════════════════════════════════════

src/engine/index.ts — จาก _ref/maw-js/src/engine/index.ts
  MawEngine class: main orchestrator
  feedBuffer, feedListeners, WebSocket broadcast

src/engine/capture.ts — จาก _ref/maw-js/src/engine/capture.ts
  Screen capture for agents

src/engine/status.ts — จาก _ref/maw-js/src/engine/status.ts
  Status monitoring

src/engine/teams.ts — จาก _ref/maw-js/src/engine/teams.ts
  Team orchestration engine

git add -A && git commit -m "feat(v5): batch 2 — engine (4 files)"

═══════════════════════════════════════════════════════════
BATCH 3: Transports (6 ไฟล์)
═══════════════════════════════════════════════════════════

src/transports/index.ts — จาก _ref/maw-js/src/transports/index.ts
  createTransportRouter()

src/transports/tmux.ts — จาก _ref/maw-js/src/transports/tmux.ts
  Tmux transport layer

src/transports/http.ts — จาก _ref/maw-js/src/transports/http.ts
  HTTP federation transport

src/transports/hub.ts — จาก _ref/maw-js/src/transports/hub.ts
  Hub relay transport

src/transports/nanoclaw.ts — จาก _ref/maw-js/src/transports/nanoclaw.ts
  Nanoclaw bridge transport

src/transports/lora.ts — จาก _ref/maw-js/src/transports/lora.ts
  LoRa mesh transport

git add -A && git commit -m "feat(v5): batch 3 — transports (6 files)"

═══════════════════════════════════════════════════════════
BATCH 4: API Endpoints (21 ไฟล์)
═══════════════════════════════════════════════════════════

src/api/index.ts — จาก _ref/maw-js/src/api/index.ts
  API router (Hono)

src/api/asks.ts
src/api/avengers.ts
src/api/config.ts
src/api/costs.ts
src/api/federation.ts
src/api/feed.ts
src/api/fleet.ts
src/api/logs.ts
src/api/oracle.ts
src/api/peer-exec.ts
src/api/proxy.ts
src/api/pulse.ts
src/api/sessions.ts
src/api/teams.ts
src/api/transport.ts
src/api/triggers.ts
src/api/ui-state.ts
src/api/workspace.ts
src/api/worktrees.ts

src/lib/feed.ts — จาก _ref/maw-js/src/lib/feed.ts
  FeedEvent type, parseLine, activeOracles, describeActivity

ทุกไฟล์อ่านจาก _ref/maw-js/src/api/ ชื่อเดียวกัน

git add -A && git commit -m "feat(v5): batch 4 — API endpoints (21 files)"

═══════════════════════════════════════════════════════════
BATCH 5: Commands (49 ไฟล์)
═══════════════════════════════════════════════════════════

อ่าน _ref/maw-js/src/commands/ ทุกไฟล์ แล้วสร้าง src/commands/:

archive.ts, assign.ts, audit.ts, avengers.ts, broadcast.ts,
bud.ts, comm.ts, completions.ts, contacts.ts, costs.ts,
done.ts, federation-sync.ts, federation.ts, find.ts,
fleet-consolidate.ts, fleet-doctor.ts, fleet-health.ts,
fleet-init.ts, fleet-load.ts, fleet-manage.ts, fleet.ts,
health.ts, inbox.ts, mega.ts, oracle.ts, overview.ts,
park.ts, ping.ts, pr.ts, pulse.ts, rename.ts, restart.ts,
reunion.ts, sleep.ts, soul-sync.ts, tab.ts, take.ts,
talk-to.ts, team.ts, transport.ts, triggers.ts, ui-install.ts,
ui.ts, view.ts, wake-resolve.ts, wake-target.ts, wake.ts,
workon.ts, workspace.ts

ทุกไฟล์: อ่านต้นฉบับ → copy logic → แก้ไขเฉพาะ Bun API calls

git add -A && git commit -m "feat(v5): batch 5 — all 49 commands"

═══════════════════════════════════════════════════════════
BATCH 6: CLI (8 ไฟล์)
═══════════════════════════════════════════════════════════

src/cli.ts — จาก _ref/maw-js/src/cli.ts (entry point)

src/cli/parse-args.ts — จาก _ref/maw-js/src/cli/parse-args.ts
src/cli/route-agent.ts
src/cli/route-comm.ts
src/cli/route-fleet.ts
src/cli/route-team.ts
src/cli/route-tools.ts
src/cli/route-workspace.ts
src/cli/usage.ts

git add -A && git commit -m "feat(v5): batch 6 — CLI (8 files)"

═══════════════════════════════════════════════════════════
BATCH 7: Server + Plugins + Views (9 ไฟล์)
═══════════════════════════════════════════════════════════

src/server.ts — จาก _ref/maw-js/src/server.ts
  Hono app setup, API routes, static serving, WebSocket

src/plugins/builtin/shell-hooks.ts — จาก _ref/maw-js/src/plugins/builtin/
src/plugins/builtin/mqtt-publish.ts

src/views/index.ts — จาก _ref/maw-js/src/views/
src/views/demo.ts
src/views/federation.ts
src/views/plugins.tsx
src/views/timemachine.ts

src/static/door.html — จาก _ref/maw-js/src/static/door.html

git add -A && git commit -m "feat(v5): batch 7 — server + plugins + views (9 files)"

═══════════════════════════════════════════════════════════
BATCH 8: Dashboard — React App จาก maw-ui (ใหญ่สุด ~100 ไฟล์)
═══════════════════════════════════════════════════════════

สร้าง src/dashboard/ เป็น Vite + React + TypeScript project:

src/dashboard/package.json:
  {
    "name": "arra-office-dashboard",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "tsc && vite build",
      "preview": "vite preview"
    },
    "dependencies": {
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "zustand": "^5.0.0",
      "@xterm/xterm": "^5.5.0",
      "@xterm/addon-fit": "^0.10.0",
      "three": "^0.183.0"
    },
    "devDependencies": {
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "@types/three": "^0.183.0",
      "@vitejs/plugin-react": "^4.3.0",
      "typescript": "^5.5.0",
      "vite": "^6.0.0",
      "@tailwindcss/vite": "^4.2.0",
      "tailwindcss": "^4.2.0"
    }
  }

src/dashboard/vite.config.ts — จาก _ref/maw-ui/vite.config.ts
src/dashboard/tsconfig.json — จาก _ref/maw-ui/tsconfig.json

src/dashboard/src/main.tsx — จาก _ref/maw-ui/src/main.tsx
src/dashboard/src/App.tsx — จาก _ref/maw-ui/src/App.tsx
src/dashboard/src/index.css — จาก _ref/maw-ui/src/index.css
src/dashboard/src/vite-env.d.ts — จาก _ref/maw-ui/src/vite-env.d.ts
src/dashboard/src/quickCommands.ts — จาก _ref/maw-ui/src/quickCommands.ts

Apps (15 views) — อ่าน _ref/maw-ui/src/apps/ ทุกไฟล์:
src/dashboard/src/apps/office.tsx
src/dashboard/src/apps/chat.tsx
src/dashboard/src/apps/dashboard.tsx
src/dashboard/src/apps/federation.tsx
src/dashboard/src/apps/federation_2d.tsx
src/dashboard/src/apps/fleet.tsx
src/dashboard/src/apps/arena.tsx
src/dashboard/src/apps/inbox.tsx
src/dashboard/src/apps/mission.tsx
src/dashboard/src/apps/terminal.tsx
src/dashboard/src/apps/overview.tsx
src/dashboard/src/apps/config.tsx
src/dashboard/src/apps/feed-monitor.tsx
src/dashboard/src/apps/party.tsx
src/dashboard/src/apps/workspace.tsx
src/dashboard/src/apps/v2.tsx

Components (68 ไฟล์) — อ่าน _ref/maw-ui/src/components/ ทุกไฟล์:
ทุกไฟล์ .tsx และ .ts ใน _ref/maw-ui/src/components/ และ subdirectories

Hooks — อ่าน _ref/maw-ui/src/hooks/ ทุกไฟล์:
src/dashboard/src/hooks/useDevice.ts
src/dashboard/src/hooks/useFederationData.ts
src/dashboard/src/hooks/useFederationList.ts
src/dashboard/src/hooks/useFileAttach.tsx
src/dashboard/src/hooks/useMqtt.ts
src/dashboard/src/hooks/useSessions.ts
src/dashboard/src/hooks/useWebSocket.ts

Lib — อ่าน _ref/maw-ui/src/lib/ ทุกไฟล์:
src/dashboard/src/lib/ansi.ts
src/dashboard/src/lib/api.ts
src/dashboard/src/lib/avatar.ts
src/dashboard/src/lib/constants.ts
src/dashboard/src/lib/federation.ts
src/dashboard/src/lib/feedStatusStore.ts
src/dashboard/src/lib/feed.ts
src/dashboard/src/lib/peerConnection.ts
src/dashboard/src/lib/peerConnectionBanner.ts
src/dashboard/src/lib/peerExecClient.ts
src/dashboard/src/lib/peerProxyClient.ts
src/dashboard/src/lib/previewStore.ts
src/dashboard/src/lib/sounds.ts
src/dashboard/src/lib/store.ts
src/dashboard/src/lib/types.ts

Core — อ่าน _ref/maw-ui/src/core/:
src/dashboard/src/core/AppShell.tsx
src/dashboard/src/core/mount.tsx

HTML entry points — จาก _ref/maw-ui/:
arena.html, chat.html, config.html, dashboard.html, federation.html,
federation_2d.html, fleet.html, inbox.html, office.html, overview.html,
shrine.html, talk.html, terminal.html, timemachine.html, workspace.html
→ src/dashboard/ ทุกไฟล์

Public assets:
src/dashboard/public/favicon.svg — จาก _ref/maw-ui/public/
src/dashboard/public/*.mp3 — จาก _ref/maw-ui/public/ (sound effects)

Office 8-bit (ถ้ามีเวลา):
src/dashboard/office-8bit/ — จาก _ref/maw-ui/office-8bit/ ทั้งหมด

cd src/dashboard && npm install
git add -A && git commit -m "feat(v5): batch 8 — dashboard React app (100+ files)"

═══════════════════════════════════════════════════════════
BATCH 9: Memory Tools จาก arra-oracle-v3 (13 ไฟล์)
═══════════════════════════════════════════════════════════

อ่าน _ref/arra-oracle-v3/src/tools/ ทุกไฟล์ แล้วสร้าง:

src/memory/tools/search.ts — oracle_search (hybrid FTS5 + vector)
src/memory/tools/reflect.ts — oracle_reflect (random wisdom)
src/memory/tools/learn.ts — oracle_learn (add patterns)
src/memory/tools/list.ts — oracle_list (browse documents)
src/memory/tools/stats.ts — oracle_stats (database statistics)
src/memory/tools/concepts.ts — oracle_concepts (concept tags)
src/memory/tools/supersede.ts — oracle_supersede (mark superseded)
src/memory/tools/verify.ts — oracle_verify (verify documents)
src/memory/tools/thread.ts — oracle_thread (thread CRUD)
src/memory/tools/trace.ts — oracle_trace (trace CRUD)
src/memory/tools/schedule.ts — oracle_schedule (schedule entries)
src/memory/tools/handoff.ts — oracle_handoff (session handoff)
src/memory/tools/inbox.ts — oracle_inbox (inbox messages)

git add -A && git commit -m "feat(v5): batch 9 — memory tools from arra-oracle-v3 (13 files)"

═══════════════════════════════════════════════════════════
BATCH 10: Agent Definitions + Safety + Completions
═══════════════════════════════════════════════════════════

Agent definitions จาก _ref/nat-brain/.claude/agents/:
src/agents/definitions/coder.md
src/agents/definitions/critic.md
src/agents/definitions/executor.md
src/agents/definitions/context-finder.md
src/agents/definitions/guest-logger.md
src/agents/definitions/marie-kondo.md
src/agents/definitions/md-cataloger.md
src/agents/definitions/new-feature.md
src/agents/definitions/note-taker.md
src/agents/definitions/oracle-keeper.md
src/agents/definitions/project-keeper.md
src/agents/definitions/project-organizer.md
src/agents/definitions/repo-auditor.md
src/agents/definitions/security-scanner.md

Safety hooks จาก _ref/safety-hooks/:
scripts/safety-check.sh
scripts/install-hooks.sh

Shell completions จาก _ref/workflow-kit/:
completions/oracle.bash — จาก maw.completion.bash
completions/oracle.zsh — จาก maw.completion.zsh
completions/oracle.ps1 — สร้างใหม่สำหรับ PowerShell/Windows

Agent config จาก _ref/workflow-kit/:
config/agents.yaml — จาก agents.yaml

git add -A && git commit -m "feat(v5): batch 10 — agent defs + safety + completions"

═══════════════════════════════════════════════════════════
BATCH 11: Bridge + Integration
═══════════════════════════════════════════════════════════

src/bridges/nanoclaw.ts — จาก _ref/maw-js/src/bridges/nanoclaw.ts

สร้าง src/index.ts — Entry point ที่รวมทุกอย่าง:
  import { startServer } from "./server.js";
  import { loadConfig } from "./config.js";
  import { createProcessManager } from "./process/auto-detect.js";
  import { PluginSystem } from "./plugins.js";
  import { MawEngine } from "./engine/index.js";

  เริ่มต้น: load config → create process manager → init plugins → start server

สร้าง bin/oracle — CLI entry point (#!/usr/bin/env node)

อัปเดต .env.example ให้ครอบคลุม config ทั้งหมด
อัปเดต setup.bat / start.bat สำหรับ Windows
อัปเดต ecosystem.config.cjs สำหรับ PM2

git add -A && git commit -m "feat(v5): batch 11 — bridge + integration + entry points"

═══════════════════════════════════════════════════════════
BATCH 12: Final — Test + Fix + README
═══════════════════════════════════════════════════════════

1. รัน tsc --noEmit แก้ type errors ทั้งหมด
2. รัน npm install ใน root + src/dashboard
3. ทดสอบ import ทุกไฟล์
4. อัปเดต README.md สำหรับ v5.0
5. อัปเดต HANDOFF.md ว่าทำอะไรเสร็จบ้าง

git add -A
git commit -m "feat(v5.0): complete Soul-Brews-Studio port — all repos, TypeScript, Windows native"
git push origin main

═══════════════════════════════════════════════════════════
สรุปสิ่งที่ต้องทำ
═══════════════════════════════════════════════════════════

Source → Target:
  _ref/maw-js/src/ (123 ไฟล์ .ts) → src/ (ทุกไฟล์)
  _ref/maw-ui/src/ (100+ ไฟล์) → src/dashboard/src/ (ทุกไฟล์)
  _ref/maw-ui/*.html (15 ไฟล์) → src/dashboard/ (ทุกไฟล์)
  _ref/arra-oracle-v3/src/tools/ (13 ไฟล์) → src/memory/tools/ (ทุกไฟล์)
  _ref/nat-brain/.claude/agents/ (14 ไฟล์) → src/agents/definitions/ (ทุกไฟล์)
  _ref/workflow-kit/ (completions + agents.yaml) → completions/ + config/
  _ref/safety-hooks/ (2 ไฟล์) → scripts/

รวม ~250+ ไฟล์ TypeScript ที่ต้องสร้าง

กฎสำคัญ:
1. ใช้ TypeScript (.ts/.tsx) ทุกไฟล์ — ไม่ต้องแปลงเป็น JS
2. ใช้ Node.js runtime — แปลงเฉพาะ Bun APIs
3. copy โค้ดจากต้นฉบับให้มากที่สุด — logic เหมือนเดิม 95%+
4. แก้ไขเฉพาะ: import paths, Bun API calls, platform-specific code
5. เขียนทีละ batch (5-15 ไฟล์) แล้ว git commit ทุก batch
6. ถ้า TypeScript compile error → แก้ type ให้ถูก
7. หลังเขียนเสร็จ → tsc --noEmit ต้องผ่าน
8. Process management ต้องมี abstraction: tmux (Linux) + node-pty (Windows)
```
