/**
 * Oracle Multi-Agent v5.0 — Typed SDK
 *
 * Public façade for plugins and external consumers.
 * Pattern: one schema → one type → one SDK method.
 * Escape hatch: maw.fetch<T>() for untyped endpoints.
 *
 * See: multi-agent-orchestration-book Chapter 10
 */

import type {
  Identity, Peer, FederationStatus, Session, FeedEvent,
  Team, Task, CreateTaskInput, UpdateTaskInput, TaskStatus,
  InboxMessage, PluginInfo, AgentStatus, CronJob,
} from "./lib/schemas.js";
import { loadConfig } from "./config.js";

// ─── Base URL ───────────────────────────────────────────────────
function baseUrl(): string {
  const cfg = loadConfig();
  const port = cfg.port || 3456;
  return `http://localhost:${port}`;
}

// ─── Typed Fetch (escape hatch) ─────────────────────────────────
async function typedFetch<T>(
  path: string,
  init?: RequestInit & { timeout?: number },
): Promise<T> {
  const { timeout = 5000, ...rest } = init || {};
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    ...rest,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ""}`);
  }
  return (await res.json()) as T;
}

// ─── Safe fetch (swallows errors, returns fallback) ─────────────
async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await typedFetch<T>(path);
  } catch {
    return fallback;
  }
}

// ─── Print helpers (pure local, no I/O) ─────────────────────────
export const print = {
  ok(msg: string) { console.log(`✅ ${msg}`); },
  warn(msg: string) { console.warn(`⚠️  ${msg}`); },
  err(msg: string) { console.error(`❌ ${msg}`); },
  kv(key: string, value: unknown) { console.log(`  ${key}: ${value}`); },
  list(items: string[]) { items.forEach(i => console.log(`  • ${i}`)); },
  table(rows: Record<string, unknown>[]) {
    if (rows.length === 0) return;
    const keys = Object.keys(rows[0]);
    console.log(keys.join("\t"));
    rows.forEach(r => console.log(keys.map(k => r[k] ?? "").join("\t")));
  },
  hr() { console.log("─".repeat(40)); },
};

// ─── SDK ────────────────────────────────────────────────────────
export const maw = {
  // ── Info ──────────────────────────────────────────────────
  baseUrl,

  async identity(): Promise<Identity> {
    return safeFetch<Identity>("/api/identity", {
      node: "unknown", version: "5.0.0", agents: [],
      clockUtc: new Date().toISOString(), uptime: 0,
      port: 3456, process: "unknown",
    });
  },

  async federation(): Promise<FederationStatus> {
    return safeFetch<FederationStatus>("/api/federation/status", {
      node: "unknown", peers: [], totalPeers: 0, reachablePeers: 0,
    });
  },

  // ── Sessions ──────────────────────────────────────────────
  async sessions(): Promise<Session[]> {
    const res = await safeFetch<{ sessions: Session[] }>("/api/sessions", { sessions: [] });
    return res.sessions ?? [];
  },

  // ── Feed ──────────────────────────────────────────────────
  async feed(limit?: number): Promise<FeedEvent[]> {
    const q = limit ? `?limit=${limit}` : "";
    const res = await safeFetch<{ events: FeedEvent[] }>(`/api/feed${q}`, { events: [] });
    return res.events ?? [];
  },

  // ── Teams ─────────────────────────────────────────────────
  async teams(): Promise<Team[]> {
    const res = await safeFetch<{ teams: Team[] }>("/api/teams", { teams: [] });
    return res.teams ?? [];
  },

  async team(name: string): Promise<Team | null> {
    return safeFetch<Team | null>(`/api/teams/${name}`, null);
  },

  // ── Tasks (Chapter 4: TaskCreate/TaskList/TaskUpdate) ─────
  async tasks(team?: string): Promise<Task[]> {
    const q = team ? `?team=${team}` : "";
    const res = await safeFetch<{ tasks: Task[] }>(`/api/tasks${q}`, { tasks: [] });
    return res.tasks ?? [];
  },

  async createTask(input: CreateTaskInput): Promise<Task> {
    return typedFetch<Task>("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    return typedFetch<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async deleteTask(id: string): Promise<void> {
    await typedFetch<{ ok: boolean }>(`/api/tasks/${id}`, { method: "DELETE" });
  },

  // ── Messaging ─────────────────────────────────────────────
  async send(target: string, text: string): Promise<void> {
    const { cmdSend } = await import("./commands/comm.js");
    await cmdSend(target, text);
  },

  // ── Inbox (Chapter 3: persistent transport) ───────────────
  async inbox(limit?: number): Promise<InboxMessage[]> {
    const q = limit ? `?limit=${limit}` : "";
    const res = await safeFetch<{ messages: InboxMessage[] }>(`/api/inbox${q}`, { messages: [] });
    return res.messages ?? [];
  },

  async inboxWrite(from: string, body: string, tags?: string[]): Promise<InboxMessage> {
    return typedFetch<InboxMessage>("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, body, tags }),
    });
  },

  // ── Plugins ───────────────────────────────────────────────
  async plugins(): Promise<PluginInfo[]> {
    const res = await safeFetch<{ plugins: PluginInfo[] }>("/api/plugins", { plugins: [] });
    return res.plugins ?? [];
  },

  // ── Agent Status (Chapter 8: war room) ────────────────────
  async agentStatus(name?: string): Promise<AgentStatus[]> {
    const q = name ? `?name=${name}` : "";
    const res = await safeFetch<{ agents: AgentStatus[] }>(`/api/agents/status${q}`, { agents: [] });
    return res.agents ?? [];
  },

  // ── Escape hatch ──────────────────────────────────────────
  fetch: typedFetch,

  // ── Print ─────────────────────────────────────────────────
  print,
};
