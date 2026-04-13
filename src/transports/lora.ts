/**
 * LoRa transport — off-grid mesh networking (future hardware stub).
 */

import type { Transport, TransportTarget, TransportMessage, TransportPresence } from "../transport.js";
import type { FeedEvent } from "../lib/feed.js";

export class LoRaTransport implements Transport {
  readonly name = "lora";
  private _connected = false;
  private msgHandlers = new Set<(msg: TransportMessage) => void>();
  private presenceHandlers = new Set<(p: TransportPresence) => void>();
  private feedHandlers = new Set<(e: FeedEvent) => void>();

  get connected() { return this._connected; }
  async connect(): Promise<void> { this._connected = false; }
  async disconnect(): Promise<void> { this._connected = false; }
  async send(_t: TransportTarget, _m: string): Promise<boolean> { return false; }
  async publishPresence(_p: TransportPresence): Promise<void> {}
  async publishFeed(_e: FeedEvent): Promise<void> {}
  onMessage(h: (msg: TransportMessage) => void) { this.msgHandlers.add(h); }
  onPresence(h: (p: TransportPresence) => void) { this.presenceHandlers.add(h); }
  onFeed(h: (e: FeedEvent) => void) { this.feedHandlers.add(h); }
  canReach(_t: TransportTarget): boolean { return false; }
}
