import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MemoryStore } from '../memory/store.js';
import { OracleVault } from '../memory/vault.js';
import { AgentManager } from '../agents/manager.js';
import { TeamOrchestrator } from './team.js';
import { OracleEngine } from '../engine/index.js';
import { TransportRouter, LocalTransport, HttpTransport, WsTransport } from '../transport/index.js';
import { FederationManager, signPayload, verifySignature } from '../federation/index.js';
import { PluginSystem, loggerPlugin, statsPlugin } from '../plugins/index.js';
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
      vaultPath: process.env.VAULT_PATH || './ψ',
      ...config,
    };

    this.app = express();
    this.store = new MemoryStore(this.config.dbPath);
    this.agentManager = new AgentManager(this.store, this.config);
    this.teamOrchestrator = new TeamOrchestrator(this.agentManager, this.store);

    // New subsystems (from Soul-Brews-Studio architecture)
    this.engine = new OracleEngine({ feedMax: 500 });
    this.vault = new OracleVault(this.config.vaultPath);
    this.federation = new FederationManager({
      nodeName: process.env.NODE_NAME || 'local',
      federationToken: process.env.FEDERATION_TOKEN || ''
    });
    this.plugins = new PluginSystem();
    this.transportRouter = new TransportRouter();
    this.costs = { totalTokens: 0, totalRequests: 0, byAgent: {} };

    this.clients = new Set();
    this._setupMiddleware();
    this._setupRoutes();
    this._initSubsystems();
  }

  _setupMiddleware() {
    this.app.use(express.json());

    this.app.use((req, res, next) => {
      res.header('X-Content-Type-Options', 'nosniff');
      res.header('X-Frame-Options', 'DENY');
      res.header('X-XSS-Protection', '1; mode=block');
      res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });

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

    this._watchdogInterval = setInterval(() => this._watchdogTick(), 30000);
    this._autosaveInterval = setInterval(() => this._autoSaveAgentStates(), 60000);
  }

  _setupRoutes() {
    // ================================================================
    // HEALTH & META
    // ================================================================
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        version: '3.0.0',
        provider: this.config.provider,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        agents: this.store.listAgents().length,
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
        this._broadcast({ type: 'agent_spawned', agent });
        res.json(agent);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.delete('/api/agents/:id', async (req, res) => {
      try {
        await this.agentManager.stopAgent(req.params.id);
        this._broadcast({ type: 'agent_died', agentId: req.params.id });
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/agents/:id/chat', async (req, res) => {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'message is required' });

      // Handle slash commands
      const slashResult = this._handleSlashCommand(message, req.params.id);
      if (slashResult) {
        return res.json({ response: slashResult, slash: true });
      }

      try {
        const result = await this.agentManager.chatWithAgent(req.params.id, message);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

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
    // THREADS
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
    // MESSAGES
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
      res.json(status ? this.store.getPendingTasks() : this.store.getAllTasks());
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
    // MEMORY
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
    // TRACES
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
      try { res.json(await this.teamOrchestrator.getTeamStatus()); }
      catch (err) { res.status(500).json({ error: err.message }); }
    });

    this.app.post('/api/team/task', async (req, res) => {
      try {
        const { task } = req.body;
        if (!task) return res.status(400).json({ error: 'task is required' });
        res.json(await this.teamOrchestrator.broadcastTask(task));
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    this.app.post('/api/team/chat', async (req, res) => {
      try { res.json(await this.teamOrchestrator.teamChat(req.body.message)); }
      catch (err) { res.status(500).json({ error: err.message }); }
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
    // HANDOFF
    // ================================================================
    this.app.post('/api/handoff/create', (req, res) => {
      const { title, summary, fromSession } = req.body;
      const sessionData = this.store.generateSessionSummary();
      const handoff = this.store.createHandoff(
        title || sessionData.title,
        summary || sessionData.summary,
        fromSession,
        sessionData.context
      );
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
    // AGENT STATE PERSISTENCE
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
    // AGENT HEALTH
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
      });
    });

    // ================================================================
    // ψ/ INBOX
    // ================================================================
    this.app.get('/api/psi/inbox', (req, res) => {
      res.json(this.store.psiInboxList(req.query.status, parseInt(req.query.limit || '50')));
    });

    this.app.post('/api/psi/inbox', (req, res) => {
      const { title, content, priority, createdBy } = req.body;
      if (!title) return res.status(400).json({ error: 'title required' });
      const item = this.store.psiInboxAdd(title, content, priority, createdBy);
      this._broadcast({ type: 'inbox_added', item });
      res.json(item);
    });

    this.app.put('/api/psi/inbox/:id', (req, res) => {
      this.store.psiInboxUpdate(parseInt(req.params.id), req.body);
      res.json({ ok: true });
    });

    // ================================================================
    // ψ/ WRITING
    // ================================================================
    this.app.get('/api/psi/writing', (req, res) => {
      res.json(this.store.psiWritingList(parseInt(req.query.limit || '50')));
    });

    this.app.post('/api/psi/writing', (req, res) => {
      const { title, content, category } = req.body;
      if (!title || !content) return res.status(400).json({ error: 'title and content required' });
      res.json(this.store.psiWritingSave(title, content, category));
    });

    this.app.get('/api/psi/writing/:title', (req, res) => {
      const doc = this.store.psiWritingGet(req.params.title);
      if (!doc) return res.status(404).json({ error: 'not found' });
      res.json(doc);
    });

    // ================================================================
    // ψ/ LAB
    // ================================================================
    this.app.get('/api/psi/lab', (req, res) => {
      res.json(this.store.psiLabList(parseInt(req.query.limit || '20')));
    });

    this.app.post('/api/psi/lab', (req, res) => {
      const { experiment, hypothesis } = req.body;
      if (!experiment) return res.status(400).json({ error: 'experiment required' });
      res.json(this.store.psiLabAdd(experiment, hypothesis));
    });

    this.app.put('/api/psi/lab/:id', (req, res) => {
      const { result, status } = req.body;
      this.store.psiLabComplete(parseInt(req.params.id), result, status);
      res.json({ ok: true });
    });

    // ================================================================
    // FLEET CONFIGS
    // ================================================================
    this.app.get('/api/fleet', (req, res) => {
      res.json(this.store.listFleetConfigs());
    });

    this.app.post('/api/fleet', (req, res) => {
      const { name, template } = req.body;
      if (!name || !template) return res.status(400).json({ error: 'name and template required' });
      this.store.saveFleetConfig(name, template);
      res.json({ ok: true });
    });

    this.app.get('/api/fleet/:name', (req, res) => {
      const config = this.store.getFleetConfig(req.params.name);
      if (!config) return res.status(404).json({ error: 'not found' });
      res.json(config);
    });

    // ================================================================
    // SLASH COMMANDS (API endpoint)
    // ================================================================
    this.app.post('/api/slash', (req, res) => {
      const { command, agentId } = req.body;
      const result = this._handleSlashCommand(command, agentId);
      if (result) {
        res.json({ response: result });
      } else {
        res.status(400).json({ error: 'Unknown command' });
      }
    });

    // ================================================================
    // FEED (real-time event stream, from maw-js)
    // ================================================================
    this.app.get('/api/feed', (req, res) => {
      const limit = parseInt(req.query.limit || '50');
      res.json({ events: this.engine.getFeed(limit) });
    });

    // ================================================================
    // VAULT (ψ/ file management, from arra-oracle-v3)
    // ================================================================
    this.app.get('/api/vault/status', async (req, res) => {
      try {
        const status = await this.vault.status();
        res.json(status);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/vault/:section', async (req, res) => {
      try {
        const items = await this.vault.list(req.params.section, { limit: parseInt(req.query.limit || '50') });
        res.json({ items });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/vault/:section', async (req, res) => {
      try {
        const { title, content, tags } = req.body;
        const result = await this.vault.write(req.params.section, title || `item-${Date.now()}`, content || '', { tags });
        this.engine.addFeedEvent({ type: 'vault_write', section: req.params.section, name: result.name });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/vault/:section/:name', async (req, res) => {
      try {
        const content = await this.vault.read(req.params.section, req.params.name);
        if (!content) return res.status(404).json({ error: 'Not found' });
        res.json({ content });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ================================================================
    // FEDERATION PEER MANAGEMENT (from maw-js federation)
    // ================================================================
    this.app.get('/api/federation/peers', (req, res) => {
      res.json({ peers: this.federation.listNodes() });
    });

    this.app.post('/api/federation/peers', (req, res) => {
      const { name, url, federationToken } = req.body;
      if (!name || !url) return res.status(400).json({ error: 'name and url required' });
      const node = this.federation.addNode({ name, url, federationToken });
      // Also add to HTTP transport
      const httpTransport = this.transportRouter.getTransport('http');
      if (httpTransport) httpTransport.addPeer(name, url);
      this.engine.addFeedEvent({ type: 'federation_peer_add', peer: name });
      res.json(node.toJSON());
    });

    this.app.delete('/api/federation/peers/:name', (req, res) => {
      this.federation.removeNode(req.params.name);
      const httpTransport = this.transportRouter.getTransport('http');
      if (httpTransport) httpTransport.removePeer(req.params.name);
      res.json({ ok: true });
    });

    this.app.post('/api/federation/ping', async (req, res) => {
      const results = await this.federation.pingAll();
      res.json({ results });
    });

    // ================================================================
    // PEER EXEC (cross-machine command execution, from maw-js)
    // ================================================================
    this.app.post('/api/peer/exec',
      this.federation.authMiddleware(),
      async (req, res) => {
        try {
          const { command, args = [] } = req.body;
          this.engine.addFeedEvent({ type: 'peer_exec', command, from: req.headers['x-signature'] ? 'authenticated' : 'local' });

          // Execute supported commands
          switch (command) {
            case 'status':
              return res.json({ ok: true, result: this.engine.getStats() });
            case 'agents':
              return res.json({ ok: true, result: this.store.listAgents() });
            case 'feed':
              return res.json({ ok: true, result: this.engine.getFeed(args[0] || 20) });
            default:
              return res.status(400).json({ error: `Unknown command: ${command}` });
          }
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      }
    );

    // ================================================================
    // BROADCAST (send message to all agents)
    // ================================================================
    this.app.post('/api/broadcast', async (req, res) => {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'message required' });
      const agents = this.agentManager.getRunningAgents();
      let recipients = 0;
      for (const agent of agents) {
        try {
          this._handleAgentCallback(agent.id, 'message', { content: `[Broadcast] ${message}`, to: 'all' });
          recipients++;
        } catch {}
      }
      this.engine.addFeedEvent({ type: 'broadcast', message: message.slice(0, 100), recipients });
      this.store.sendMessage('system', `📢 Broadcast: ${message}`, null, null, 'system');
      res.json({ ok: true, recipients });
    });

    // ================================================================
    // COSTS TRACKING (from maw-js)
    // ================================================================
    this.app.get('/api/costs', (req, res) => {
      res.json(this.costs);
    });

    this.app.post('/api/costs/track', (req, res) => {
      const { agentId, tokens, model } = req.body;
      this.costs.totalTokens += tokens || 0;
      this.costs.totalRequests += 1;
      if (agentId) {
        if (!this.costs.byAgent[agentId]) {
          this.costs.byAgent[agentId] = { tokens: 0, requests: 0, model: model || 'unknown' };
        }
        this.costs.byAgent[agentId].tokens += tokens || 0;
        this.costs.byAgent[agentId].requests += 1;
      }
      res.json({ ok: true });
    });

    // ================================================================
    // PLUGINS
    // ================================================================
    this.app.get('/api/plugins', (req, res) => {
      res.json({ plugins: this.plugins.list() });
    });

    // ================================================================
    // ENGINE STATS
    // ================================================================
    this.app.get('/api/engine', (req, res) => {
      res.json(this.engine.getStats());
    });

    // ================================================================
    // DASHBOARD
    // ================================================================
    this.app.get('/dashboard', (req, res) => {
      res.sendFile(join(__dirname, '../dashboard/public/index.html'));
    });

    // React SPA dashboard (if built)
    this.app.use('/app', express.static(join(__dirname, '../dashboard/dist')));
    this.app.get('/app/*', (req, res) => {
      res.sendFile(join(__dirname, '../dashboard/dist/index.html'));
    });
  }

  // ================================================================
  // SUBSYSTEM INITIALIZATION
  // ================================================================
  async _initSubsystems() {
    // Initialize vault
    try {
      await this.vault.init();
      console.log('[vault] ψ/ structure initialized');
    } catch (err) {
      console.warn('[vault] Init failed:', err.message);
    }

    // Register built-in plugins
    this.plugins.register('logger', loggerPlugin);
    this.plugins.register('stats', statsPlugin);

    // Load user plugins from ./plugins/ directory
    await this.plugins.loadFromDir(join(process.cwd(), 'plugins'));

    // Setup transport router
    this.transportRouter.register('local', new LocalTransport(this));
    this.transportRouter.register('ws', new WsTransport(null)); // set after WS init
    const httpTransport = new HttpTransport({
      federationToken: process.env.FEDERATION_TOKEN || ''
    });
    this.transportRouter.register('http', httpTransport);

    // Connect engine feed to WebSocket broadcast
    this.engine.onFeed((event) => {
      this._broadcast({ type: 'feed_event', event });
    });

    // Connect agent manager callbacks to engine
    this.agentManager.on('agent_spawned', (agent) => {
      this.engine.registerAgent(agent.id, { name: agent.name, role: agent.role });
      this.plugins.runHook('agent_spawn', { agentId: agent.id, role: agent.role });
    });

    this.agentManager.on('agent_stopped', (agent) => {
      this.engine.unregisterAgent(agent.id);
    });

    console.log('[engine] Oracle Engine initialized');
    console.log('[plugins] Loaded:', this.plugins.list().map(p => p.name).join(', '));
  }

  // ================================================================
  // SLASH COMMAND HANDLER
  // ================================================================
  _handleSlashCommand(message, agentId) {
    const cmd = message.trim();
    if (!cmd.startsWith('/')) return null;

    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (command) {
      case '/recap':
        return this.store.generateRecap();

      case '/rrr':
        return this.store.generateRRR();

      case '/standup':
        return this.store.generateStandup();

      case '/fyi': {
        if (!args) return 'Usage: /fyi <information to remember>';
        const agent = agentId || 'human';
        this.store.addMemory(agent, args, 'manual', 2, 'fyi', 'manual');
        this.store.sendMessage('system', `📝 Noted: "${args.slice(0, 80)}"`, null, null, 'system');
        return `✅ Remembered: "${args.slice(0, 100)}${args.length > 100 ? '...' : ''}"`;
      }

      case '/trace': {
        if (!args) return 'Usage: /trace <query>';
        const memories = this.store.searchMemories(args, null, 5);
        const messages = this.store.searchMessages(args, 5);
        const traceId = this.store.createTrace(args, 'search', agentId || 'human');
        let result = `🔍 **Trace: "${args}"**\n\n`;
        if (memories.length > 0) {
          result += `**Memories (${memories.length}):**\n`;
          memories.forEach(m => result += `- [${m.category}] ${m.content.slice(0, 100)}\n`);
          result += '\n';
        }
        if (messages.length > 0) {
          result += `**Messages (${messages.length}):**\n`;
          messages.forEach(m => result += `- ${m.from_agent}: ${m.content.slice(0, 80)}\n`);
        }
        if (memories.length === 0 && messages.length === 0) {
          result += 'No results found.';
        }
        this.store.updateTrace(traceId, {
          found_memories: JSON.stringify(memories.map(m => m.id)),
          found_messages: JSON.stringify(messages.map(m => m.id)),
          memory_count: memories.length,
          message_count: messages.length,
          status: 'distilled',
          insight: `Found ${memories.length} memories, ${messages.length} messages`,
        });
        return result;
      }

      case '/learn': {
        if (!args) return 'Usage: /learn <topic>';
        const memories = this.store.searchMemories(args, null, 10);
        let result = `📚 **Learn: "${args}"**\n\n`;
        if (memories.length > 0) {
          for (const m of memories) {
            result += `**[${m.category}]** ${m.content}\n`;
            if (m.tags) result += `  Tags: ${m.tags}\n`;
            result += '\n';
          }
        } else {
          result += 'No knowledge found on this topic yet.';
        }
        return result;
      }

      case '/feel': {
        if (!args) return 'Usage: /feel <mood/energy level>';
        this.store.addMemory(agentId || 'human', `Feeling: ${args}`, 'state', 1, 'feel,mood', 'manual');
        return `🎭 Noted: ${args}`;
      }

      case '/forward': {
        const summary = this.store.generateSessionSummary();
        const handoff = this.store.createHandoff(summary.title, summary.summary, 'manual', summary.context);
        return `🔀 Handoff created: ${handoff.title}\n\n${summary.summary.slice(0, 300)}`;
      }

      case '/who-are-you': {
        const agents = this.store.listAgents();
        if (agents.length === 0) return 'No agents running.';
        return agents.map(a => `**${a.name}** — ${a.role} (${a.status})`).join('\n');
      }

      case '/inbox': {
        if (args) {
          this.store.psiInboxAdd(args, '', 1, 'human');
          return `📥 Added to inbox: "${args}"`;
        }
        const items = this.store.psiInboxList('open', 10);
        if (items.length === 0) return 'Inbox is empty.';
        return `📥 **Inbox:**\n${items.map(i => `- [P${i.priority}] ${i.title}`).join('\n')}`;
      }

      case '/help':
        return `**Oracle Commands:**
/recap — Session summary
/rrr — Retrospective
/standup — Daily standup
/fyi <info> — Remember something
/trace <query> — Search everything
/learn <topic> — Explore knowledge
/feel <mood> — Log energy level
/forward — Create handoff
/who-are-you — List agents
/inbox [item] — View/add to inbox
/help — This message

Or just type normally to chat with agents!`;

      default:
        return null;
    }
  }

  // ================================================================
  // CALLBACKS & BROADCAST
  // ================================================================
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
        console.log(`\n🧠 ARRA Office v4.0 — Oracle Multi-Agent System`);
        console.log(`   URL: http://${this.config.host}:${this.config.port}`);
        console.log(`   Dashboard: http://localhost:${this.config.port}/dashboard`);
        console.log(`   Provider: ${this.config.provider}`);
        console.log(`   Node: ${process.env.NODE_NAME || 'local'}\n`);

        this.wss = new WebSocketServer({ server: this.server });
        this.wss.on('connection', (ws) => {
          this.clients.add(ws);
          ws.on('close', () => this.clients.delete(ws));
          // Send initial state including feed
          ws.send(JSON.stringify({
            type: 'init',
            stats: this.store.getStats(),
            agents: this.store.listAgents(),
            engine: this.engine.getStats(),
            feed: this.engine.getFeed(20),
          }));
        });

        // Set WS transport with actual server
        const wsTransport = this.transportRouter.getTransport('ws');
        if (wsTransport) wsTransport.wsServer = this.wss;

        // Connect all transports
        this.transportRouter.connectAll().catch(err => {
          console.warn('[transport] Some transports failed:', err.message);
        });

        // Start engine health checks
        this.engine.startHealthCheck();

        // Start federation health monitor
        this.federation.startHealthMonitor();

        // Run startup hooks
        this.plugins.runHook('startup', { hub: this });

        this._respawnAgents();
        this.engine.addFeedEvent({ type: 'hub_start', port: this.config.port });
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
    clearInterval(this._watchdogInterval);
    clearInterval(this._autosaveInterval);
    this._autoSaveAgentStates();

    try {
      const summary = this.store.generateSessionSummary();
      this.store.createHandoff(summary.title, summary.summary, 'shutdown', summary.context);
      console.log('📄 Session handoff created');
    } catch (err) {
      console.warn('⚠️ Could not create handoff:', err.message);
    }

    // Shutdown new subsystems
    this.engine.addFeedEvent({ type: 'hub_shutdown' });
    await this.engine.shutdown();
    this.federation.stopHealthMonitor();
    await this.transportRouter.disconnectAll();
    await this.plugins.runHook('shutdown');
    await this.plugins.shutdown();

    this.agentManager.stopAll();
    this.store.close();
    this.wss?.close();
    this.server?.close();
    console.log('👋 ARRA Office v4.0 stopped.');
  }

  _watchdogTick() {
    const agents = this.agentManager.getRunningAgents();
    for (const agent of agents) {
      try {
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
          this.store.saveAgentState(agent.id, agent.name, agent.role, '', [], [], []);
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
