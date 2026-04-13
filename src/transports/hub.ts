/**
 * Hub transport — WebSocket client connecting private nodes to a workspace hub.
 */

import { readFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { Transport, TransportTarget, TransportMessage, TransportPresence } from "../transport.js";
import type { FeedEvent } from "../lib/feed.js";
import { sign } from "../lib/federation-auth.js";
import { CONFIG_DIR } from "../paths.js";
import { loadConfig } from "../config.js";

const WORKSPACES_DIR = join(CONFIG_DIR, "workspaces");
const HEARTBEAT_MS = 30_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 60_000;

export interface WorkspaceConfig { id: string; hubUrl: string; token: string; sharedAgents: string[]; }

interface HubConnection {
  config: WorkspaceConfig; ws: WebSocket | null; connected: boolean;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempt: number; remoteAgents: Set<string>;
}

export class HubTransport implements Transport {
  readonly name = "workspace-hub";
  private _connected = false;
  private connections = new Map<string, HubConnection>();
  private nodeId: string;
  private federationToken: string | undefined;
  private msgHandlers = new Set<(msg: TransportMessage) => void>();
  private presenceHandlers = new Set<(p: TransportPresence) => void>();
  private feedHandlers = new Set<(e: FeedEvent) => void>();

  constructor(nodeId?: string) {
    const config = loadConfig();
    this.nodeId = nodeId ?? config.node ?? "local";
    this.federationToken = config.federationToken;
  }

  get connected() { return this._connected; }

  async connect(): Promise<void> {
    const workspaces = loadWorkspaceConfigs();
    if (workspaces.length === 0) return;
    const results = await Promise.allSettled(workspaces.map((ws) => this.connectWorkspace(ws)));
    this._connected = results.some((r) => r.status === "fulfilled" && r.value === true);
  }

  async disconnect(): Promise<void> {
    for (const conn of this.connections.values()) this.cleanupConnection(conn);
    this.connections.clear();
    this._connected = false;
  }

  async send(target: TransportTarget, message: string): Promise<boolean> {
    const qualifiedTarget = target.host ? `${target.host}:${target.oracle}` : target.oracle;
    for (const conn of this.connections.values()) {
      if (!conn.connected || !conn.ws) continue;
      if (conn.remoteAgents.has(target.oracle) || conn.remoteAgents.has(qualifiedTarget)) {
        try { conn.ws.send(JSON.stringify({ type: "message", to: qualifiedTarget, body: message, from: `${this.nodeId}:${target.oracle}`, timestamp: Date.now() })); return true; } catch {}
      }
    }
    return false;
  }

  async publishPresence(presence: TransportPresence): Promise<void> {
    const payload = JSON.stringify({ type: "presence", agents: [{ name: presence.oracle, status: presence.status }], timestamp: presence.timestamp });
    for (const conn of this.connections.values()) { if (conn.connected && conn.ws) try { conn.ws.send(payload); } catch {} }
  }

  async publishFeed(event: FeedEvent): Promise<void> {
    const payload = JSON.stringify({ type: "feed", event });
    for (const conn of this.connections.values()) { if (conn.connected && conn.ws) try { conn.ws.send(payload); } catch {} }
  }

  onMessage(h: (msg: TransportMessage) => void) { this.msgHandlers.add(h); }
  onPresence(h: (p: TransportPresence) => void) { this.presenceHandlers.add(h); }
  onFeed(h: (e: FeedEvent) => void) { this.feedHandlers.add(h); }

  canReach(target: TransportTarget): boolean {
    if (!this._connected) return false;
    const q = target.host ? `${target.host}:${target.oracle}` : target.oracle;
    for (const conn of this.connections.values()) {
      if (conn.connected && (conn.remoteAgents.has(target.oracle) || conn.remoteAgents.has(q))) return true;
    }
    return false;
  }

  workspaceStatus(): { id: string; connected: boolean; remoteAgents: string[] }[] {
    return Array.from(this.connections.values()).map((c) => ({ id: c.config.id, connected: c.connected, remoteAgents: Array.from(c.remoteAgents) }));
  }

  private async connectWorkspace(config: WorkspaceConfig): Promise<boolean> {
    return new Promise((resolve) => {
      const conn: HubConnection = { config, ws: null, connected: false, heartbeatTimer: null, reconnectTimer: null, reconnectAttempt: 0, remoteAgents: new Set() };
      this.connections.set(config.id, conn);
      const timeout = setTimeout(() => { if (!conn.connected) resolve(false); }, 10_000);
      this.openWebSocket(conn, () => { clearTimeout(timeout); resolve(true); });
    });
  }

  private openWebSocket(conn: HubConnection, onFirstConnect?: () => void) {
    try {
      const ws = new WebSocket(conn.config.hubUrl);
      conn.ws = ws;
      ws.addEventListener("open", () => {
        conn.connected = true; conn.reconnectAttempt = 0; this._connected = true;
        this.sendAuth(conn); this.startHeartbeat(conn); onFirstConnect?.();
      });
      ws.addEventListener("message", (event) => { this.handleMessage(conn, typeof event.data === "string" ? event.data : String(event.data)); });
      ws.addEventListener("close", () => { conn.connected = false; this.stopHeartbeat(conn); this.updateConnectedState(); this.scheduleReconnect(conn); });
      ws.addEventListener("error", () => {});
    } catch { this.scheduleReconnect(conn); }
  }

  private sendAuth(conn: HubConnection) {
    if (!conn.ws || conn.ws.readyState !== WebSocket.OPEN) return;
    const ts = Math.floor(Date.now() / 1000);
    const payload: Record<string, any> = { type: "auth", token: conn.config.token, nodeId: this.nodeId, sharedAgents: conn.config.sharedAgents, timestamp: ts };
    if (this.federationToken) { payload._ts = ts; payload._sig = sign(this.federationToken, "WS", `auth:${conn.config.id}`, ts); }
    conn.ws.send(JSON.stringify(payload));
  }

  private handleMessage(conn: HubConnection, raw: string) {
    try {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case "auth-ok": if (Array.isArray(msg.agents)) conn.remoteAgents = new Set(msg.agents); break;
        case "message": for (const h of this.msgHandlers) h({ from: msg.from || "unknown", to: msg.to || "unknown", body: msg.body || "", timestamp: msg.timestamp || Date.now(), transport: "hub" }); break;
        case "presence": if (Array.isArray(msg.agents)) for (const a of msg.agents) { if (a.name) conn.remoteAgents.add(a.name); for (const h of this.presenceHandlers) h({ oracle: a.name || "unknown", host: a.host || a.nodeId || "remote", status: a.status || "ready", timestamp: msg.timestamp || Date.now() }); } break;
        case "feed": if (msg.event) for (const h of this.feedHandlers) h(msg.event); break;
      }
    } catch {}
  }

  private startHeartbeat(conn: HubConnection) {
    this.stopHeartbeat(conn);
    conn.heartbeatTimer = setInterval(() => { if (conn.ws?.readyState === WebSocket.OPEN) conn.ws.send(JSON.stringify({ type: "heartbeat", timestamp: Date.now(), nodeId: this.nodeId })); }, HEARTBEAT_MS);
  }

  private stopHeartbeat(conn: HubConnection) { if (conn.heartbeatTimer) { clearInterval(conn.heartbeatTimer); conn.heartbeatTimer = null; } }

  private scheduleReconnect(conn: HubConnection) {
    if (conn.reconnectTimer) return;
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, conn.reconnectAttempt), RECONNECT_MAX_MS);
    conn.reconnectAttempt++;
    conn.reconnectTimer = setTimeout(() => { conn.reconnectTimer = null; try { conn.ws?.close(); } catch {} this.openWebSocket(conn); }, delay);
  }

  private cleanupConnection(conn: HubConnection) {
    this.stopHeartbeat(conn);
    if (conn.reconnectTimer) { clearTimeout(conn.reconnectTimer); conn.reconnectTimer = null; }
    try { conn.ws?.close(1000, "transport disconnect"); } catch {}
    conn.ws = null; conn.connected = false;
  }

  private updateConnectedState() { this._connected = Array.from(this.connections.values()).some((c) => c.connected); }
}

export function loadWorkspaceConfigs(): WorkspaceConfig[] {
  if (!existsSync(WORKSPACES_DIR)) { mkdirSync(WORKSPACES_DIR, { recursive: true }); return []; }
  return readdirSync(WORKSPACES_DIR).filter((f) => f.endsWith(".json")).map((f) => {
    try {
      const raw = JSON.parse(readFileSync(join(WORKSPACES_DIR, f), "utf-8"));
      if (raw && typeof raw.id === "string" && typeof raw.hubUrl === "string" && typeof raw.token === "string" && Array.isArray(raw.sharedAgents)) return raw as WorkspaceConfig;
    } catch {}
    return null;
  }).filter(Boolean) as WorkspaceConfig[];
}
