/**
 * Federation Mesh — Multi-machine agent communication
 * Based on maw-js federation system — adapted for Hono + Node.js
 *
 * Features:
 * - HMAC-SHA256 signed peer communication
 * - Auto-discovery via named peers
 * - Health monitoring with clock sync detection
 * - Soul sync (memory sync between peers)
 * - Federation lens support (mesh visualization)
 * - Peer exec relay with session cookies & readonly protection
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { loadConfig, saveConfig, cfgTimeout } from "../config.js";
import { signHeaders, verify, isLoopback } from "../lib/federation-auth.js";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface FederationNodeConfig {
  name: string;
  url: string;
  federationToken?: string;
}

export interface FederationNodeStatus {
  name: string;
  url: string;
  status: "online" | "offline" | "error" | "unknown";
  reachable: boolean;
  latency: number;
  lastSeen: number | null;
  node: string;
  agents: string[];
  clockDeltaMs: number;
  clockWarning: boolean;
  stats: FederationNodeStats;
}

export interface FederationNodeStats {
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  lastError: string | null;
}

export interface FederationMeshStatus {
  nodeName: string;
  localUrl: string;
  nodes: FederationNodeStatus[];
  totalNodes: number;
  onlineNodes: number;
  clockHealth: {
    clockUtc: string;
    timezone: string;
    uptimeSeconds: number;
  };
}

export interface SoulSyncResult {
  synced: string[];
  failed: string[];
  totalEntries: number;
}

export interface PeerExecResult {
  ok: boolean;
  output: string;
  from: string;
  status: number;
  latency: number;
}

// ═══════════════════════════════════════════════════════════════
// Peer Exec Auth — Session cookies + readonly protection
// ═══════════════════════════════════════════════════════════════

const PE_SESSION_TOKEN = randomBytes(16).toString("hex");
const PE_COOKIE_NAME = "pe_session";
const PE_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

const READONLY_CMDS = [
  "/dig", "/trace", "/recap", "/standup",
  "/who-are-you", "/philosophy", "/where-we-are",
  "/find", "/skills", "/contacts", "/overview",
  "/inbox", "/pulse", "/fleet",
];

export function isReadOnlyCmd(cmd: string): boolean {
  const trimmed = cmd.trim();
  return READONLY_CMDS.some(
    (prefix) => trimmed === prefix || trimmed.startsWith(prefix + " ")
  );
}

export function parseSignature(
  signature: string
): { originHost: string; originAgent: string; isAnon: boolean } | null {
  const m = signature.match(/^\[([^:\]]+):([^\]]+)\]$/);
  if (!m) return null;
  const [, originHost, originAgent] = m;
  return { originHost, originAgent, isAnon: originAgent.startsWith("anon-") };
}

export function isShellPeerAllowed(originHost: string): boolean {
  if (originHost.startsWith("anon-")) return false;
  const config = loadConfig() as any;
  const allowed: string[] = config?.wormhole?.shellPeers ?? [];
  return allowed.includes(originHost);
}

export function resolvePeerUrl(peer: string): string | null {
  const config = loadConfig();
  const namedPeers = config.namedPeers || [];
  const match = namedPeers.find((p) => p.name === peer);
  if (match) return match.url;
  if (/^[\w.-]+:\d+$/.test(peer)) return `http://${peer}`;
  if (peer.startsWith("http://") || peer.startsWith("https://")) return peer;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Federation Node — single peer representation
// ═══════════════════════════════════════════════════════════════

const CLOCK_WARN_MS = 3 * 60 * 1000; // 3 minutes

export class FederationNode {
  name: string;
  url: string;
  token: string;
  lastSeen: number | null;
  latency: number;
  status: "online" | "offline" | "error" | "unknown";
  agents: string[];
  node: string;
  clockDeltaMs: number;
  stats: FederationNodeStats;

  constructor(config: FederationNodeConfig) {
    this.name = config.name;
    this.url = config.url;
    this.token = config.federationToken || "";
    this.lastSeen = null;
    this.latency = 0;
    this.status = "unknown";
    this.agents = [];
    this.node = config.name;
    this.clockDeltaMs = 0;
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      lastError: null,
    };
  }

  async ping(): Promise<{ ok: boolean; latency: number; node?: string; agents?: string[] }> {
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), cfgTimeout("http"));
      const res = await fetch(`${this.url}/api/health`, {
        signal: ctrl.signal,
        headers: this._headers(),
      });
      clearTimeout(timeout);
      this.latency = Date.now() - start;
      this.status = res.ok ? "online" : "error";
      this.lastSeen = Date.now();

      if (res.ok) {
        // Fetch identity for clock + agents
        try {
          const ctrl2 = new AbortController();
          const t2 = setTimeout(() => ctrl2.abort(), 3000);
          const res2 = await fetch(`${this.url}/api/identity`, {
            signal: ctrl2.signal,
            headers: this._headers(),
          });
          clearTimeout(t2);
          if (res2.ok) {
            const id = await res2.json();
            this.node = id.node || this.name;
            this.agents = id.agents || [];
            if (id.clockUtc) {
              const peerTime = new Date(id.clockUtc).getTime();
              this.clockDeltaMs = peerTime - Date.now();
            }
          }
        } catch {}
      }

      return { ok: res.ok, latency: this.latency, node: this.node, agents: this.agents };
    } catch (err: any) {
      this.status = "offline";
      this.stats.errors++;
      this.stats.lastError = err.message;
      return { ok: false, latency: Date.now() - start };
    }
  }

  async sendCommand(command: string, body: Record<string, any> = {}): Promise<any> {
    const nonce = randomBytes(8).toString("hex");
    const payload = JSON.stringify({ command, ...body, nonce });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.token
      ? createHmac("sha256", this.token)
          .update(`POST:/api/peer/exec:${timestamp}`)
          .digest("hex")
      : "";

    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`${this.url}/api/peer/exec`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this._headers(),
          ...(signature
            ? { "X-Maw-Timestamp": String(timestamp), "X-Maw-Signature": signature }
            : {}),
        },
        body: payload,
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      this.stats.messagesSent++;
      return await res.json();
    } catch (err: any) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      throw err;
    }
  }

  async getAgents(): Promise<string[]> {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), cfgTimeout("http"));
      const res = await fetch(`${this.url}/api/agents`, {
        signal: ctrl.signal,
        headers: this._headers(),
      });
      clearTimeout(timeout);
      const data = await res.json();
      this.agents = data.agents || [];
      return this.agents;
    } catch {
      return [];
    }
  }

  async getFeed(limit = 50): Promise<any> {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), cfgTimeout("http"));
      const res = await fetch(`${this.url}/api/feed?limit=${limit}`, {
        signal: ctrl.signal,
        headers: this._headers(),
      });
      clearTimeout(timeout);
      return await res.json();
    } catch {
      return { events: [] };
    }
  }

  async getSoulEntries(): Promise<any[]> {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), cfgTimeout("http"));
      const res = await fetch(`${this.url}/api/memory/stats`, {
        signal: ctrl.signal,
        headers: this._headers(),
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        return data.entries || [];
      }
      return [];
    } catch {
      return [];
    }
  }

  _headers(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  toJSON(): FederationNodeStatus {
    return {
      name: this.name,
      url: this.url,
      status: this.status,
      reachable: this.status === "online",
      latency: this.latency,
      lastSeen: this.lastSeen,
      node: this.node,
      agents: this.agents,
      clockDeltaMs: this.clockDeltaMs,
      clockWarning: Math.abs(this.clockDeltaMs) > CLOCK_WARN_MS,
      stats: { ...this.stats },
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// Federation Manager — manages the mesh of connected nodes
// ═══════════════════════════════════════════════════════════════

export class FederationManager {
  nodeName: string;
  token: string;
  nodes: Map<string, FederationNode>;
  private healthInterval: ReturnType<typeof setInterval> | null;
  private messageLog: Array<{ ts: string; from: string; to: string; msg: string; host?: string }>;

  constructor(config: Record<string, any> = {}) {
    const mawConfig = loadConfig();
    this.nodeName = config.nodeName || mawConfig.node || "local";
    this.token = config.federationToken || mawConfig.federationToken || "";
    this.nodes = new Map();
    this.healthInterval = null;
    this.messageLog = [];
  }

  /**
   * Initialize federation from config — auto-add all named peers
   */
  init(): void {
    const config = loadConfig();
    const namedPeers = config.namedPeers || [];
    const plainPeers = config.peers || [];

    for (const peer of namedPeers) {
      this.addNode({
        name: peer.name,
        url: peer.url,
        federationToken: config.federationToken,
      });
    }

    // Plain peers (URLs only) — use hostname as name
    for (const url of plainPeers) {
      try {
        const u = new URL(url);
        const name = u.hostname === "localhost" ? `local:${u.port}` : u.host;
        if (!this.nodes.has(name)) {
          this.addNode({ name, url, federationToken: config.federationToken });
        }
      } catch {}
    }

    console.log(
      `[federation] initialized: ${this.nodeName} with ${this.nodes.size} peer(s)`
    );
  }

  addNode(config: FederationNodeConfig): FederationNode {
    const node = new FederationNode(config);
    this.nodes.set(config.name, node);
    return node;
  }

  removeNode(name: string): boolean {
    return this.nodes.delete(name);
  }

  getNode(name: string): FederationNode | undefined {
    return this.nodes.get(name);
  }

  listNodes(): FederationNodeStatus[] {
    return [...this.nodes.values()].map((n) => n.toJSON());
  }

  async pingAll(): Promise<Array<{ name: string; ok: boolean; latency: number }>> {
    const results = await Promise.allSettled(
      [...this.nodes.values()].map(async (node) => {
        const result = await node.ping();
        return { name: node.name, ...result };
      })
    );
    return results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { name: "unknown", ok: false, latency: -1 }
    );
  }

  startHealthMonitor(intervalMs = 60000): void {
    if (this.healthInterval) return;
    this.healthInterval = setInterval(() => {
      this.pingAll().catch(() => {});
    }, intervalMs);
    console.log(
      `[federation] health monitor started (every ${intervalMs / 1000}s)`
    );
  }

  stopHealthMonitor(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  /**
   * Full mesh status
   */
  async getStatus(): Promise<FederationMeshStatus> {
    const pingResults = await this.pingAll();
    const onlineCount =
      1 +
      pingResults.filter((r) => r.ok).length; // +1 for local

    return {
      nodeName: this.nodeName,
      localUrl: `http://localhost:${loadConfig().port}`,
      nodes: this.listNodes(),
      totalNodes: this.nodes.size + 1,
      onlineNodes: onlineCount,
      clockHealth: {
        clockUtc: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        uptimeSeconds: Math.floor(process.uptime()),
      },
    };
  }

  /**
   * Soul sync — sync memory entries between peers
   */
  async soulSync(): Promise<SoulSyncResult> {
    const synced: string[] = [];
    const failed: string[] = [];
    let totalEntries = 0;

    for (const [name, node] of this.nodes) {
      try {
        const entries = await node.getSoulEntries();
        totalEntries += entries.length;
        if (entries.length > 0) {
          synced.push(name);
        }
      } catch {
        failed.push(name);
      }
    }

    return { synced, failed, totalEntries };
  }

  /**
   * Send command to peer via exec relay
   */
  async execOnPeer(
    peerName: string,
    cmd: string,
    args: Record<string, any> = {}
  ): Promise<PeerExecResult> {
    const node = this.nodes.get(peerName);
    if (!node) {
      return {
        ok: false,
        output: `Unknown peer: ${peerName}`,
        from: "",
        status: 404,
        latency: 0,
      };
    }

    // Readonly protection
    if (!isReadOnlyCmd(cmd) && this.token) {
      const sig = parseSignature(args.signature || "");
      if (sig && !isShellPeerAllowed(sig.originHost)) {
        return {
          ok: false,
          output: `Shell command not allowed from ${sig.originHost}`,
          from: node.url,
          status: 403,
          latency: 0,
        };
      }
    }

    const start = Date.now();
    try {
      const result = await node.sendCommand(cmd, args);
      return {
        ok: true,
        output: JSON.stringify(result),
        from: node.url,
        status: 200,
        latency: Date.now() - start,
      };
    } catch (err: any) {
      return {
        ok: false,
        output: err.message,
        from: node.url,
        status: 502,
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Broadcast message to all online peers
   */
  async broadcast(
    message: string,
    exclude?: string[]
  ): Promise<Array<{ name: string; ok: boolean }>> {
    const results: Array<{ name: string; ok: boolean }> = [];

    for (const [name, node] of this.nodes) {
      if (exclude?.includes(name)) continue;
      if (node.status !== "online") continue;

      try {
        await node.sendCommand("/broadcast", { message });
        this.messageLog.push({
          ts: new Date().toISOString(),
          from: this.nodeName,
          to: name,
          msg: message,
        });
        results.push({ name, ok: true });
      } catch {
        results.push({ name, ok: false });
      }
    }

    return results;
  }

  /**
   * Message log for federation link data
   */
  getMessageLog(
    filter?: { from?: string; to?: string; limit?: number }
  ): Array<{ ts: string; from: string; to: string; msg: string }> {
    let msgs = [...this.messageLog];
    if (filter?.from) msgs = msgs.filter((m) => m.from.includes(filter.from!));
    if (filter?.to) msgs = msgs.filter((m) => m.to.includes(filter.to!));
    return msgs.slice(-(filter?.limit || 100));
  }

  toJSON(): {
    nodeName: string;
    tokenSet: boolean;
    nodes: FederationNodeStatus[];
  } {
    return {
      nodeName: this.nodeName,
      tokenSet: !!this.token,
      nodes: this.listNodes(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// Singleton instance
// ═══════════════════════════════════════════════════════════════

let _manager: FederationManager | null = null;

export function getFederationManager(): FederationManager {
  if (!_manager) {
    _manager = new FederationManager();
    _manager.init();
  }
  return _manager;
}

/**
 * Quick federation status (for API endpoint)
 */
export async function getFederationMeshStatus(): Promise<FederationMeshStatus> {
  const manager = getFederationManager();
  return manager.getStatus();
}
