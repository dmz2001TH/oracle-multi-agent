/**
 * HTTP transport — fallback for peers[] federation.
 */

import { getAggregatedSessions } from "../peers.js";
import { curlFetch } from "../curl-fetch.js";
import { cfgTimeout } from "../config.js";
import { listSessions } from "../ssh.js";
import { findWindow } from "../find-window.js";
import type { Transport, TransportTarget, TransportMessage, TransportPresence } from "../transport.js";
import type { FeedEvent } from "../lib/feed.js";

export interface HttpTransportConfig { peers: string[]; selfHost: string; }

export class HttpTransport implements Transport {
  readonly name = "http-federation";
  private _connected = false;
  private config: HttpTransportConfig;
  private msgHandlers = new Set<(msg: TransportMessage) => void>();
  private presenceHandlers = new Set<(p: TransportPresence) => void>();
  private feedHandlers = new Set<(e: FeedEvent) => void>();

  constructor(config: HttpTransportConfig) { this.config = config; }
  get connected() { return this._connected; }

  async connect(): Promise<void> { this._connected = this.config.peers.length > 0; }
  async disconnect(): Promise<void> { this._connected = false; }

  async send(target: TransportTarget, message: string): Promise<boolean> {
    const localSessions = await listSessions();
    const allSessions = await getAggregatedSessions(localSessions);
    for (const session of allSessions) {
      const source = (session as any).source;
      if (!source || source === "local") continue;
      if (session.windows.some((w) => w.name.toLowerCase().includes(target.oracle.toLowerCase()))) {
        const tmuxTarget = findWindow([session], target.oracle);
        if (tmuxTarget) {
          try {
            const res = await curlFetch(`${source}/api/send`, { method: "POST", body: JSON.stringify({ target: tmuxTarget, text: message }), timeout: cfgTimeout("http") });
            return res.ok;
          } catch { return false; }
        }
      }
    }
    return false;
  }

  async publishPresence(_p: TransportPresence): Promise<void> {}

  async publishFeed(event: FeedEvent): Promise<void> {
    await Promise.allSettled(this.config.peers.map(async (url) => {
      try { await curlFetch(`${url}/api/feed`, { method: "POST", body: JSON.stringify(event), timeout: cfgTimeout("http") }); } catch {}
    }));
  }

  onMessage(h: (msg: TransportMessage) => void) { this.msgHandlers.add(h); }
  onPresence(h: (p: TransportPresence) => void) { this.presenceHandlers.add(h); }
  onFeed(h: (e: FeedEvent) => void) { this.feedHandlers.add(h); }
  canReach(target: TransportTarget): boolean {
    if (!target.host || target.host === "local" || target.host === "localhost") return false;
    return this.config.peers.length > 0;
  }
}
