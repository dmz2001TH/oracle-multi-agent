# 🧠 Oracle Multi-Agent System

AI agents that **remember**, **communicate**, and **collaborate** — built for Gemini API.

![Dashboard](https://img.shields.io/badge/dashboard-OLED-dark-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- 🤖 **Multi-Agent System** — Spawn specialized agents (Researcher, Coder, Writer, Manager)
- 💾 **Persistent Memory** — SQLite FTS5 full-text search across all memories
- 💬 **Agent Communication** — Agents can talk to each other and collaborate
- 📋 **Task Queue** — Assign tasks to agents, track progress
- 📊 **Web Dashboard** — Real-time OLED dark mode dashboard
- 🪟 **Windows Support** — Works on Windows (WSL2 recommended)

## Quick Start (Windows)

### Option 1: Double-click
1. Download/clone this repo
2. Double-click `setup.bat`
3. Edit `.env` → add your `GEMINI_API_KEY`
4. Double-click `start.bat`
5. Open http://localhost:3456/dashboard

### Option 2: WSL2 (Recommended)
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

### Option 3: Command Line
```bash
npm install
cp .env.example .env
# Edit .env → add GEMINI_API_KEY
npm start
```

## Get a Gemini API Key

1. Go to https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy the key
4. Paste into `.env`: `GEMINI_API_KEY=AIza...`

Free tier: 60 requests/minute — more than enough for 3-5 agents.

## Usage

### Dashboard

Open http://localhost:3456/dashboard

1. Click **"+ Spawn"** to create an agent
2. Choose a role (General, Researcher, Coder, Writer, Manager)
3. Optional: add a personality description
4. Select the agent from the dropdown
5. Type a message and hit Send

### Agent Roles

| Role | Best For |
|------|----------|
| 🤖 General | All-purpose assistant |
| 🔬 Researcher | Analysis, finding patterns |
| 💻 Coder | Writing/debugging code |
| ✍️ Writer | Documentation, content |
| 👔 Manager | Coordinating agents |

### Agent Capabilities

Each agent can:
- **Remember** — Store information in long-term memory
- **Search memory** — Find relevant past information
- **Talk to other agents** — Send messages and collaborate
- **Create tasks** — Track work items
- **Check messages** — Read from shared channels

### Agent-to-Agent Communication

Agents automatically communicate when relevant:
```
You: "Ask the Coder agent about the API structure"
Manager Agent → tells Coder Agent → Coder responds → Manager tells you
```

### Memory System

Agents remember everything important:
- Identity and role
- Things you tell them
- Things they learn from other agents
- Task results and solutions
- Code patterns and decisions

Memories are searchable across all agents using SQLite FTS5.

## API Reference

### Hub Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/stats` | GET | System statistics |
| `/api/agents` | GET | List all agents |
| `/api/agents` | POST | Spawn new agent |
| `/api/agents/:id` | DELETE | Stop agent |
| `/api/agents/:id/chat` | POST | Chat with agent |
| `/api/agents/:from/tell/:to` | POST | Agent-to-agent message |
| `/api/messages/:channel` | GET | Get channel messages |
| `/api/messages` | POST | Send message |
| `/api/tasks` | GET | List tasks |
| `/api/tasks` | POST | Create task |
| `/api/memory/search?q=` | GET | Search memories |
| `/api/memory/all` | GET | List all memories |
| `/dashboard` | GET | Web dashboard |

### Spawn Agent (POST /api/agents)

```json
{
  "name": "Neo",
  "role": "coder",
  "personality": "Curious, asks why before how, prefers clean code"
}
```

### Chat (POST /api/agents/:id/chat)

```json
{
  "message": "What's the best way to handle errors in Node.js?"
}
```

## Scaling to Multiple Machines

maw-js federation lets you spread agents across machines:

```
Machine A (your PC):    3 agents
Machine B (laptop):     2 agents
Machine C (cloud):      5 agents
───────────────────────────────
Total:                 10 agents
```

Each machine runs `npm start`. Configure federation in `maw.config.json`.

## Project Structure

```
oracle-multi-agent/
├── src/
│   ├── hub/
│   │   ├── index.js         # Entry point
│   │   └── server.js        # Express + WebSocket server
│   ├── agents/
│   │   ├── manager.js       # Agent lifecycle management
│   │   ├── worker.js        # Agent process entry point
│   │   └── gemini-client.js # Gemini API + tool calling
│   ├── memory/
│   │   └── store.js         # SQLite FTS5 memory store
│   └── dashboard/
│       └── public/
│           └── index.html   # Web dashboard
├── scripts/
│   └── setup.js             # Setup script
├── data/                    # SQLite database (auto-created)
├── .env.example
├── .env
├── package.json
├── start.bat                # Windows start script
├── setup.bat                # Windows setup script
└── README.md
```

## Philosophy

```
1. Nothing is Deleted — Remember everything, delete nothing
2. Patterns Over Intentions — Watch what happens, not what's planned
3. External Brain, Not Command — AI reflects, humans decide
4. Curiosity Creates Existence — Questions create new things
5. Form and Formless — Many agents, one consciousness
```

## Limitations

- **RAM**: ~150-200MB per active agent (API mode). 8GB RAM = ~5 concurrent agents max.
- **Rate Limits**: Gemini free tier = 60 req/min. Enough for 3-5 agents.
- **Windows**: Native support but WSL2 is recommended for best experience.
- **Scale**: This system handles 5-10 concurrent agents well. For 50+ agents, see the queue system design in the docs.

## License

MIT
