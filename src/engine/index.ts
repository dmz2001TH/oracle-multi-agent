/**
 * MawEngine — Main orchestrator for oracle multi-agent system.
 */

import { tmux } from "../tmux.js";
import { registerBuiltinHandlers } from "../handlers.js";
import { pushCapture, pushPreviews, broadcastSessions, sendBusyAgents } from "./capture.js";
import { StatusDetector } from "./status.js";
import { broadcastTeams } from "./teams.js";
import { getAggregatedSessions, getPeers } from "../peers.js";
import { loadConfig, buildCommand, cfgInterval, cfgLimit } from "../config.js";
import type { FeedEvent } from "../lib/feed.js";
import type { MawWS } from "../types.js";
import type { Session } from "../ssh.js";

type SessionInfo = { name: string; windows: { index: number; name: string; active: boolean }[] };

export interface TransportRouter {
  onMessage(cb: (msg: { transport: string; from: string; to: string; body: string }) => Promise<void>): void;
  publishFeed(event: FeedEvent): Promise<void>;
  publishPresence(presence: { oracle: string; host: string; status: string; timestamp: number }): Promise<void>;
  connectAll(): Promise<void>;
}

export class MawEngine {
  private clients = new Set<MawWS>();
  private handlers = new Map<string, (ws: MawWS, data: any, engine: MawEngine) => void | Promise<void>>();
  private lastContent = new Map<MawWS, string>();
  private lastPreviews = new Map<MawWS, Map<string, string>>();
  private sessionCache = { sessions: [] as SessionInfo[], json: "" };
  private status = new StatusDetector();
  private peerSessionsCache: (Session & { source?: string })[] = [];

  private captureInterval: ReturnType<typeof setInterval> | null = null;
  private sessionInterval: ReturnType<typeof setInterval> | null = null;
  private previewInterval: ReturnType<typeof setInterval> | null = null;
  private statusInterval: ReturnType<typeof setInterval> | null = null;
  private teamsInterval: ReturnType<typeof setInterval> | null = null;
  private peerInterval: ReturnType<typeof setInterval> | null = null;
  private crashCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastTeamsJson = { value: "" };
  private feedUnsub: (() => void) | null = null;
  private transportRouter: TransportRouter | null = null;

  feedBuffer: FeedEvent[];
  feedListeners: Set<(event: FeedEvent) => void>;

  constructor({ feedBuffer, feedListeners }: { feedBuffer: FeedEvent[]; feedListeners: Set<(event: FeedEvent) => void> }) {
    this.feedBuffer = feedBuffer;
    this.feedListeners = feedListeners;
    registerBuiltinHandlers(this as any);
    this.initSessionCache();
  }

  private async initSessionCache() {
    try {
      this.sessionCache.sessions = await tmux.listAll();
      this.sessionCache.json = JSON.stringify({ type: "sessions", sessions: this.sessionCache.sessions });
      console.log(`[engine] session cache initialized: ${this.sessionCache.sessions.length} sessions`);
    } catch {
      console.warn("[engine] session cache init failed — will retry on first WS connect");
    }
  }

  on(type: string, handler: (ws: MawWS, data: any, engine: MawEngine) => void | Promise<void>) {
    this.handlers.set(type, handler);
  }

  setTransportRouter(router: TransportRouter) {
    this.transportRouter = router;
    router.onMessage(async (msg) => {
      const { sendKeys, listSessions } = await import("../ssh.js");
      const { findWindow } = await import("../find-window.js");
      const sessions = this.sessionCache.sessions.length > 0
        ? this.sessionCache.sessions
        : await listSessions().catch(() => []);
      const baseName = msg.to.replace(/-oracle$/, "");
      const target = findWindow(sessions as Session[], msg.to) || findWindow(sessions as Session[], baseName);
      if (target) {
        await sendKeys(target, msg.body);
        console.log(`[transport] ${msg.transport}: ${msg.from} → ${target}`);
      } else {
        console.log(`[transport] no target for "${msg.to}" (${sessions.length} sessions)`);
      }
    });
    this.feedListeners.add((event) => { router.publishFeed(event).catch(() => {}); });
  }

  handleOpen(ws: MawWS) {
    this.clients.add(ws);
    this.startIntervals();
    const sendInitialSessions = async () => {
      const local = this.sessionCache.sessions.length > 0
        ? this.sessionCache.sessions
        : await tmux.listAll().catch(() => [] as SessionInfo[]);
      this.sessionCache.sessions = local;
      if (this.peerSessionsCache.length === 0 && getPeers().length > 0) {
        this.peerSessionsCache = await getAggregatedSessions([]).catch(() => []);
      }
      const all = this.peerSessionsCache.length > 0 ? [...local, ...this.peerSessionsCache] : local;
      ws.send(JSON.stringify({ type: "sessions", sessions: all }));
      sendBusyAgents(ws, local);
    };
    sendInitialSessions().catch(() => {});
    ws.send(JSON.stringify({ type: "feed-history", events: this.feedBuffer.slice(-cfgLimit("feedHistory")) }));
  }

  handleMessage(ws: MawWS, msg: string | Buffer) {
    try {
      const data = JSON.parse(msg as string);
      const handler = this.handlers.get(data.type);
      if (handler) handler(ws, data, this);
    } catch (err) { console.error("[engine] handleMessage error:", err); }
  }

  handleClose(ws: MawWS) {
    this.clients.delete(ws);
    this.lastContent.delete(ws);
    this.lastPreviews.delete(ws);
    this.stopIntervals();
  }

  async pushCapture(ws: MawWS) { return pushCapture(ws, this.lastContent); }
  async pushPreviews(ws: MawWS) { return pushPreviews(ws, this.lastPreviews); }

  private startIntervals() {
    if (this.captureInterval) return;
    this.captureInterval = setInterval(() => { for (const ws of this.clients) this.pushCapture(ws); }, cfgInterval("capture"));
    this.sessionInterval = setInterval(async () => { this.sessionCache.sessions = await broadcastSessions(this.clients, this.sessionCache, this.peerSessionsCache); }, cfgInterval("sessions"));
    this.peerInterval = setInterval(async () => {
      if (getPeers().length === 0) { this.peerSessionsCache = []; return; }
      this.peerSessionsCache = await getAggregatedSessions([]);
    }, cfgInterval("peerFetch"));
    this.previewInterval = setInterval(() => { for (const ws of this.clients) this.pushPreviews(ws); }, cfgInterval("preview"));
    this.statusInterval = setInterval(async () => {
      await this.status.detect(this.sessionCache.sessions, this.clients, this.feedListeners);
      if (this.transportRouter) {
        const config = loadConfig();
        const host = config.node ?? "local";
        for (const s of this.sessionCache.sessions) for (const w of s.windows) {
          const target = `${s.name}:${w.index}`;
          const state = this.status.getStatus(target);
          if (state) this.transportRouter.publishPresence({ oracle: w.name.replace(/-oracle$/, ""), host, status: state, timestamp: Date.now() }).catch(() => {});
        }
      }
    }, cfgInterval("status"));
    this.teamsInterval = setInterval(() => { broadcastTeams(this.clients, this.lastTeamsJson); }, cfgInterval("teams"));
    this.crashCheckInterval = setInterval(() => this.handleCrashedAgents(), cfgInterval("crashCheck"));
    const listener = (event: FeedEvent) => {
      const msg = JSON.stringify({ type: "feed", event });
      for (const ws of this.clients) ws.send(msg);
    };
    this.feedListeners.add(listener);
    this.feedUnsub = () => this.feedListeners.delete(listener);
  }

  private stopIntervals() {
    if (this.clients.size > 0) return;
    const clear = (ref: any) => { if (ref) { clearInterval(ref); return null; } return ref; };
    this.captureInterval = clear(this.captureInterval);
    this.sessionInterval = clear(this.sessionInterval);
    this.previewInterval = clear(this.previewInterval);
    this.statusInterval = clear(this.statusInterval);
    this.teamsInterval = clear(this.teamsInterval);
    this.peerInterval = clear(this.peerInterval);
    this.crashCheckInterval = clear(this.crashCheckInterval);
    if (this.feedUnsub) { this.feedUnsub(); this.feedUnsub = null; }
  }

  private async handleCrashedAgents() {
    const config = loadConfig();
    if (!config.autoRestart) return;
    const crashed = this.status.getCrashedAgents(this.sessionCache.sessions);
    for (const agent of crashed) {
      try {
        const cmd = buildCommand(agent.name);
        await tmux.sendText(agent.target, cmd);
        this.status.clearCrashed(agent.target);
        console.log(`\x1b[33m↻ auto-restart\x1b[0m ${agent.name} in ${agent.session}`);
        const event: FeedEvent = {
          timestamp: new Date().toISOString(), oracle: agent.name.replace(/-oracle$/, ""),
          host: "local", event: "SubagentStart", project: agent.session,
          sessionId: "", message: "auto-restarted after crash", ts: Date.now(),
        };
        for (const ws of this.clients) ws.send(JSON.stringify({ type: "feed", event }));
        for (const fn of this.feedListeners) fn(event);
      } catch {}
    }
  }
}
