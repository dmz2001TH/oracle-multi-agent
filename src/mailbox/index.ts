/**
 * Mailbox System — Tier 2 Transport
 * File-based JSON append + polling IPC for agent-to-agent messaging.
 * No tmux dependency — agents communicate via persistent JSONL mailboxes.
 * Based on: The Agent Bus (Soul Brews Studio) pattern
 */
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const TEAMS_ROOT = join(homedir(), ".oracle", "teams");

export interface MailMessage {
  id: string; ts: string; from: string; to: string; team: string;
  type: "message" | "handoff" | "fyi" | "standing-order" | "broadcast" | "ack";
  body: string; priority: "low" | "normal" | "high" | "urgent";
  readAt?: string; ref?: string; tags?: string[];
}

export interface MailboxStatus {
  agent: string; team: string; unread: number; total: number;
  lastMessage?: string; lastRead?: string;
}

export interface StandingOrder {
  id: string; agent: string; team: string; order: string;
  priority: "low" | "normal" | "high";
  createdAt: string; expiresAt?: string; active: boolean;
}

function ensureDir(p: string) { mkdirSync(p, { recursive: true }); }
function teamDir(t: string) { return join(TEAMS_ROOT, t); }
function inboxDir(t: string) { return join(teamDir(t), "inboxes"); }
function mailboxDir(t: string, a: string) { return join(teamDir(t), "mailboxes", a); }
function agentInbox(t: string, a: string) { return join(inboxDir(t), `${a}.jsonl`); }
function deliveriesFile(t: string, a: string) { return join(mailboxDir(t, a), "deliveries.jsonl"); }
function standingsFile(t: string, a: string) { return join(mailboxDir(t, a), "standings.json"); }

export function sendMessage(team: string, from: string, to: string, body: string, opts: {
  type?: MailMessage["type"]; priority?: MailMessage["priority"]; ref?: string; tags?: string[];
} = {}): MailMessage {
  const msg: MailMessage = {
    id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: new Date().toISOString(), from, to, team,
    type: opts.type || "message", body, priority: opts.priority || "normal",
    ref: opts.ref, tags: opts.tags,
  };
  ensureDir(inboxDir(team));
  ensureDir(mailboxDir(team, from));
  ensureDir(mailboxDir(team, to));
  appendFileSync(agentInbox(team, to), JSON.stringify(msg) + "\n");
  appendFileSync(deliveriesFile(team, from), JSON.stringify({
    messageId: msg.id, deliveredAt: msg.ts, inbox: agentInbox(team, to),
  }) + "\n");
  return msg;
}

export function readInbox(team: string, agent: string, opts: {
  limit?: number; type?: MailMessage["type"]; since?: string; unreadOnly?: boolean;
} = {}): MailMessage[] {
  const f = agentInbox(team, agent);
  if (!existsSync(f)) return [];
  let msgs = readFileSync(f, "utf-8").split("\n").filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  if (opts.type) msgs = msgs.filter((m: MailMessage) => m.type === opts.type);
  if (opts.since) msgs = msgs.filter((m: MailMessage) => m.ts >= opts.since!);
  if (opts.unreadOnly) msgs = msgs.filter((m: MailMessage) => !m.readAt);
  if (opts.limit) msgs = msgs.slice(-opts.limit);
  return msgs;
}

export function markRead(team: string, agent: string, ids: string[]): number {
  const f = agentInbox(team, agent);
  if (!existsSync(f)) return 0;
  const now = new Date().toISOString();
  let count = 0;
  const updated = readFileSync(f, "utf-8").split("\n").filter(Boolean).map(l => {
    try {
      const m = JSON.parse(l);
      if (ids.includes(m.id) && !m.readAt) { m.readAt = now; count++; }
      return JSON.stringify(m);
    } catch { return l; }
  });
  writeFileSync(f, updated.join("\n") + "\n");
  return count;
}

export function markAllRead(team: string, agent: string): number {
  return markRead(team, agent, readInbox(team, agent, { unreadOnly: true }).map(m => m.id));
}

export function getMailboxStatus(team: string, agent: string): MailboxStatus {
  const msgs = readInbox(team, agent);
  const last = msgs[msgs.length - 1];
  return { agent, team, unread: msgs.filter(m => !m.readAt).length, total: msgs.length, lastMessage: last?.ts };
}

export function getTeamStatus(team: string): MailboxStatus[] {
  const dir = inboxDir(team);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith(".jsonl")).map(f => getMailboxStatus(team, f.replace(".jsonl", "")));
}

export function broadcast(team: string, from: string, body: string, opts: {
  type?: MailMessage["type"]; priority?: MailMessage["priority"]; exclude?: string[];
} = {}): MailMessage[] {
  const dir = inboxDir(team);
  if (!existsSync(dir)) return [];
  const agents = readdirSync(dir).filter(f => f.endsWith(".jsonl")).map(f => f.replace(".jsonl", ""))
    .filter(a => a !== from && !opts.exclude?.includes(a));
  return agents.map(a => sendMessage(team, from, a, body, { type: opts.type || "broadcast", priority: opts.priority }));
}

export function setStandingOrder(team: string, agent: string, order: string, opts: {
  priority?: StandingOrder["priority"]; expiresAt?: string;
} = {}): StandingOrder {
  ensureDir(mailboxDir(team, agent));
  const so: StandingOrder = {
    id: `so-${Date.now().toString(36)}`, agent, team, order,
    priority: opts.priority || "normal", createdAt: new Date().toISOString(),
    expiresAt: opts.expiresAt, active: true,
  };
  const f = standingsFile(team, agent);
  let orders: StandingOrder[] = [];
  if (existsSync(f)) try { orders = JSON.parse(readFileSync(f, "utf-8")); } catch {}
  orders.push(so);
  writeFileSync(f, JSON.stringify(orders, null, 2));
  return so;
}

export function getStandingOrders(team: string, agent: string): StandingOrder[] {
  const f = standingsFile(team, agent);
  if (!existsSync(f)) return [];
  try {
    const now = new Date().toISOString();
    return (JSON.parse(readFileSync(f, "utf-8")) as StandingOrder[])
      .filter(o => o.active && (!o.expiresAt || o.expiresAt >= now));
  } catch { return []; }
}

export function cancelStandingOrder(team: string, agent: string, orderId: string): boolean {
  const f = standingsFile(team, agent);
  if (!existsSync(f)) return false;
  try {
    const orders: StandingOrder[] = JSON.parse(readFileSync(f, "utf-8"));
    const o = orders.find(x => x.id === orderId);
    if (o) { o.active = false; writeFileSync(f, JSON.stringify(orders, null, 2)); return true; }
  } catch {}
  return false;
}

export function listTeams(): string[] {
  if (!existsSync(TEAMS_ROOT)) return [];
  return readdirSync(TEAMS_ROOT).filter(f => statSync(join(TEAMS_ROOT, f)).isDirectory());
}

export function listTeamAgents(team: string): string[] {
  const dir = inboxDir(team);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith(".jsonl")).map(f => f.replace(".jsonl", ""));
}

export function archiveInbox(team: string, agent: string): string {
  const f = agentInbox(team, agent);
  if (!existsSync(f)) return "";
  const archiveDir = join(mailboxDir(team, agent), "archive");
  ensureDir(archiveDir);
  const archiveFile = join(archiveDir, `${new Date().toISOString().split("T")[0]}.jsonl`);
  writeFileSync(archiveFile, readFileSync(f, "utf-8"));
  writeFileSync(f, "");
  return archiveFile;
}
