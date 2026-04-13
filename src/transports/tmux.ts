/**
 * Tmux transport — local fast path.
 */

import { sendKeys, listSessions } from "../ssh.js";
import { findWindow } from "../find-window.js";
import type { Transport, TransportTarget, TransportMessage, TransportPresence } from "../transport.js";
import type { FeedEvent } from "../lib/feed.js";

export class TmuxTransport implements Transport {
  readonly name = "tmux";
  private _connected = false;
  private msgHandlers = new Set<(msg: TransportMessage) => void>();
  private presenceHandlers = new Set<(p: TransportPresence) => void>();
  private feedHandlers = new Set<(e: FeedEvent) => void>();

  get connected() { return this._connected; }

  async connect(): Promise<void> { this._connected = true; }
  async disconnect(): Promise<void> { this._connected = false; }

  async send(target: TransportTarget, message: string): Promise<boolean> {
    if (target.host && target.host !== "local" && target.host !== "localhost") return false;
    try {
      let tmuxTarget = target.tmuxTarget;
      if (!tmuxTarget) {
        const sessions = await listSessions();
        tmuxTarget = findWindow(sessions, target.oracle) ?? undefined;
        if (!tmuxTarget) return false;
      }
      await sendKeys(tmuxTarget, message);
      return true;
    } catch { return false; }
  }

  async publishPresence(_p: TransportPresence): Promise<void> {}
  async publishFeed(_e: FeedEvent): Promise<void> {}
  onMessage(h: (msg: TransportMessage) => void) { this.msgHandlers.add(h); }
  onPresence(h: (p: TransportPresence) => void) { this.presenceHandlers.add(h); }
  onFeed(h: (e: FeedEvent) => void) { this.feedHandlers.add(h); }
  canReach(target: TransportTarget): boolean { return !target.host || target.host === "local" || target.host === "localhost"; }
}
