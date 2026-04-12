/**
 * Federation Mesh — Multi-machine agent communication
 * Inspired by maw-js federation system — adapted for Node.js
 *
 * Features:
 * - HMAC-SHA256 signed peer communication
 * - Auto-discovery via named peers
 * - Health monitoring
 * - Soul sync (memory sync between peers)
 */

import { createHmac, randomBytes } from 'crypto';

/**
 * Sign a payload with HMAC-SHA256
 */
export function signPayload(payload, secret) {
  const hmac = createHmac('sha256', secret);
  hmac.update(typeof payload === 'string' ? payload : JSON.stringify(payload));
  return hmac.digest('hex');
}

/**
 * Verify a signed payload
 */
export function verifySignature(payload, signature, secret) {
  const expected = signPayload(payload, secret);
  return expected === signature;
}

/**
 * Federation Node — represents a connected peer
 */
export class FederationNode {
  constructor(config) {
    this.name = config.name;
    this.url = config.url;
    this.token = config.federationToken || '';
    this.lastSeen = null;
    this.latency = 0;
    this.status = 'unknown';
    this.agents = [];
    this.stats = { messagesSent: 0, messagesReceived: 0, errors: 0 };
  }

  async ping() {
    try {
      const start = Date.now();
      const res = await fetch(`${this.url}/api/health`, {
        signal: AbortSignal.timeout(5000),
        headers: this._headers()
      });
      this.latency = Date.now() - start;
      this.status = res.ok ? 'online' : 'error';
      this.lastSeen = Date.now();
      if (res.ok) {
        const data = await res.json();
        this.agents = data.agents || [];
      }
      return { ok: res.ok, latency: this.latency };
    } catch (err) {
      this.status = 'offline';
      this.stats.errors++;
      return { ok: false, error: err.message };
    }
  }

  async sendCommand(command, body = {}) {
    try {
      const payload = JSON.stringify({ command, ...body, nonce: randomBytes(8).toString('hex') });
      const signature = signPayload(payload, this.token);

      const res = await fetch(`${this.url}/api/peer/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._headers(),
          'X-Signature': signature
        },
        body: payload,
        signal: AbortSignal.timeout(10000)
      });

      this.stats.messagesSent++;
      return await res.json();
    } catch (err) {
      this.stats.errors++;
      throw err;
    }
  }

  async getAgents() {
    try {
      const res = await fetch(`${this.url}/api/agents`, {
        signal: AbortSignal.timeout(5000),
        headers: this._headers()
      });
      const data = await res.json();
      this.agents = data.agents || [];
      return this.agents;
    } catch {
      return [];
    }
  }

  async getFeed(limit = 50) {
    try {
      const res = await fetch(`${this.url}/api/feed?limit=${limit}`, {
        signal: AbortSignal.timeout(5000),
        headers: this._headers()
      });
      return await res.json();
    } catch {
      return { events: [] };
    }
  }

  _headers() {
    return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
  }

  toJSON() {
    return {
      name: this.name,
      url: this.url,
      status: this.status,
      lastSeen: this.lastSeen,
      latency: this.latency,
      agents: this.agents.length,
      stats: this.stats
    };
  }
}

/**
 * Federation Manager — manages the mesh of connected nodes
 */
export class FederationManager {
  constructor(config = {}) {
    this.nodeName = config.nodeName || process.env.NODE_NAME || 'local';
    this.token = config.federationToken || process.env.FEDERATION_TOKEN || '';
    this.nodes = new Map();
    this.healthInterval = null;
  }

  addNode(config) {
    const node = new FederationNode(config);
    this.nodes.set(config.name, node);
    return node;
  }

  removeNode(name) {
    this.nodes.delete(name);
  }

  getNode(name) {
    return this.nodes.get(name);
  }

  listNodes() {
    return [...this.nodes.values()].map(n => n.toJSON());
  }

  async pingAll() {
    const results = [];
    for (const [name, node] of this.nodes) {
      results.push({ name, ...(await node.ping()) });
    }
    return results;
  }

  startHealthMonitor(intervalMs = 60000) {
    this.healthInterval = setInterval(() => this.pingAll(), intervalMs);
  }

  stopHealthMonitor() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  // === Peer Exec Auth Middleware ===

  authMiddleware() {
    return (req, res, next) => {
      const signature = req.headers['x-signature'];
      if (!signature || !this.token) {
        return next(); // No auth required if no token set
      }
      const body = JSON.stringify(req.body);
      if (!verifySignature(body, signature, this.token)) {
        return res.status(403).json({ error: 'Invalid signature' });
      }
      next();
    };
  }

  toJSON() {
    return {
      nodeName: this.nodeName,
      nodes: this.listNodes(),
      tokenSet: !!this.token
    };
  }
}
