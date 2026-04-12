# 🧠 ARRA Office — Oracle Multi-Agent System

AI agents that remember, communicate, and collaborate — with a real-time web dashboard inspired by [Soul-Brews-Studio/maw-ui](https://github.com/Soul-Brews-Studio/maw-ui).

![Dashboard](https://img.shields.io/badge/dashboard-ARRA%20Office-dark-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)

## ✨ Features

- 🏢 **ARRA Office Dashboard** — Agent grid with chibi avatars, status auras, real-time updates
- 💬 **Chat Interface** — Chat-style conversation with any agent, grouped bubbles, typing indicators
- 🤖 **Multi-Agent System** — Spawn specialized agents (Researcher, Coder, Writer, Manager, General)
- 💾 **Persistent Memory** — SQLite FTS5 full-text search across all memories
- 🔌 **Agent Communication** — Agents can talk to each other and collaborate on tasks
- 📋 **Task Queue** — Kanban board: Pending → Active → Done
- 📊 **Real-time Dashboard** — Metrics, activity timeline, WebSocket live updates
- 🔍 **Trace System** — Track query chains and reasoning
- 🔀 **Session Handoffs** — Save and restore session context
- 🪟 **Windows Native** — Double-click setup and start, no WSL required

## 🚀 Quick Start (Windows)

1. **Download** this repo (Code → Download ZIP)
2. **Extract** to any folder
3. **Double-click `setup.bat`**
4. **Edit `.env`** → add your API key (see below)
5. **Double-click `start.bat`**
6. **Open** [http://localhost:3456/dashboard](http://localhost:3456/dashboard)
7. Click **"+ Spawn Agent"** and start chatting!

### API Key Setup

**Option A: PromptDee (Free, default)**
- No API key needed! Works out of the box.
- Free tier: 5 credits/day

**Option B: Google Gemini**
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create an API key
3. In `.env`, set:
   ```
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=AIza...
   ```
4. Free tier: 60 requests/minute

## 🖥️ Dashboard

Open [http://localhost:3456/dashboard](http://localhost:3456/dashboard)

### Views

| View | Icon | Description |
|------|------|-------------|
| **Office** | 🏢 | Agent grid with chibi avatars, status, quick actions |
| **Chat** | 💬 | Talk to agents — select agent, type message, get response |
| Dashboard | 📊 | System metrics, activity timeline |
| Tasks | 📋 | Kanban board (pending → active → done) |
| Memory | 🧠 | FTS5 full-text memory search |
| Traces | 🔍 | Query traces and chains |
| Handoffs | 🔀 | Session handoffs between runs |

### Chat

The **Chat** view lets you:
- Select any running agent from the sidebar
- Type messages and get real-time responses (Enter to send, Shift+Enter for newline)
- Watch agents use tools (remember, search, tell other agents)
- Spawn new agents with the "+ New" button

## 🤖 Agent Roles

| Role | Icon | Best For |
|------|------|----------|
| General | 🤖 | All-purpose assistant |
| Researcher | 🔬 | Analysis, finding patterns |
| Coder | 💻 | Writing/debugging code |
| Writer | ✍️ | Documentation, content |
| Manager | 👔 | Coordinating agents |

Each agent can:
- **Remember** — Store information in long-term memory
- **Search memory** — Find relevant past information
- **Talk to other agents** — Send messages and collaborate
- **Create tasks** — Track work items
- **Check messages** — Read from shared channels

## 🛠️ CLI Commands

```bash
oracle status              # Hub health + stats
oracle recap               # Last session summary
oracle fyi <query>         # Search memories
oracle rrr [limit]         # Read recent messages
oracle standup             # Daily standup
oracle chat <agent> <msg>  # Chat with agent
oracle team spawn          # Spawn a team
oracle team status         # Team status
oracle handoff             # Create session handoff
oracle health [agent]      # Agent health check
```

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/stats` | GET | System statistics |
| `/api/agents` | GET/POST | List/spawn agents |
| `/api/agents/:id` | DELETE | Stop agent |
| `/api/agents/:id/chat` | POST | Chat with agent |
| `/api/agents/:from/tell/:to` | POST | Agent-to-agent message |
| `/api/messages` | GET/POST | Messages |
| `/api/tasks` | GET/POST | Tasks |
| `/api/memory/search?q=` | GET | Search memories |
| `/api/memory/all` | GET | List all memories |
| `/api/traces` | GET/POST | Traces |
| `/api/handoff` | GET/POST | Session handoffs |
| `/dashboard` | GET | Web dashboard |

## 📁 Project Structure

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
│   │   └── promptdee-client.js # PromptDee API (alternative)
│   ├── memory/
│   │   └── store.js          # SQLite FTS5 memory store
│   ├── dashboard/
│   │   └── public/
│   │       └── index.html    # ARRA Office dashboard
│   └── cli/
│       └── index.js          # CLI commands
├── scripts/
│   └── setup.js              # Setup script
├── bin/
│   └── oracle                # CLI entry point
├── start.bat                 # Windows start script
├── setup.bat                 # Windows setup script
├── .env.example              # Environment template
└── package.json
```

## 🔧 Windows Notes

- **Native support** — Works directly on Windows with `start.bat`
- **No WSL needed** — Pure Node.js, runs natively
- **Node.js 18+** required — Download from [nodejs.org](https://nodejs.org/)

## 🙏 Credits

- UI inspired by [Soul-Brews-Studio/maw-ui](https://github.com/Soul-Brews-Studio/maw-ui) (ARRA Office)
- Chibi avatar system based on [Soul-Brews-Studio](https://github.com/Soul-Brews-Studio) design
- Oracle framework patterns from [arra-oracle-v3](https://github.com/Soul-Brews-Studio/arra-oracle-v3)

## 📝 License

MIT
