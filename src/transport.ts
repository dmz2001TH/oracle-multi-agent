/**
 * Transport abstraction layer — pluggable messaging channels.
 *
 * Priority: tmux (local) → hub (workspace) → http-federation (peers) → nanoclaw → lora
 */

import type { FeedEvent } from "./lib/feed.js";

export type TransportFailureReason = "timeout" | "unreachable" | "auth" | "rate_limit" | "rejected" | "parse_error" | "unknown";

export interface TransportResult { ok: boolean; via: string; reason?: TransportFailureReason; retryable: boolean; }

export function classifyError(err: unknown): { reason: TransportFailureReason; retryable: boolean } {
  if (!err) return { reason: "unknown", retryable: false };
  const msg = String(err).toLowerCase();
  if (/timeout|etimedout|econnreset/.test(msg)) return { reason: "timeout", retryable: true };
  if (/econnrefused|unreachable|enetunreach/.test(msg)) return { reason: "unreachable", retryable: true };
  if (/401|403|auth|unauthorized|forbidden/.test(msg)) return { reason: "auth", retryable: false };
  if (/429|rate.?limit|too many/.test(msg)) return { reason: "rate_limit", retryable: true };
  return { reason: "unknown", retryable: false };
}

export interface TransportTarget { oracle: string; host?: string; tmuxTarget?: string; }
export interface TransportMessage { from: string; to: string; body: string; timestamp: number; transport: "tmux" | "mqtt" | "http" | "hub"; }
export interface TransportPresence { oracle: string; host: string; status: "busy" | "ready" | "idle" | "crashed" | "offline"; timestamp: number; }

export interface Transport {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(target: TransportTarget, message: string): Promise<boolean>;
  publishPresence(presence: TransportPresence): Promise<void>;
  publishFeed(event: FeedEvent): Promise<void>;
  onMessage(handler: (msg: TransportMessage) => void): void;
  onPresence(handler: (p: TransportPresence) => void): void;
  onFeed(handler: (e: FeedEvent) => void): void;
  canReach(target: TransportTarget): boolean;
  readonly connected: boolean;
}

export class TransportRouter {
  private transports: Transport[] = [];
  private messageHandlers = new Set<(msg: TransportMessage) => void>();
  private presenceHandlers = new Set<(p: TransportPresence) => void>();
  private feedHandlers = new Set<(e: FeedEvent) => void>();

  register(transport: Transport) {
    this.transports.push(transport);
    transport.onMessage((msg) => { for (const h of this.messageHandlers) h(msg); });
    transport.onPresence((p) => { for (const h of this.presenceHandlers) h(p); });
    transport.onFeed((e) => { for (const h of this.feedHandlers) h(e); });
  }

  async connectAll(): Promise<void> { await Promise.allSettled(this.transports.map((t) => t.connect())); }
  async disconnectAll(): Promise<void> { await Promise.allSettled(this.transports.map((t) => t.disconnect())); }

  async send(target: TransportTarget, message: string, _from: string): Promise<TransportResult> {
    for (const t of this.transports) {
      if (t.connected && t.canReach(target)) {
        try {
          const ok = await t.send(target, message);
          if (ok) return { ok: true, via: t.name, retryable: false };
        } catch (err) {
          const { reason, retryable } = classifyError(err);
          if (!retryable) return { ok: false, via: t.name, reason, retryable };
        }
      }
    }
    return { ok: false, via: "none", reason: "unreachable", retryable: false };
  }

  async publishPresence(presence: TransportPresence): Promise<void> {
    await Promise.allSettled(this.transports.filter((t) => t.connected).map((t) => t.publishPresence(presence)));
  }

  async publishFeed(event: FeedEvent): Promise<void> {
    await Promise.allSettled(this.transports.filter((t) => t.connected).map((t) => t.publishFeed(event)));
  }

  onMessage(handler: (msg: TransportMessage) => void) { this.messageHandlers.add(handler); }
  onPresence(handler: (p: TransportPresence) => void) { this.presenceHandlers.add(handler); }
  onFeed(handler: (e: FeedEvent) => void) { this.feedHandlers.add(handler); }

  status(): { name: string; connected: boolean }[] {
    return this.transports.map((t) => ({ name: t.name, connected: t.connected }));
  }
}
