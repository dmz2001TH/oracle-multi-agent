/**
 * Oracle Engine — Core orchestration engine
 * Inspired by maw-js MawEngine — adapted for Node.js
 *
 * Manages: agent lifecycle, event feed, sessions, teams
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export class OracleEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.transportRouter = options.transportRouter || null;
    this.agents = new Map();
    this.sessions = new Map();
    this.teams = new Map();
    this.feed = [];
    this.feedMax = options.feedMax || 500;
    this.feedListeners = new Set();
    this.inbox = [];
    this.writing = [];
    this.lab = [];
    this.startedAt = Date.now();

    // Heartbeat interval for agent health checks
    this.healthInterval = null;
  }

  setTransportRouter(router) {
    this.transportRouter = router;
  }

  // === Feed System (inspired by maw-js feed) ===

  addFeedEvent(event) {
    const entry = {
      id: uuidv4(),
      timestamp: Date.now(),
      ...event
    };
    this.feed.push(entry);
    if (this.feed.length > this.feedMax) {
      this.feed = this.feed.slice(-this.feedMax);
    }
    // Notify listeners
    for (const listener of this.feedListeners) {
      try { listener(entry); } catch {}
    }
    this.emit('feed', entry);
    return entry;
  }

  onFeed(callback) {
    this.feedListeners.add(callback);
    return () => this.feedListeners.delete(callback);
  }

  getFeed(limit = 50) {
    return this.feed.slice(-limit);
  }

  // === Agent Lifecycle ===

  registerAgent(id, agentInfo) {
    this.agents.set(id, {
      id,
      ...agentInfo,
      status: 'idle',
      registeredAt: Date.now(),
      lastActive: Date.now(),
      messageCount: 0,
      errorCount: 0
    });
    this.addFeedEvent({ type: 'agent_register', agent: id, role: agentInfo.role });
    return this.agents.get(id);
  }

  unregisterAgent(id) {
    const agent = this.agents.get(id);
    if (agent) {
      this.addFeedEvent({ type: 'agent_unregister', agent: id });
      this.agents.delete(id);
    }
  }

  updateAgentStatus(id, status, meta = {}) {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = status;
      agent.lastActive = Date.now();
      Object.assign(agent, meta);
      this.addFeedEvent({ type: 'agent_status', agent: id, status, ...meta });
    }
  }

  getAgent(id) {
    return this.agents.get(id);
  }

  listAgents() {
    return [...this.agents.values()];
  }

  getActiveAgents() {
    return this.listAgents().filter(a => a.status === 'active' || a.status === 'working');
  }

  // === Session Management ===

  createSession(agentId, meta = {}) {
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      agentId,
      createdAt: Date.now(),
      lastActive: Date.now(),
      messages: [],
      context: {},
      ...meta
    };
    this.sessions.set(sessionId, session);
    this.addFeedEvent({ type: 'session_create', sessionId, agent: agentId });
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  addSessionMessage(sessionId, role, content) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push({ role, content, timestamp: Date.now() });
      session.lastActive = Date.now();
    }
  }

  // === Team Management ===

  createTeam(name, members, meta = {}) {
    const teamId = uuidv4();
    const team = {
      id: teamId,
      name,
      members,
      status: 'active',
      createdAt: Date.now(),
      tasks: [],
      ...meta
    };
    this.teams.set(teamId, team);
    this.addFeedEvent({ type: 'team_create', teamId, name, members: members.length });
    return team;
  }

  getTeam(teamId) {
    return this.teams.get(teamId);
  }

  listTeams() {
    return [...this.teams.values()];
  }

  // === Inbox ===

  addToInbox(item) {
    const entry = { id: uuidv4(), timestamp: Date.now(), status: 'open', ...item };
    this.inbox.push(entry);
    this.addFeedEvent({ type: 'inbox_add', item: entry });
    return entry;
  }

  getInbox(status = null) {
    return status ? this.inbox.filter(i => i.status === status) : this.inbox;
  }

  resolveInbox(id) {
    const item = this.inbox.find(i => i.id === id);
    if (item) {
      item.status = 'resolved';
      item.resolvedAt = Date.now();
      this.addFeedEvent({ type: 'inbox_resolve', itemId: id });
    }
    return item;
  }

  // === Writing ===

  addWriting(doc) {
    const entry = { id: uuidv4(), timestamp: Date.now(), ...doc };
    this.writing.push(entry);
    return entry;
  }

  // === Lab ===

  addLab(experiment) {
    const entry = { id: uuidv4(), timestamp: Date.now(), status: 'running', ...experiment };
    this.lab.push(entry);
    return entry;
  }

  // === Stats ===

  getStats() {
    return {
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      agents: this.agents.size,
      activeAgents: this.getActiveAgents().length,
      sessions: this.sessions.size,
      teams: this.teams.size,
      feedEvents: this.feed.length,
      inbox: this.inbox.filter(i => i.status === 'open').length,
      writing: this.writing.length,
      lab: this.lab.filter(l => l.status === 'running').length,
    };
  }

  // === Health Check ===

  startHealthCheck(intervalMs = 30000) {
    this.healthInterval = setInterval(() => {
      for (const [id, agent] of this.agents) {
        const idle = Date.now() - agent.lastActive;
        if (idle > 300000) { // 5 min idle
          this.updateAgentStatus(id, 'idle');
        }
      }
    }, intervalMs);
  }

  stopHealthCheck() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  // === Shutdown ===

  async shutdown() {
    this.stopHealthCheck();
    this.addFeedEvent({ type: 'engine_shutdown' });
    this.emit('shutdown');
  }
}
