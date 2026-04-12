# 🧠 ARRA Office — Oracle Multi-Agent System v4.0

AI agents that remember, communicate, and collaborate — with a real-time web dashboard inspired by [Soul-Brews-Studio/maw-ui](https://github.com/Soul-Brews-Studio/maw-ui).

![dashboard](https://img.shields.io/badge/dashboard-ARRA%20Office-dark-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)
![version](https://img.shields.io/badge/version-4.0.0-purple)

## What's New in v4.0

- 🏢 **ARRA Office Dashboard** — Full React SPA with 12 views (Office, Chat, Dashboard, Tasks, Memory, Traces, Feed, Vault, Fleet, Inbox, Terminal, Config)
- 💬 **Chat Interface** — Chat-style conversation with any agent, real-time responses
- 🤖 **Multi-Agent System** — Spawn specialized agents (Researcher, Coder, Writer, Manager, General)
- 💾 **Persistent Memory** — SQLite FTS5 full-text search across all memories
- 🔌 **Agent Communication** — Agents can talk to each other and collaborate on tasks
- 📋 **Task Queue** — Kanban board: Pending → Active → Done
- 📊 **Real-time Dashboard** — Metrics, activity timeline, WebSocket live updates
- 🔍 **Trace System** — Track query chains and reasoning
- 🔀 **Session Handoffs** — Save and restore session context
- 🔐 **Oracle Vault (ψ/)** — File-based knowledge management (inbox, memory, writing, lab, traces, threads)
- 🌐 **Federation Mesh** — Multi-machine communication with HMAC-SHA256 authentication
- 🔌 **Transport Layer** — Pluggable transports (local, WebSocket, HTTP federation)
- 🧩 **Plugin System** — Hook-based extensibility (agent_spawn, agent_message, feed_event, etc.)
- 📡 **Event Feed** — Real-time event stream with filtering
- 💰 **Cost Tracking** — API usage monitoring per agent
- 📢 **Broadcast** — Send messages to all agents at once
- 🪟 **Windows Native** — Double-click setup and start, no WSL required

## Quick Start (Windows)

1. Download this repo (Code → Download ZIP)
2. Extract to any folder
3. Double-click `setup.bat`
4. Edit `.env` → add your API key (see below)
5. Double-click `start.bat`
6. Open [http://localhost:3456/dashboard](http://localhost:3456/dashboard)
7. Click "+ Spawn Agent" and start chatting!

## LLM Providers

### Option A: PromptDee (Free, default)
- No API key needed! Works out of the box.
- Free tier: 5 credits/day

### Option B: Google Gemini
- Go to [Google AI Studio](https://aistudio.google.com/apikey)
- Create an API key
- In `.env`, set:
```
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIza...
```
- Free tier: 60 requests/minute

### Option C: OpenAI-compatible
- Set `OPENAI_API_KEY` and `OPENAI_BASE_URL` in `.env`

## Dashboard Views

| View | Icon | Description |
|------|------|-------------|
| Office | 🏢 | Agent grid with avatars, status, quick actions |
| Chat | 💬 | Talk to agents — select agent, type message, get response |
| Dashboard | 📊 | System metrics, activity timeline |
| Tasks | 📋 | Kanban board (pending → active → done) |
| Memory | 🧠 | FTS5 full-text memory search |
| Traces | 🔍 | Query traces and chains |
| Feed | 📡 | Real-time event stream with filters |
| Vault | 🔐 | ψ/ file system (inbox, memory, writing, lab, traces) |
| Fleet | 🌐 | Federation peer management |
| Inbox | 📥 | Action items with resolve |
| Terminal | ⌨️ | Built-in CLI |
| Config | ⚙️ | System config, plugins, API endpoints |

## Agent Roles

| Role | Icon | Best For |
|------|------|----------|
| General | 🤖 | All-purpose assistant |
| Manager | 👔 | Coordinating agents |
| Coder | 💻 | Writing/debugging code |
| Researcher | 🔬 | Analysis, finding patterns |
| Writer | ✍️ | Documentation, content |

Each agent can:
- **Remember** — Store information in long-term memory
- **Search memory** — Find relevant past information
- **Talk to other agents** — Send messages and collaborate
- **Create tasks** — Track work items
- **Check messages** — Read from shared channels

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
oracle vault status    # Vault status
oracle fleet ls        # List federation peers
oracle costs           # API cost tracking
oracle handoff         # Create session handoff
oracle health [agent]  # Agent health check
oracle help            # Show all commands
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
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
| `/api/vault/status` | GET | Vault status |
| `/api/vault/:section` | GET/POST | Vault sections |
| `/api/federation/peers` | GET/POST | Federation peers |
| `/api/federation/ping` | POST | Ping peers |
| `/api/peer/exec` | POST | Remote command exec |
| `/api/broadcast` | POST | Broadcast to all agents |
| `/api/costs` | GET | API costs |
| `/api/plugins` | GET | Plugins list |
| `/api/handoff` | GET/POST | Session handoffs |
| `/api/slash` | POST | Slash commands |
| `/dashboard` | GET | Web dashboard |

## Project Structure

```
oracle-multi-agent/
├── src/
│   ├── hub/
│   │   ├── index.js          # Entry point
│   │   ├── server.js         # Express + WebSocket server
│   │   └── team.js           # Team orchestrator
│   ├── agents/
│   │   ├── manager.js        # Agent lifecycle management
│   │   ├── worker.js         # Agent process entry point
│   │   ├── gemini-client.js  # Gemini API + tool calling
│   │   └── promptdee-client.js # PromptDee API
│   ├── memory/
│   │   ├── store.js          # SQLite FTS5 memory store
│   │   └── vault.js          # Oracle Vault (ψ/ file system)
│   ├── transport/
│   │   └── index.js          # Transport abstraction layer
│   ├── engine/
│   │   └── index.js          # Oracle Engine (orchestration)
│   ├── federation/
│   │   └── index.js          # Federation mesh (HMAC-SHA256)
│   ├── plugins/
│   │   └── index.js          # Plugin system
│   ├── commands/
│   │   └── index.js          # Command registry (30+ commands)
│   ├── dashboard/
│   │   └── public/
│   │       └── index.html    # React SPA dashboard (12 views)
│   └── cli/
│       └── index.js          # CLI entry point
├── scripts/
│   └── setup.js              # Setup script
├── bin/
│   └── oracle                # CLI binary
├── plugins/                  # User plugins (auto-loaded)
├── data/                     # SQLite database
├── ψ/                        # Oracle Vault
│   ├── inbox/
│   ├── memory/
│   ├── writing/
│   ├── lab/
│   ├── outbox/
│   ├── sessions/
│   ├── traces/
│   └── threads/
├── start.bat                 # Windows start script
├── setup.bat                 # Windows setup script
├── .env.example              # Environment template
├── ecosystem.config.cjs      # PM2 config
└── package.json
```

## Windows Support

- ✅ Native support — Works directly on Windows with `start.bat`
- ✅ No WSL needed — Pure Node.js, runs natively
- ✅ Node.js 18+ required — Download from [nodejs.org](https://nodejs.org/)

## VPS Deployment

```bash
# Using PM2
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

# Or directly
node src/hub/index.js
```

## Credits

- UI inspired by [Soul-Brews-Studio/maw-ui](https://github.com/Soul-Brews-Studio/maw-ui) (ARRA Office)
- Chibi avatar system based on [Soul-Brews-Studio](https://github.com/Soul-Brews-Studio) design
- Oracle framework patterns from [arra-oracle-v3](https://github.com/Soul-Brews-Studio/arra-oracle-v3)
- Transport and federation concepts from [maw-js](https://github.com/Soul-Brews-Studio/maw-js)
- Plugin system inspired by [maw-js](https://github.com/Soul-Brews-Studio/maw-js)

## License

MIT
