/**
 * NanoClaw transport — bridge to external chat channels (Telegram, Discord, etc.)
 */

import type { Transport, TransportTarget, TransportMessage, TransportPresence } from "../transport.js";
import type { FeedEvent } from "../lib/feed.js";
import { resolveNanoclawJid, sendViaNanoclaw } from "../bridges/nanoclaw.js";

export class NanoclawTransport implements Transport {
  readonly name = "nanoclaw";
  private _connected = true;
  private msgHandlers = new Set<(msg: TransportMessage) => void>();
  private presenceHandlers = new Set<(p: TransportPresence) => void>();
  private feedHandlers = new Set<(e: FeedEvent) => void>();

  get connected() { return this._connected; }
  async connect(): Promise<void> { this._connected = true; }
  async disconnect(): Promise<void> { this._connected = false; }

  async send(target: TransportTarget, message: string): Promise<boolean> {
    const resolved = resolveNanoclawJid(target.oracle);
    if (!resolved) return false;
    return sendViaNanoclaw(resolved.jid, message, resolved.url);
  }

  async publishPresence(_p: TransportPresence): Promise<void> {}
  async publishFeed(_e: FeedEvent): Promise<void> {}
  onMessage(h: (msg: TransportMessage) => void) { this.msgHandlers.add(h); }
  onPresence(h: (p: TransportPresence) => void) { this.presenceHandlers.add(h); }
  onFeed(h: (e: FeedEvent) => void) { this.feedHandlers.add(h); }
  canReach(target: TransportTarget): boolean { return resolveNanoclawJid(target.oracle) !== null; }
}
