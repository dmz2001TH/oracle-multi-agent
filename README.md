# 🧠 Oracle Multi-Agent System

AI agents that remember, communicate, and collaborate — built for Gemini API.

![Dashboard](https://img.shields.io/badge/dashboard-OLED-dark-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

- 🤖 **Multi-Agent System** — Spawn specialized agents (Researcher, Coder, Writer, Manager)
- 💬 **Chat Interface** — Talk to agents directly from the web dashboard
- 💾 **Persistent Memory** — SQLite FTS5 full-text search across all memories
- 🔌 **Agent Communication** — Agents can talk to each other and collaborate
- 📋 **Task Queue** — Assign tasks to agents, track progress
- 📊 **Web Dashboard** — Real-time OLED dark mode dashboard with chat
- 🪟 **Windows Support** — Works on Windows natively (WSL2 optional)

## 🚀 Quick Start (Windows)

1. **Download** this repo (Code → Download ZIP)
2. **Extract** to any folder
3. **Double-click `setup.bat`**
4. **Edit `.env`** → add your API key
5. **Double-click `start.bat`**
6. **Open** [http://localhost:3456/dashboard](http://localhost:3456/dashboard)
7. Click **"+ New"** to spawn an agent and start chatting!

### API Key Setup

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Create API Key"
3. Copy the key
4. Paste into `.env`:
   ```
   GEMINI_API_KEY=AIza...
   ```

Free tier: 60 requests/minute — more than enough for 3-5 agents.

## 🖥️ Dashboard

Open [http://localhost:3456/dashboard](http://localhost:3456/dashboard)

### Tabs

| Tab | Description |
|-----|-------------|
| 📊 Overview | Stats, activity timeline |
| 💬 **Chat** | **Talk to agents directly** — select agent, type message, get response |
| 🤖 Agents | Manage agents — spawn, stop, view status |
| 🧵 Threads | Threaded conversations |
| 📨 Messages | All messages with search |
| 📋 Tasks | Kanban board (pending → active → done) |
| 🧠 Memory | FTS5 full-text memory search |
| 🔍 Traces | Query traces and chains |
| 🔀 Handoffs | Session handoffs between runs |

### Chat

The **Chat tab** lets you:
- Select any running agent from the sidebar
- Type messages and get real-time responses
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
| `/api/agents` | GET | List all agents |
| `/api/agents` | POST | Spawn new agent |
| `/api/agents/:id` | DELETE | Stop agent |
| `/api/agents/:id/chat` | POST | Chat with agent |
| `/api/agents/:from/tell/:to` | POST | Agent-to-agent message |
| `/api/messages` | GET | Get messages |
| `/api/messages` | POST | Send message |
| `/api/tasks` | GET | List tasks |
| `/api/tasks` | POST | Create task |
| `/api/memory/search?q=` | GET | Search memories |
| `/api/memory/all` | GET | List all memories |
| `/dashboard` | GET | Web dashboard |

### Chat Example

```bash
# Spawn an agent
curl -X POST http://localhost:3456/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name": "Neo", "role": "coder", "personality": "Curious, clean code"}'

# Chat with it
curl -X POST http://localhost:3456/api/agents/<agent-id>/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the best way to handle errors in Node.js?"}'
```

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
│   │       └── index.html    # Web dashboard with chat
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
- **WSL2 optional** — For better compatibility if needed
- **Node.js 18+** required — Download from [nodejs.org](https://nodejs.org/)

### WSL2 (Optional)

```powershell
# In PowerShell (one-time):
wsl --install

# In WSL terminal:
cd /mnt/c/Users/YourName/path/to/oracle-multi-agent
npm install
cp .env.example .env
# Edit .env → add GEMINI_API_KEY
npm start
```

## 📝 License

MIT
