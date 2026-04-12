import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
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

    // Security headers (from Oracle)
    this.app.use((req, res, next) => {
      res.header('X-Content-Type-Options', 'nosniff');
      res.header('X-Frame-Options', 'DENY');
      res.header('X-XSS-Protection', '1; mode=block');
      res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });

    // CORS (from Oracle — restrict in production)
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        res.header('Access-Control-Allow-Origin', origin || '*');
      }
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      next();
    });

    this.app.use(express.static(join(__dirname, '../dashboard/public')));

    // Phase 5: Watchdog — check agent health every 30s
    this._watchdogInterval = setInterval(() => this._watchdogTick(), 30000);

    // Phase 5: Auto-save state every 60s
    this._autosaveInterval = setInterval(() => this._autoSaveAgentStates(), 60000);
  }

  _setupRoutes() {
    // ================================================================
    // HEALTH & META
    // ================================================================

    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        version: '2.0.0',
        provider: this.config.provider,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    });

    this.app.get('/api/stats', (req, res) => {
      res.json(this.store.getStats());
    });

    this.app.get('/api/analytics/search', (req, res) => {
      res.json(this.store.getSearchStats());
    });

    this.app.get('/api/analytics/timeline', (req, res) => {
      const hours = parseInt(req.query.hours || '24');
      res.json(this.store.getActivityTimeline(hours));
    });

    // ================================================================
    // AGENTS
    // ================================================================

    this.app.get('/api/agents', (req, res) => {
      res.json(this.store.listAgents());
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

    // Agent-to-agent communication
    this.app.post('/api/agents/:fromId/tell/:toId', async (req, res) => {
      const { message } = req.body;
      try {
        const result = await this.agentManager.agentTellAgent(req.params.fromId, req.params.toId, message);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ================================================================
    // THREADS (Oracle forum pattern)
    // ================================================================

    this.app.get('/api/threads', (req, res) => {
      const { status, limit } = req.query;
      res.json(this.store.listThreads(status, parseInt(limit || '20')));
    });

    this.app.post('/api/threads', (req, res) => {
      const { title, createdBy, assignedTo } = req.body;
      if (!title) return res.status(400).json({ error: 'title is required' });
      const thread = this.store.createThread(title, createdBy, assignedTo);
      this._broadcast({ type: 'thread_created', thread });
      res.json(thread);
    });

    this.app.get('/api/threads/:id', (req, res) => {
      const thread = this.store.getThread(parseInt(req.params.id));
      if (!thread) return res.status(404).json({ error: 'thread not found' });
      const messages = this.store.getMessages(thread.id);
      res.json({ ...thread, messages });
    });

    this.app.put('/api/threads/:id', (req, res) => {
      const { status } = req.body;
      this.store.updateThreadStatus(parseInt(req.params.id), status);
      res.json({ ok: true });
    });

    // ================================================================
    // MESSAGES (threaded + flat)
    // ================================================================

    this.app.get('/api/messages', (req, res) => {
      const { threadId, limit } = req.query;
      res.json(this.store.getMessages(threadId ? parseInt(threadId) : null, parseInt(limit || '50')));
    });

    this.app.post('/api/messages', (req, res) => {
      const { from, to, threadId, content, role, metadata } = req.body;
      const msgId = this.store.sendMessage(from, content, to, threadId, role || 'human', metadata);
      this._broadcast({ type: 'message', from, to, threadId, content, role });
      res.json({ id: msgId });
    });

    this.app.get('/api/messages/search', (req, res) => {
      const { q, limit } = req.query;
      res.json(this.store.searchMessages(q, parseInt(limit || '20')));
    });

    // ================================================================
    // TASKS
    // ================================================================

    this.app.get('/api/tasks', (req, res) => {
      const { status } = req.query;
      res.json(this.store.getPendingTasks());
    });

    this.app.post('/api/tasks', (req, res) => {
      const { title, description, assignedTo, priority, threadId } = req.body;
      const result = this.store.createTask(title, description, assignedTo, priority, threadId);
      this._broadcast({ type: 'task_created', task: { title, assignedTo } });
      res.json(result);
    });

    this.app.put('/api/tasks/:id', (req, res) => {
      const { status, result } = req.body;
      this.store.updateTaskStatus(parseInt(req.params.id), status, result);
      res.json({ ok: true });
    });

    // ================================================================
    // MEMORY (with supersede)
    // ================================================================

    this.app.get('/api/memory/search', (req, res) => {
      const { q, agent, limit } = req.query;
      res.json(this.store.searchMemories(q, agent, parseInt(limit || '10')));
    });

    this.app.get('/api/memory/all', (req, res) => {
      res.json(this.store.getAllMemories(parseInt(req.query.limit || '100')));
    });

    this.app.post('/api/memory/:id/supersede', (req, res) => {
      const { newId, reason, agentId } = req.body;
      this.store.supersedeMemory(parseInt(req.params.id), newId, reason, agentId);
      res.json({ ok: true });
    });

    // ================================================================
    // TRACES (Oracle trace system)
    // ================================================================

    this.app.get('/api/traces', (req, res) => {
      const { agentId, limit } = req.query;
      res.json(this.store.listTraces(agentId, parseInt(limit || '20')));
    });

    this.app.post('/api/traces', (req, res) => {
      const { query, queryType, agentId, parentTraceId } = req.body;
      const traceId = this.store.createTrace(query, queryType, agentId, parentTraceId);
      this._broadcast({ type: 'trace_created', traceId, query });
      res.json({ traceId });
    });

    this.app.get('/api/traces/:traceId', (req, res) => {
      const trace = this.store.getTrace(req.params.traceId);
      if (!trace) return res.status(404).json({ error: 'trace not found' });
      res.json(trace);
    });

    this.app.put('/api/traces/:traceId', (req, res) => {
      this.store.updateTrace(req.params.traceId, req.body);
      res.json({ ok: true });
    });

    this.app.post('/api/traces/link', (req, res) => {
      const { prevTraceId, nextTraceId } = req.body;
      this.store.linkTraces(prevTraceId, nextTraceId);
      res.json({ ok: true });
    });

    this.app.get('/api/traces/:traceId/chain', (req, res) => {
      res.json(this.store.getTraceChain(req.params.traceId));
    });

    // ================================================================
    // TEAM
    // ================================================================

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
        res.json(await this.teamOrchestrator.getTeamStatus());
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/team/task', async (req, res) => {
      try {
        const { task } = req.body;
        if (!task) return res.status(400).json({ error: 'task is required' });
        const result = await this.teamOrchestrator.broadcastTask(task);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/team/chat', async (req, res) => {
      try {
        const { message } = req.body;
        const result = await this.teamOrchestrator.teamChat(message);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/team/templates', (req, res) => {
      res.json(this.teamOrchestrator.getTemplates());
    });

    // ================================================================
    // AGENT CALLBACK
    // ================================================================

    this.app.post('/api/agent-callback/:agentId', (req, res) => {
      const { type, data } = req.body;
      this._handleAgentCallback(req.params.agentId, type, data);
      res.json({ ok: true });
    });

    // ================================================================
    // FEDERATION
    // ================================================================

    this.app.get('/api/federation/status', (req, res) => {
      res.json({
        node: this.config.nodeName || 'local',
        agents: this.store.listAgents().length,
        peers: [],
      });
    });

    // ================================================================
    // HANDOFF (Phase 2: Session Handoff)
    // ================================================================

    this.app.post('/api/handoff/create', (req, res) => {
      const { title, summary, fromSession } = req.body;
      const sessionData = this.store.generateSessionSummary();
      const handoffTitle = title || sessionData.title;
      const handoffSummary = summary || sessionData.summary;
      const handoff = this.store.createHandoff(handoffTitle, handoffSummary, fromSession, sessionData.context);
      this._broadcast({ type: 'handoff_created', handoff });
      res.json(handoff);
    });

    this.app.get('/api/handoff', (req, res) => {
      res.json(this.store.getHandoffs(parseInt(req.query.limit || '10')));
    });

    this.app.put('/api/handoff/:id', (req, res) => {
      const { status } = req.body;
      this.store.updateHandoffStatus(parseInt(req.params.id), status);
      res.json({ ok: true });
    });

    this.app.get('/api/handoff/summary', (req, res) => {
      res.json(this.store.generateSessionSummary());
    });

    // ================================================================
    // AGENT STATE PERSISTENCE (Phase 5)
    // ================================================================

    this.app.get('/api/agents/:id/state', (req, res) => {
      const state = this.store.loadAgentState(req.params.id);
      if (!state) return res.status(404).json({ error: 'No saved state' });
      res.json(state);
    });

    this.app.post('/api/agents/:id/state', (req, res) => {
      const { name, role, personality, conversationHistory, memoryCache, messageQueue } = req.body;
      this.store.saveAgentState(req.params.id, name, role, personality, conversationHistory || [], memoryCache || [], messageQueue || []);
      res.json({ ok: true });
    });

    this.app.get('/api/agents/states/saved', (req, res) => {
      res.json(this.store.getAllSavedStates());
    });

    // ================================================================
    // AGENT HEALTH CHECK (Phase 5)
    // ================================================================

    this.app.get('/api/agents/:id/health', (req, res) => {
      const agentInfo = this.agentManager.agents.get(req.params.id);
      const dbInfo = this.store.getAgent(req.params.id);
      if (!agentInfo && !dbInfo) return res.status(404).json({ error: 'Agent not found' });

      res.json({
        id: req.params.id,
        name: dbInfo?.name || agentInfo?.config?.name,
        role: dbInfo?.role || agentInfo?.config?.role,
        running: !!agentInfo,
        dbStatus: dbInfo?.status || 'unknown',
        lastActive: dbInfo?.last_active,
        pid: agentInfo?.process?.pid || null,
        memoryCache: agentInfo?.config ? 'available' : 'offline',
      });
    });

    // ================================================================
    // DASHBOARD
    // ================================================================

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
        this.store.addMemory(agentId, data.content, data.category, data.importance, data.tags, 'agent');
        break;
      case 'message':
        this.store.sendMessage(agentId, data.content, data.to, null, 'agent');
        this._broadcast({ type: 'agent_message', from: agentId, ...data });
        break;
      case 'status':
        this.store.updateAgentStatus(agentId, data.status);
        this._broadcast({ type: 'agent_status', agentId, status: data.status });
        break;
      case 'trace':
        const traceId = this.store.createTrace(data.query, data.queryType, agentId);
        if (data.insight) {
          this.store.updateTrace(traceId, { insight: data.insight, status: 'distilled' });
        }
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
        console.log(`🧠 Oracle Hub v2.0 running on http://${this.config.host}:${this.config.port}`);
        console.log(`📊 Dashboard: http://localhost:${this.config.port}/dashboard`);
        console.log(`🔌 Provider: ${this.config.provider}`);

        this.wss = new WebSocketServer({ server: this.server });
        this.wss.on('connection', (ws) => {
          this.clients.add(ws);
          ws.on('close', () => this.clients.delete(ws));
          ws.send(JSON.stringify({
            type: 'init',
            stats: this.store.getStats(),
            agents: this.store.listAgents(),
          }));
        });

        // Auto-respawn agents that were previously active
        this._respawnAgents();

        resolve(this);
      });
    });
  }

  async _respawnAgents() {
    try {
      const savedStates = this.store.getAllSavedStates();
      if (savedStates.length === 0) return;

      console.log(`\n🔄 Auto-respawning ${savedStates.length} agent(s) from last session...`);

      for (const state of savedStates) {
        try {
          console.log(`   ↳ Respawning ${state.name} (${state.role})...`);
          await this.agentManager.spawnAgent(state.name, state.role, state.personality || '');
        } catch (err) {
          console.warn(`   ⚠️ Could not respawn ${state.name}: ${err.message}`);
        }
      }

      console.log(`✅ Auto-respawn complete\n`);
    } catch (err) {
      console.warn(`⚠️ Auto-respawn failed: ${err.message}`);
    }
  }

  async stop() {
    console.log('🛑 Graceful shutdown...');

    // Phase 5: Save all agent states before shutdown
    clearInterval(this._watchdogInterval);
    clearInterval(this._autosaveInterval);
    this._autoSaveAgentStates();

    // Phase 2: Auto-create handoff on shutdown
    try {
      const summary = this.store.generateSessionSummary();
      this.store.createHandoff(summary.title, summary.summary, 'shutdown', summary.context);
      console.log('📄 Session handoff created');
    } catch (err) {
      console.warn('⚠️ Could not create handoff:', err.message);
    }

    this.agentManager.stopAll();
    this.store.close();
    this.wss?.close();
    this.server?.close();
    console.log('👋 Oracle Hub stopped.');
  }

  // ================================================================
  // WATCHDOG (Phase 5: Reliability)
  // ================================================================

  _watchdogTick() {
    const agents = this.agentManager.getRunningAgents();
    for (const agent of agents) {
      try {
        // Check if process is still alive
        if (agent.process && agent.process.killed) {
          console.warn(`🐕 Watchdog: Agent "${agent.name}" process dead, cleaning up`);
          this.agentManager.agents.delete(agent.id);
          this.store.updateAgentStatus(agent.id, 'stopped');
          this._broadcast({ type: 'agent_died', agentId: agent.id, name: agent.name });
        }
      } catch {}
    }
  }

  _autoSaveAgentStates() {
    try {
      const runningAgents = this.agentManager.getRunningAgents();
      for (const agent of runningAgents) {
        try {
          this.store.saveAgentState(
            agent.id,
            agent.name,
            agent.role,
            '', // personality not available from getRunningAgents
            [], // conversation history lives in child process
            [], // memory cache lives in child process
            []
          );
        } catch (err) {
          console.warn(`⚠️ Auto-save failed for ${agent.name}: ${err.message}`);
        }
      }
      if (runningAgents.length > 0) {
        console.log(`💾 Auto-saved ${runningAgents.length} agent state(s)`);
      }
    } catch (err) {
      console.warn('⚠️ Auto-save tick error:', err.message);
    }
  }
}
