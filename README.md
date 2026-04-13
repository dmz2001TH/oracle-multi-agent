# 🧠 ARRA Office — Oracle Multi-Agent System v5.0

AI agents that remember, communicate, and collaborate — with a real-time web dashboard powered by React 19 + Tailwind CSS v4.

![dashboard](https://img.shields.io/badge/dashboard-ARRA%20Office-dark-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)
![version](https://img.shields.io/badge/version-5.0.0-purple)
![node](https://img.shields.io/badge/node-%3E%3D20-green)

## What's New in v5.0

- ⚡ **15 CLI Commands** — `/awaken`, `/recap`, `/fyi`, `/rrr`, `/standup`, `/feel`, `/forward`, `/trace` (smart + deep), `/learn`, `/who-are-you`, `/philosophy`, `/skills`, `/resonance`, `/fleet`, `/pulse`
- 📋 **55 Skills Registry** — adapted from oracle-skills-cli (identity, session, memory, emotion, dev, github, team, research, automation)
- 📜 **Oracle 5 Principles** — รูปสอนสุญญตา (Nothing is Deleted, Patterns Over Intentions, External Brain, Curiosity Creates Existence, Form and Formless)
- 🔐 **ψ/ Knowledge Root** — structured memory tree (resonance, learnings, retrospectives, journal, decisions, handoffs, mood)
- 🧠 **Real Embeddings** — @xenova/transformers for local semantic search (Xenova/all-MiniLM-L6-v2)
- 🔍 **Vault API** — ψ/ directory scanner, stats, search
- 🏠 **Vault Dashboard** — public/vault.html (stats, search, skills, principles)
- 🧠 **Memory Tools (16 tools)** — search, reflect, learn, list, stats, concepts, supersede, verify, trace, schedule, handoff, inbox, forum, read — all backed by Drizzle ORM + SQLite FTS5
- 💬 **Forum System** — Threaded discussions with Oracle auto-reply, linked to knowledge base
- 🔍 **Trace System** — Discovery tracing with dig points (files, commits, issues), linked chains
- 🛡️ **Safety Hooks** — Configurable safety shell scripts per agent
- 🐚 **Shell Completions** — Bash/Zsh completions for CLI
- 🤖 **15 Agent Definitions** — Specialized agent configs (Researcher, Coder, Writer, Manager, etc.)
- 🏢 **React 19 Dashboard** — 17 HTML entries, 57 components, Vite + Tailwind CSS v4
- 🔀 **5 Transports** — tmux, HTTP, hub federation, nanoclaw, LoRa
- 🧩 **Plugin System** — Hook-based extensibility with builtin plugins
- 📡 **Hono API** — 19 REST endpoints, WebSocket support
- ⌨️ **Full CLI** — Command registry with route modules

## CLI Commands

Type in chat (WebSocket) or call via API (`POST /api/commands/execute`):

| Command | Description |
|---------|-------------|
| `/awaken` | ⚡ Identity setup ceremony |
| `/recap` | 📋 Session summary |
| `/fyi <info>` | 📝 Save to memory |
| `/rrr` | 🔄 Daily retrospective |
| `/standup` | 🧍 Daily standup |
| `/feel <mood>` | 💭 Mood logger |
| `/forward` | 🔄 Session handoff |
| `/trace <query>` | 🔍 Universal search (smart / --deep / --oracle) |
| `/learn <repo>` | 📚 Study repository |
| `/who-are-you` | 🔮 Oracle identity |
| `/philosophy` | 📜 5 Principles + Rule 6 |
| `/skills` | 📋 List/search 55 skills |
| `/resonance` | 🎵 Capture what resonates |
| `/fleet` | 🚢 Fleet census (agents, nodes, skills) |
| `/pulse` | 📊 Project board (add/done/list tasks) |
| `/help` | ❓ Show all commands |

## Quick Start

### Windows
1. Download this repo (Code → Download ZIP)
2. Extract to any folder
3. Double-click `setup.bat`
4. Edit `.env` → add your API key
5. Double-click `start.bat`
6. Open [http://localhost:3456/health](http://localhost:3456/health)

### Linux / macOS
```bash
git clone https://github.com/dmz2001TH/oracle-multi-agent.git
cd oracle-multi-agent
bash setup.sh
# Edit .env → add your API key
npm start
```

### VPS (PM2)
```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## LLM Providers

### PromptDee (default, free)
No API key needed. 5 credits/day free tier.

### Google Gemini
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIza...
```
Free tier: 60 requests/minute.

### OpenAI-compatible
```env
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
```

## CLI Commands

```bash
oracle status          # Hub health + stats
oracle overview        # System overview
oracle recap           # Last session summary
oracle fyi <query>     # Search memories
oracle rrr [limit]     # Read recent messages
oracle standup         # Daily standup
oracle chat <agent> <msg>  # Chat with agent
oracle team spawn      # Spawn a team
oracle team status     # Team status
oracle broadcast <msg> # Broadcast to all agents
oracle feed            # Recent activity feed
oracle fleet ls        # List federation peers
oracle costs           # API cost tracking
oracle handoff         # Create session handoff
oracle health [agent]  # Agent health check
oracle help            # Show all commands
```

## Memory Tools

The Oracle knowledge base uses 16 tools backed by Drizzle ORM + SQLite FTS5:

| Tool | Description |
|------|-------------|
| `search` | Hybrid search (FTS5 keywords + vector semantic) |
| `learn` | Add patterns/learnings to knowledge base |
| `read` | Read full document content |
| `list` | List documents with pagination |
| `stats` | Knowledge base statistics |
| `concepts` | Concept frequency analysis |
| `reflect` | Reflection analysis |
| `supersede` | Mark documents as outdated (Nothing is Deleted) |
| `verify` | Verify KB integrity (disk vs DB) |
| `trace` | Log discovery traces with dig points |
| `schedule` | Calendar events and reminders |
| `handoff` | Session context handoff |
| `inbox` | Read handoff inbox |
| `forum` | Threaded discussions with Oracle |

## Project Structure

```
oracle-multi-agent/
├── src/
│   ├── index.ts              # Entry point (Hono server)
│   ├── config.ts             # Configuration loader
│   ├── server.ts             # Server setup + WebSocket
│   ├── cli.ts                # CLI entry point
│   ├── engine/               # MawEngine orchestrator
│   ├── api/                  # 19 Hono REST endpoints
│   ├── commands/             # 49 command modules
│   ├── cli/                  # CLI route modules + registry
│   ├── transports/           # 5 transport implementations
│   ├── bridges/              # Nanoclaw bridge
│   ├── plugins/              # Plugin system + builtin plugins
│   ├── views/                # HTML views (demo, federation, timemachine)
│   ├── memory/               # Oracle memory system
│   │   ├── tools/            # 16 tool handlers
│   │   ├── db/               # Drizzle ORM schema + client
│   │   ├── forum/            # Forum handler
│   │   ├── trace/            # Trace handler + types
│   │   ├── vault/            # Vault handler
│   │   ├── vector/           # Vector store adapter
│   │   └── verify/           # KB verification
│   ├── dashboard/            # React 19 SPA (Vite + Tailwind v4)
│   ├── process/              # Process abstraction (tmux + node-pty)
│   ├── lib/                  # Shared utilities
│   └── agents/               # Agent definitions
├── bin/
│   └── oracle                # CLI binary
├── _ref/                     # Reference repos (9 repos)
├── ψ/                        # Oracle Vault
│   ├── inbox/                # Handoffs
│   ├── memory/               # Learnings, principles
│   └── traces/               # Discovery traces
├── .env.example              # Environment template
├── setup.bat                 # Windows setup
├── setup.sh                  # Linux/macOS setup
├── start.bat                 # Windows start
├── ecosystem.config.cjs      # PM2 config
└── tsconfig.json             # TypeScript config
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/health` | GET | API health |
| `/api/stats` | GET | System statistics |
| `/api/agents` | GET/POST | List/spawn agents |
| `/api/agents/:id` | DELETE | Stop agent |
| `/api/agents/:id/chat` | POST | Chat with agent |
| `/api/agents/:from/tell/:to` | POST | Agent-to-agent message |
| `/api/feed` | GET | Event feed |
| `/api/tasks` | GET/POST | Tasks |
| `/api/memory/search?q=` | GET | Search memories |
| `/api/memory/all` | GET | List all memories |
| `/api/traces` | GET/POST | Traces |
| `/api/vault/:section` | GET/POST | Vault sections |
| `/api/federation/peers` | GET/POST | Federation peers |
| `/api/federation/ping` | POST | Ping peers |
| `/api/broadcast` | POST | Broadcast to all agents |

### New v5.0 Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/commands` | GET | List CLI commands |
| `/api/commands/execute` | POST | Execute CLI command |
| `/api/commands/:name` | POST | Execute by name |
| `/api/skills` | GET | List/search skills (30+) |
| `/api/skills/:name` | GET | Get skill details |
| `/api/vault/stats` | GET | ψ/ directory statistics |
| `/api/vault/files` | GET | List ψ/ files |
| `/api/vault/file` | GET | Read ψ/ file |
| `/api/vault/search` | POST | Search ψ/ files |
| `/vault` | GET | Vault dashboard |
| `/api/costs` | GET | API costs |
| `/api/plugins` | GET | Plugins list |

## Testing

```bash
# Start server
npx tsx src/index.ts

# Run E2E tests (in another terminal)
npx tsx test/e2e.mjs
```

## Credits

- UI inspired by [Soul-Brews-Studio/maw-ui](https://github.com/Soul-Brews-Studio/maw-ui)
- Oracle framework from [arra-oracle-v3](https://github.com/Soul-Brews-Studio/arra-oracle-v3)
- Transport and federation from [maw-js](https://github.com/Soul-Brews-Studio/maw-js)

## License

MIT
