/**
 * Oracle Multi-Agent v5.0 — Shared Schemas
 *
 * Single source of truth for all types. Inspired by the book's
 * TypeBox pattern: one definition, multiple consumers.
 */

// ─── Identity ───────────────────────────────────────────────────
export interface Identity {
  node: string;
  version: string;
  agents: string[];
  clockUtc: string;
  uptime: number;
  port: number;
  process: string;
}

// ─── Federation ─────────────────────────────────────────────────
export interface Peer {
  name: string;
  url: string;
  reachable: boolean;
  latency?: number;
  lastSeen?: string;
}

export interface FederationStatus {
  node: string;
  peers: Peer[];
  totalPeers: number;
  reachablePeers: number;
}

// ─── Sessions ───────────────────────────────────────────────────
export interface Session {
  id: string;
  name: string;
  status: "active" | "idle" | "dead";
  startedAt: string;
  lastActivity?: string;
  model?: string;
  pid?: number;
  pane?: string;
}

// ─── Feed ───────────────────────────────────────────────────────
export interface FeedEvent {
  id: string;
  event: string;
  oracle: string;
  host: string;
  message: string;
  ts: number;
}

// ─── Teams ──────────────────────────────────────────────────────
export interface TeamMember {
  name: string;
  role: string;
  model?: string;
  backendType?: "tmux" | "in-process";
  tmuxPaneId?: string;
  cwd?: string;
  joinedAt?: number;
  agentType?: string;
}

export interface Team {
  name: string;
  description?: string;
  lead: string;
  members: TeamMember[];
  tasks: Task[];
  alive: boolean;
  createdAt?: string;
}

// ─── Tasks ──────────────────────────────────────────────────────
export type TaskStatus = "pending" | "in_progress" | "completed" | "deleted";

export interface Task {
  id: string;
  subject: string;
  description?: string;
  owner?: string;
  status: TaskStatus;
  blockedBy?: string[];
  team?: string;
  branch?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  subject: string;
  description?: string;
  owner?: string;
  team?: string;
  blockedBy?: string[];
  branch?: string;
}

export interface UpdateTaskInput {
  subject?: string;
  description?: string;
  owner?: string;
  status?: TaskStatus;
  blockedBy?: string[];
  branch?: string;
}

// ─── Messages / Inbox ───────────────────────────────────────────
export interface InboxMessage {
  id: string;
  from: string;
  to: string;
  subject?: string;
  body: string;
  ts: string;
  read: boolean;
  tags?: string[];
}

// ─── Plugins ────────────────────────────────────────────────────
export interface PluginInfo {
  name: string;
  description: string;
  version?: string;
  source: "builtin" | "user" | "wasm";
  path: string;
}

// ─── Traces ─────────────────────────────────────────────────────
export interface Trace {
  id: string;
  title: string;
  description?: string;
  digPoints: DigPoint[];
  linkedTraces?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DigPoint {
  type: "file" | "commit" | "issue" | "url" | "note";
  ref: string;
  summary?: string;
}

// ─── Forum ──────────────────────────────────────────────────────
export interface ForumThread {
  id: string;
  title: string;
  status: "open" | "resolved" | "closed";
  messages: ForumMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ForumMessage {
  id: string;
  threadId: string;
  author: string;
  body: string;
  ts: string;
}

// ─── Agent Status ───────────────────────────────────────────────
export interface AgentStatus {
  name: string;
  team?: string;
  status: "working" | "idle" | "stuck" | "done";
  lastHeartbeat?: string;
  currentTask?: string;
  branch?: string;
  tmuxSession?: string;
}

// ─── Cron ───────────────────────────────────────────────────────
export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  lastRun?: string;
  nextRun?: string;
  enabled: boolean;
  firings: number;
}

// ─── Task Log ───────────────────────────────────────────────────
export interface TaskLogEntry {
  id: string;
  taskId: string;
  type: "log" | "commit" | "blocker" | "status";
  message: string;
  author?: string;
  ts: string;
}

// ─── Project ────────────────────────────────────────────────────
export interface Project {
  name: string;
  description?: string;
  tasks: string[]; // task IDs
  status: "active" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
}

// ─── Tokens ─────────────────────────────────────────────────────
export interface TokenUsage {
  agent: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  lastUpdated: string;
}

export interface TokenStats {
  agents: TokenUsage[];
  totalInput: number;
  totalOutput: number;
  totalCost: number;
}

// ─── Think ──────────────────────────────────────────────────────
export interface ThinkProposal {
  id: string;
  oracle: string;
  type: "improvement" | "bug" | "feature" | "refactor";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "proposed" | "accepted" | "rejected" | "implemented";
  ts: string;
}

// ─── Meeting ────────────────────────────────────────────────────
export interface Meeting {
  id: string;
  topic: string;
  participants: string[];
  status: "scheduled" | "in_progress" | "completed";
  notes: string;
  ts: string;
}

// ─── Chat Log ───────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  oracle: string;
  role: "human" | "oracle" | "system";
  content: string;
  ts: string;
}
