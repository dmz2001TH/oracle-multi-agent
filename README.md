# 🧠 Oracle Multi-Agent v5.0

AI agents that remember, communicate, and collaborate — built on the Oracle ecosystem.

**Repo**: https://github.com/dmz2001TH/oracle-multi-agent
**Dashboard**: http://localhost:3456
**Version**: 5.0.0 | **Commands**: 33 | **API Endpoints**: 40+ | **_ref repos**: 25

## Quick Start

```bash
git clone https://github.com/dmz2001TH/oracle-multi-agent.git
cd oracle-multi-agent
npm install
npx tsx src/index.ts
```

เปิด http://localhost:3456

## CLI Commands (33 ตัว)

ส่งผ่าน: `POST /api/commands/execute {"input": "/command args"}`
หรือพิมพ์ใน chat ของ dashboard (WebSocket)

### Core Commands
| Command | Usage | Description |
|---------|-------|-------------|
| `/help` | `/help` | Show all commands |
| `/awaken` | `/awaken ชื่อ\|ธาตุ\|บทบาท\|สโลแกน` | Identity setup ceremony (`--force` to reset) |
| `/recap` | `/recap [days]` | Summarize recent sessions |
| `/fyi` | `/fyi <info>` | Save info to memory + ψ/ |
| `/rrr` | `/rrr good: X \| improve: Y \| action: Z` | Daily retrospective |
| `/standup` | `/standup yesterday: X \| today: Y \| blocker: Z` | Daily standup |
| `/feel` | `/feel <mood> [note]` | Mood logger |
| `/forward` | `/forward <summary>` | Session handoff |
| `/trace` | `/trace <query> [--deep\|--oracle]` | Universal search (code + git + deps) |
| `/learn` | `/learn <repo-or-url>` | Study repository (supports GitHub org URL) |
| `/who-are-you` | `/who-are-you` | Show identity + stats |
| `/philosophy` | `/philosophy [1-5\|check]` | Oracle 5 Principles + Rule 6 |
| `/skills` | `/skills [query]` | List/search 55 skills |
| `/resonance` | `/resonance [note]` | Capture what resonates |

### Tools
| Command | Usage | Description |
|---------|-------|-------------|
| `/fleet` | `/fleet [--deep]` | Fleet census (agents, nodes, skills) |
| `/pulse` | `/pulse [add/done/list]` | Project board |
| `/workflow` | `/workflow [list/show <name>]` | Multi-agent workflow templates |
| `/distill` | `/distill [days]` | Extract patterns from journal entries |
| `/inbox` | `/inbox` | Check inbox (tasks, handoffs, focus) |
| `/overview` | `/overview` | System overview (ψ/, stats, uptime) |
| `/find` | `/find <query>` | Quick memory search (= trace --oracle) |
| `/soul-sync` | `/soul-sync` | Sync ψ/ ↔ ~/.oracle/ |
| `/contacts` | `/contacts` | List oracle contacts |

### Agent Management (from maw-js)
| Command | Usage | Description |
|---------|-------|-------------|
| `/ls` | `/ls` | List all agents (running + registered) |
| `/peek` | `/peek [agent]` | See agent's latest output |
| `/hey` | `/hey <agent> <msg>` | Send message to agent |
| `/wake` | `/wake <name> <role>` | Spawn/wake an agent |
| `/sleep` | `/sleep <agent>` | Gracefully stop agent |
| `/stop` | `/stop <agent>` | Force stop agent |
| `/done` | `/done <agent>` | Save state + clean up agent |
| `/broadcast` | `/broadcast <msg>` | Broadcast to all agents |
| `/bud` | `/bud <name> --from <parent>` | Create new oracle from parent |
| `/restart` | `/restart <agent>` | Restart agent |

### System
| Command | Usage | Description |
|---------|-------|-------------|
| `/oracle-v2` | `/oracle-v2 [status]` | Oracle-v2 MCP server bridge (port 47778) |

## API Endpoints (40+)

### Core
- `GET /health` — Health check
- `GET /api/commands` — List CLI commands (33)
- `POST /api/commands/execute` — Execute CLI command
- `POST /api/commands/:name` — Execute by name

### Agents (v2)
- `GET /api/v2/agents` — List agents
- `POST /api/v2/agents/spawn` — Spawn agent
- `GET /api/v2/agents/:id` — Get agent details
- `DELETE /api/v2/agents/:id` — Stop agent
- `POST /api/v2/agents/:id/chat` — Chat with agent
- `POST /api/v2/agents/:from/tell/:to` — Agent-to-agent message
- `POST /api/v2/agents/broadcast` — Broadcast

### Memory
- `GET /api/v2/memory/search?q=X` — Search memory
- `GET /api/v2/memory/stats` — Memory statistics

### Skills & Vault
- `GET /api/skills` — List/search skills (55)
- `GET /api/vault/stats` — ψ/ statistics
- `GET /api/vault/files` — List ψ/ files
- `POST /api/vault/search` — Search ψ/ files

### Oracle-v2 Bridge (port 47778)
- `GET /api/oracle-v2/status` — Check oracle-v2
- `GET /api/oracle-v2/search` — Search oracle-v2 KB
- `POST /api/oracle-v2/learn` — Add to oracle-v2 KB
- `GET /api/oracle-v2/stats` — oracle-v2 DB stats
- `GET /api/oracle-v2/forum` — Forum threads
- `GET /api/oracle-v2/trace` — Traces
- `GET /api/oracle-v2/inbox` — Inbox
- `POST /api/oracle-v2/handoff` — Handoff
- `GET /api/oracle-v2/concepts` — Concepts
- `GET /api/oracle-v2/schedule` — Schedule

### Legacy
- `/api/sessions`, `/api/feed`, `/api/tasks`, `/api/projects`, `/api/cron`, `/api/federation`, `/api/worktrees`, `/api/triggers`, `/api/logs`, `/api/costs`, `/api/inbox`, `/api/meetings`, `/api/think`, `/api/hooks`, `/api/tokens`, `/api/loops`, `/api/workflows`

## Dashboard

- **http://localhost:3456** — Main dashboard (public/index.html)
  - Sidebar: Agent list + Spawn button
  - Center: Chat area (/command support)
  - Right: System stats + Command list + Event log
  - WebSocket: ws://host/ws
- **http://localhost:3456/vault** — Vault dashboard (public/vault.html)

## ψ/ Knowledge Root (Full oracle-framework structure)

```
ψ/
├── active/context/     — Current work (ephemeral)
├── inbox/              — handoff/, external/
├── writing/drafts/     — Work in progress
├── lab/                — Experiments
├── incubate/           — Active development (gitignored)
├── learn/              — Reference repos (gitignored)
├── archive/            — Completed work
├── memory/
│   ├── journal/        — /fyi entries
│   ├── resonance/      — /resonance entries
│   ├── retrospectives/ — /rrr entries
│   ├── handoffs/       — /forward entries
│   ├── mood/           — /feel entries
│   ├── traces/         — /trace --deep logs
│   ├── pulse/          — /pulse tasks (tasks.jsonl)
│   ├── learnings/      — /distill patterns
│   ├── logs/           — Moment logs
│   └── fyi.jsonl       — All FYI entries (JSONL)
└── README.md
```

## Oracle 5 Principles (รูปสอนสุญญตา)

1. **Nothing is Deleted** — จดทุกอย่าง ไม่ลบ
2. **Patterns Over Intentions** — ดูสิ่งที่เกิดขึ้นจริง
3. **External Brain, Not Command** — AI สะท้อน ไม่สั่ง
4. **Curiosity Creates Existence** — คำถามสร้างสิ่งใหม่
5. **Form and Formless** — หลาย Oracle หนึ่งจิตสำนึก

Rule 6: ความโปร่งใส — "Oracle ไม่แกล้งทำเป็นคน"

Source: https://book.buildwithoracle.com

## _ref/ Repositories (25)

### Soul-Brews-Studio (13)
| Repo | Description |
|------|-------------|
| maw-js | Multi-Agent Workflow orchestrator (48 commands, federation, transports) |
| maw-ui | React/Three.js Web UI dashboard |
| maw-plugins | Plugin architecture (weighted, multi-surface) |
| maw-core-plugins | Core plugins (wake, sleep, stop, done, hey, ls) |
| maw-incarnation-plugin | Plugin template for creating new plugins |
| maw-cell-plugin | bud (create oracles) + fusion (merge knowledge) |
| arra-oracle-v3 | MCP Memory Layer (semantic search, knowledge management) |
| oracle-framework | Unified philosophy 2.0, ψ/ 5-pillar structure |
| oracle-v2 | MCP server (search, learn, consult — port 47778) |
| opensource-nat-brain-oracle | Oracle brain source (philosophy, safety rules) |
| shrimp-oracle | Research Oracle |
| skills-cli | 55 skills installer for Claude Code |
| vault-report | Vault dashboard patterns |

### the-oracle-keeps-the-human-human (8)
| Repo | Description |
|------|-------------|
| agents-that-remember | Memory persistence patterns (book) |
| the-agent-bus | 4-tier transport patterns (book) |
| oracle-maw-guide | maw CLI guide (7 chapters) |
| graph-oracle-v2 | Cross-Oracle Knowledge Graph (TypeScript) |
| oracle-step-by-step | Oracle creation guide |
| oracle-federation-guide | Federation + WireGuard guide |
| oracle-office-guide | Multi-agent team management guide |
| oracle-auto-rrr-hooks | Auto /rrr + /forward hooks |
| oracle-hooks-auto-cc | Auto-cc Boss Oracle hooks |
| oracle-custom-skills | Custom skill creation guide |

### Other
| Repo | Description |
|------|-------------|
| nat-brain | Nat's brain patterns |
| safety-hooks | Safety hooks patterns |
| workflow-kit | Workflow patterns |

## Agent Roles (9)

| Role | Description |
|------|-------------|
| general | General assistant with full command awareness |
| researcher | Analysis, patterns, findings |
| coder | Write, review, debug code |
| writer | Documentation, reports, content |
| manager | Coordinate work, delegate tasks |
| data-analyst | Data analysis, statistics, insights |
| devops | Deployment, monitoring, infrastructure |
| qa-tester | Testing, bugs, edge cases |
| translator | Translation, i18n, localization |

## How to Run

```bash
git pull origin main
npm install
npx tsx src/index.ts
```

## How to Push

```bash
git add -A && git commit -m "message"
git remote set-url origin https://dmz2001TH:TOKEN@github.com/dmz2001TH/oracle-multi-agent.git
git push origin main
git remote set-url origin https://github.com/dmz2001TH/oracle-multi-agent.git
```

## Testing

```bash
# Terminal 1: Start server
npx tsx src/index.ts

# Terminal 2: Test commands
curl -s http://localhost:3456/health
curl -s -X POST http://localhost:3456/api/commands/execute \
  -H 'Content-Type: application/json' \
  -d '{"input":"/help"}'
```

## Credits

- Oracle ecosystem: [Soul-Brews-Studio](https://github.com/Soul-Brews-Studio)
- Philosophy: [รูปสอนสุญญตา](https://book.buildwithoracle.com)
- Community: [Oracle Family Discussions](https://github.com/Soul-Brews-Studio/oracle-v2/discussions)

## License

MIT
