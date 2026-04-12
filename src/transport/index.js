/**
 * Transport abstraction layer for Oracle Multi-Agent
 * Inspired by maw-js transport system — adapted for Node.js/Windows
 *
 * Local targets → process messaging (fast path)
 * Remote targets → HTTP federation
 * Fallback → WebSocket hub relay
 */

export class TransportError extends Error {
  constructor(message, reason = 'unknown', retryable = false) {
    super(message);
    this.name = 'TransportError';
    this.reason = reason;
    this.retryable = retryable;
  }
}

export function classifyError(err) {
  if (!err) return { reason: 'unknown', retryable: false };
  const msg = String(err).toLowerCase();
  if (/timeout|etimedout|econnreset/.test(msg)) return { reason: 'timeout', retryable: true };
  if (/econnrefused|unreachable|enetunreach/.test(msg)) return { reason: 'unreachable', retryable: true };
  if (/401|403|auth/.test(msg)) return { reason: 'auth', retryable: false };
  if (/429|rate.?limit/.test(msg)) return { reason: 'rate_limit', retryable: true };
  if (/400|reject|denied/.test(msg)) return { reason: 'rejected', retryable: false };
  return { reason: 'unknown', retryable: false };
}

/**
 * Base Transport class — all transports extend this
 */
export class BaseTransport {
  constructor(name) {
    this.name = name;
    this.connected = false;
    this.stats = { sent: 0, received: 0, errors: 0, lastError: null };
  }

  async connect() { this.connected = true; }
  async disconnect() { this.connected = false; }
  async send(target, message) {
    throw new Error(`${this.name}: send() not implemented`);
  }
  async health() {
    return { name: this.name, connected: this.connected, stats: this.stats };
  }
}

/**
 * Local Process Transport — direct messaging between agents in same hub
 */
export class LocalTransport extends BaseTransport {
  constructor(hub) {
    super('local');
    this.hub = hub;
    this.channels = new Map(); // agentName -> Set<callback>
  }

  async connect() {
    this.connected = true;
  }

  subscribe(agentName, callback) {
    if (!this.channels.has(agentName)) this.channels.set(agentName, new Set());
    this.channels.get(agentName).add(callback);
    return () => this.channels.get(agentName)?.delete(callback);
  }

  async send(target, message) {
    const callbacks = this.channels.get(target.oracle);
    if (!callbacks || callbacks.size === 0) {
      this.stats.errors++;
      throw new TransportError(`Agent ${target.oracle} not found locally`, 'unreachable', false);
    }
    for (const cb of callbacks) {
      cb(message);
    }
    this.stats.sent++;
    return { ok: true, via: 'local', retryable: false };
  }
}

/**
 * HTTP Federation Transport — cross-machine communication
 */
export class HttpTransport extends BaseTransport {
  constructor(config = {}) {
    super('http');
    this.peers = new Map();
    this.token = config.federationToken || process.env.FEDERATION_TOKEN || '';
    this.timeout = config.timeout || 10000;
  }

  addPeer(name, url) {
    this.peers.set(name, { name, url, lastSeen: null, latency: 0 });
  }

  removePeer(name) {
    this.peers.delete(name);
  }

  async connect() {
    // Test connectivity to all peers
    for (const [name, peer] of this.peers) {
      try {
        const start = Date.now();
        const res = await fetch(`${peer.url}/api/health`, {
          signal: AbortSignal.timeout(this.timeout),
          headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
        });
        if (res.ok) {
          peer.lastSeen = Date.now();
          peer.latency = Date.now() - start;
        }
      } catch (err) {
        peer.lastSeen = null;
      }
    }
    this.connected = true;
  }

  async send(target, message) {
    const peer = this.peers.get(target.host);
    if (!peer) {
      throw new TransportError(`Unknown peer: ${target.host}`, 'unreachable', false);
    }

    try {
      const res = await fetch(`${peer.url}/api/agents/${target.oracle}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
        },
        body: JSON.stringify({ message: message.body, from: message.from }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${res.status}: ${errText}`);
      }

      this.stats.sent++;
      peer.lastSeen = Date.now();
      return { ok: true, via: 'http', retryable: false };
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      const { reason, retryable } = classifyError(err);
      throw new TransportError(err.message, reason, retryable);
    }
  }

  async health() {
    const base = await super.health();
    base.peers = Object.fromEntries(
      [...this.peers.entries()].map(([k, v]) => [k, { url: v.url, lastSeen: v.lastSeen, latency: v.latency }])
    );
    return base;
  }
}

/**
 * WebSocket Transport — real-time hub relay
 */
export class WsTransport extends BaseTransport {
  constructor(wsServer) {
    super('ws');
    this.wsServer = wsServer;
  }

  async connect() {
    this.connected = !!this.wsServer;
  }

  async send(target, message) {
    if (!this.wsServer) {
      throw new TransportError('WebSocket server not available', 'unreachable', false);
    }
    // Broadcast to connected clients watching this agent
    const payload = JSON.stringify({
      type: 'agent_message',
      agent: target.oracle,
      message,
      timestamp: Date.now()
    });
    this.wsServer.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(payload);
      }
    });
    this.stats.sent++;
    return { ok: true, via: 'ws', retryable: false };
  }
}

/**
 * Transport Router — picks the best transport for each target
 */
export class TransportRouter {
  constructor() {
    this.transports = new Map();
    this.fallbackOrder = ['local', 'ws', 'http'];
  }

  register(name, transport) {
    this.transports.set(name, transport);
  }

  getTransport(name) {
    return this.transports.get(name);
  }

  async connectAll() {
    const results = [];
    for (const [name, transport] of this.transports) {
      try {
        await transport.connect();
        results.push({ name, ok: true });
      } catch (err) {
        results.push({ name, ok: false, error: err.message });
      }
    }
    return results;
  }

  async disconnectAll() {
    for (const [, transport] of this.transports) {
      await transport.disconnect();
    }
  }

  async send(target, message) {
    // Try transports in fallback order
    for (const name of this.fallbackOrder) {
      const transport = this.transports.get(name);
      if (!transport || !transport.connected) continue;
      try {
        return await transport.send(target, message);
      } catch (err) {
        if (err instanceof TransportError && !err.retryable) continue;
        continue;
      }
    }
    throw new TransportError('No transport available', 'unreachable', false);
  }

  async health() {
    const result = {};
    for (const [name, transport] of this.transports) {
      result[name] = await transport.health();
    }
    return result;
  }
}
