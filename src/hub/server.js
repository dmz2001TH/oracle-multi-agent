import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MemoryStore } from '../memory/store.js';
import { AgentManager } from '../agents/manager.js';
import { TeamOrchestrator } from './team.js';
import { v4 as uuidv4 } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class HubServer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      port: parseInt(process.env.HUB_PORT || '3456'),
      host: process.env.HUB_HOST || '0.0.0.0',
      dbPath: process.env.DB_PATH || './data/oracle.db',
      maxAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '5'),
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      agentModel: process.env.AGENT_MODEL || 'gemini-2.0-flash',
      provider: process.env.LLM_PROVIDER || 'promptdee',
      ...config,
    };

    this.app = express();
    this.store = new MemoryStore(this.config.dbPath);
    this.agentManager = new AgentManager(this.store, this.config);
    this.teamOrchestrator = new TeamOrchestrator(this.agentManager, this.store);
    this.clients = new Set();
    this._setupMiddleware();
    this._setupRoutes();
  }

  _setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, '../dashboard/public')));

    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      next();
    });
  }

  _setupRoutes() {
    // === Health ===
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() });
    });

    // === Stats ===
    this.app.get('/api/stats', (req, res) => {
      res.json(this.store.getStats());
    });

    // === Agents ===
    this.app.get('/api/agents', (req, res) => {
      const agents = this.store.listAgents();
      res.json(agents);
    });

    this.app.post('/api/agents', async (req, res) => {
      const { name, role, personality } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      try {
        const agent = await this.agentManager.spawnAgent(name, role, personality);
        res.json(agent);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.delete('/api/agents/:id', async (req, res) => {
      try {
        await this.agentManager.stopAgent(req.params.id);
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // === Chat with agent ===
    this.app.post('/api/agents/:id/chat', async (req, res) => {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'message is required' });
      try {
        const result = await this.agentManager.chatWithAgent(req.params.id, message);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // === Messages ===
    this.app.get('/api/messages/:channel', (req, res) => {
      const messages = this.store.getMessages(req.params.channel, parseInt(req.query.limit || '50'));
      res.json(messages.reverse());
    });

    this.app.post('/api/messages', (req, res) => {
      const { from, to, channel, content, type } = req.body;
      this.store.sendMessage(from, content, to, channel || 'general', type || 'message');
      this._broadcast({ type: 'message', from, to, channel: channel || 'general', content });
      res.json({ ok: true });
    });

    // === Agent-to-agent communication ===
    this.app.post('/api/agents/:fromId/tell/:toId', async (req, res) => {
      const { message } = req.body;
      try {
        const result = await this.agentManager.agentTellAgent(
          req.params.fromId, req.params.toId, message
        );
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // === Tasks ===
    this.app.get('/api/tasks', (req, res) => {
      const status = req.query.status;
      if (status === 'pending') {
        res.json(this.store.getPendingTasks());
      } else {
        res.json(this.store.getPendingTasks());
      }
    });

    this.app.post('/api/tasks', (req, res) => {
      const { title, description, assignedTo, priority } = req.body;
      const result = this.store.createTask(title, description, assignedTo, priority);
      this._broadcast({ type: 'task_created', task: { title, assignedTo } });
      res.json({ id: result.lastInsertRowid });
    });

    // === Memory ===
    this.app.get('/api/memory/search', (req, res) => {
      const { q, agent, limit } = req.query;
      const results = this.store.searchMemories(q, agent, parseInt(limit || '10'));
      res.json(results);
    });

    this.app.get('/api/memory/all', (req, res) => {
      res.json(this.store.getAllMemories(parseInt(req.query.limit || '100')));
    });

    // === Agent callback (agents report back here) ===
    this.app.post('/api/agent-callback/:agentId', (req, res) => {
      const { type, data } = req.body;
      this._handleAgentCallback(req.params.agentId, type, data);
      res.json({ ok: true });
    });

    // === Federation status ===
    this.app.get('/api/federation/status', (req, res) => {
      res.json({
        node: this.config.nodeName || 'local',
        agents: this.store.listAgents().length,
        peers: [],
      });
    });

    // === Team API ===
    this.app.post('/api/team/spawn', async (req, res) => {
      try {
        const template = req.body.template || 'default';
        const result = await this.teamOrchestrator.spawnTeam(template);
        this._broadcast({ type: 'team_spawned', team: result });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/team/status', async (req, res) => {
      try {
        const status = await this.teamOrchestrator.getTeamStatus();
        res.json(status);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/team/task', async (req, res) => {
      try {
        const { task } = req.body;
        if (!task) return res.status(400).json({ error: 'task is required' });
        const result = await this.teamOrchestrator.broadcastTask(task);
        this._broadcast({ type: 'team_task', task, result });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/team/chat', async (req, res) => {
      try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'message is required' });
        const result = await this.teamOrchestrator.teamChat(message);
        this._broadcast({ type: 'team_chat', message });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/team/templates', (req, res) => {
      res.json(this.teamOrchestrator.getTemplates());
    });

    // === Dashboard ===
    this.app.get('/dashboard', (req, res) => {
      res.sendFile(join(__dirname, '../dashboard/public/index.html'));
    });
  }

  _handleAgentCallback(agentId, type, data) {
    switch (type) {
      case 'thought':
        this._broadcast({ type: 'agent_thought', agentId, content: data.content });
        break;
      case 'response':
        this._broadcast({ type: 'agent_response', agentId, content: data.content });
        break;
      case 'memory':
        this.store.addMemory(agentId, data.content, data.category, data.importance, data.tags);
        break;
      case 'message':
        this.store.sendMessage(agentId, data.content, data.to, data.channel || 'general');
        this._broadcast({ type: 'agent_message', from: agentId, ...data });
        break;
      case 'status':
        this.store.updateAgentStatus(agentId, data.status);
        this._broadcast({ type: 'agent_status', agentId, status: data.status });
        break;
    }
  }

  _broadcast(data) {
    const msg = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        console.log(`🧠 Oracle Hub running on http://${this.config.host}:${this.config.port}`);
        console.log(`📊 Dashboard: http://localhost:${this.config.port}/dashboard`);

        // WebSocket server
        this.wss = new WebSocketServer({ server: this.server });
        this.wss.on('connection', (ws) => {
          this.clients.add(ws);
          ws.on('close', () => this.clients.delete(ws));
          // Send current state
          ws.send(JSON.stringify({
            type: 'init',
            stats: this.store.getStats(),
            agents: this.store.listAgents(),
          }));
        });

        resolve(this);
      });
    });
  }

  async stop() {
    this.agentManager.stopAll();
    this.store.close();
    this.wss?.close();
    this.server?.close();
  }
}
