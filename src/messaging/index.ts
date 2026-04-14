/**
 * Message Bus — Three transports for agent communication
 *
 * Inspired by maw's three transports:
 *   1. SendMessage — structured, named, team-scoped (in-process)
 *   2. hey — plain text, cross-process (federation)
 *   3. Inbox — persistent, file-backed, survives sessions
 *
 * Plus the Reporting Contract:
 *   - Every agent MUST report back when done
 *   - Channel + recipient + when must be explicit
 */

import { EventEmitter } from "events";
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DATA_DIR = process.env.ORACLE_DATA_DIR || join(homedir(), ".oracle");
const INBOX_DIR = join(DATA_DIR, "inbox");

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  summary?: string; // UI affordance — 5-10 words for dashboard
  type: "request" | "response" | "notification" | "report" | "shutdown";
  channel: "sendmessage" | "hey" | "inbox";
  timestamp: number;
  readAt?: number;
  metadata?: Record<string, any>;
}

export interface InboxEntry {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  sessionId: string;
  readAt?: number;
}

// ═══════════════════════════════════════════════════════════
// In-Memory Message Queue (SendMessage — Tier 2)
// ═══════════════════════════════════════════════════════════

const messageQueue: AgentMessage[] = [];
const messageBus = new EventEmitter();

let idCounter = 0;
function nextId(): string {
  return `msg-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

/**
 * SendMessage — structured, named, auto-delivered
 * For Tier 2 (in-process teams)
 */
export function sendMessage(params: {
  from: string;
  to: string;
  content: string;
  summary?: string;
  type?: AgentMessage["type"];
  metadata?: Record<string, any>;
}): AgentMessage {
  const msg: AgentMessage = {
    id: nextId(),
    from: params.from,
    to: params.to,
    content: params.content,
    summary: params.summary,
    type: params.type || "notification",
    channel: "sendmessage",
    timestamp: Date.now(),
    metadata: params.metadata,
  };
  messageQueue.push(msg);
  messageBus.emit("message", msg);
  messageBus.emit(`message:${params.to}`, msg);
  return msg;
}

/**
 * Get messages for an agent (inbox-style)
 */
export function getMessages(agentName: string, opts: {
  unreadOnly?: boolean;
  limit?: number;
  type?: AgentMessage["type"];
} = {}): AgentMessage[] {
  let msgs = messageQueue.filter(m =>
    m.to.toLowerCase() === agentName.toLowerCase() &&
    m.channel === "sendmessage"
  );
  if (opts.unreadOnly) msgs = msgs.filter(m => !m.readAt);
  if (opts.type) msgs = msgs.filter(m => m.type === opts.type);
  msgs.sort((a, b) => b.timestamp - a.timestamp);
  return msgs.slice(0, opts.limit || 50);
}

/**
 * Mark messages as read
 */
export function markRead(agentName: string, messageIds?: string[]): number {
  let count = 0;
  for (const msg of messageQueue) {
    if (msg.to.toLowerCase() !== agentName.toLowerCase()) continue;
    if (messageIds && !messageIds.includes(msg.id)) continue;
    if (!msg.readAt) {
      msg.readAt = Date.now();
      count++;
    }
  }
  return count;
}

/**
 * Broadcast — send to all agents except sender
 */
export function broadcast(params: {
  from: string;
  content: string;
  summary?: string;
  type?: AgentMessage["type"];
  agents: string[];
}): AgentMessage[] {
  return params.agents
    .filter(a => a.toLowerCase() !== params.from.toLowerCase())
    .map(to => sendMessage({ ...params, to }));
}

// ═══════════════════════════════════════════════════════════
// Persistent Inbox (cross-session)
// ═══════════════════════════════════════════════════════════

function ensureInboxDir(): void {
  if (!existsSync(INBOX_DIR)) mkdirSync(INBOX_DIR, { recursive: true });
}

function inboxFile(agentName: string): string {
  return join(INBOX_DIR, `${agentName}.jsonl`);
}

/**
 * Write to persistent inbox — survives session death
 * For cross-session hand-offs
 */
export function writeInbox(params: {
  from: string;
  to: string;
  content: string;
  sessionId?: string;
}): InboxEntry {
  ensureInboxDir();
  const entry: InboxEntry = {
    id: nextId(),
    from: params.from,
    to: params.to,
    content: params.content,
    timestamp: Date.now(),
    sessionId: params.sessionId || "unknown",
  };
  appendFileSync(inboxFile(params.to), JSON.stringify(entry) + "\n");
  return entry;
}

/**
 * Read persistent inbox
 */
export function readInbox(agentName: string, opts: {
  unreadOnly?: boolean;
  limit?: number;
} = {}): InboxEntry[] {
  const file = inboxFile(agentName);
  if (!existsSync(file)) return [];
  const entries = readFileSync(file, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map(l => { try { return JSON.parse(l) as InboxEntry; } catch { return null; } })
    .filter(Boolean) as InboxEntry[];
  let result = opts.unreadOnly ? entries.filter(e => !e.readAt) : entries;
  result.sort((a, b) => b.timestamp - a.timestamp);
  return result.slice(0, opts.limit || 50);
}

// ═══════════════════════════════════════════════════════════
// Reporting Contract — agents MUST report back
// ═══════════════════════════════════════════════════════════

/**
 * Report completion — the agent's "I'm done" signal.
 * This is the equivalent of maw hey <orchestrator> "#<id> complete: <summary>"
 */
export function reportCompletion(params: {
  agentName: string;
  taskId: string;
  summary: string;
  details?: string;
}): AgentMessage {
  return sendMessage({
    from: params.agentName,
    to: "orchestrator",
    content: params.details || params.summary,
    summary: `#${params.taskId} complete: ${params.summary}`,
    type: "report",
    metadata: { taskId: params.taskId, completed: true },
  });
}

/**
 * Report blocker — agent is stuck, needs help
 */
export function reportBlocker(params: {
  agentName: string;
  taskId: string;
  blocker: string;
}): AgentMessage {
  return sendMessage({
    from: params.agentName,
    to: "orchestrator",
    content: params.blocker,
    summary: `#${params.taskId} BLOCKED: ${params.blocker.slice(0, 80)}`,
    type: "request",
    metadata: { taskId: params.taskId, blocked: true },
  });
}

/**
 * Report progress — intermediate update (not completion)
 */
export function reportProgress(params: {
  agentName: string;
  taskId: string;
  progress: string;
}): AgentMessage {
  return sendMessage({
    from: params.agentName,
    to: "orchestrator",
    content: params.progress,
    summary: `#${params.taskId} progress: ${params.progress.slice(0, 60)}`,
    type: "notification",
    metadata: { taskId: params.taskId },
  });
}

// ═══════════════════════════════════════════════════════════
// Event Bus
// ═══════════════════════════════════════════════════════════

export function onMessage(agentName: string, handler: (msg: AgentMessage) => void): () => void {
  messageBus.on(`message:${agentName}`, handler);
  return () => messageBus.off(`message:${agentName}`, handler);
}

export function getAllMessages(): AgentMessage[] {
  return [...messageQueue];
}

export function getMessageStats(): {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byAgent: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  const byAgent: Record<string, number> = {};
  let unread = 0;
  for (const msg of messageQueue) {
    byType[msg.type] = (byType[msg.type] || 0) + 1;
    byAgent[msg.to] = (byAgent[msg.to] || 0) + 1;
    if (!msg.readAt) unread++;
  }
  return { total: messageQueue.length, unread, byType, byAgent };
}
