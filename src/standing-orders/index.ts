/**
 * Standing Orders — Persistent Context for Agents
 * Commands that persist across sessions. Agent always sees them on wake.
 * Based on: The Agent Bus — Standing Orders pattern
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const ORDERS_DIR = join(homedir(), ".oracle", "standing-orders");

export interface StandingOrder {
  id: string;
  agent: string;
  order: string;
  priority: "low" | "normal" | "high" | "critical";
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  active: boolean;
  category: "behavior" | "task" | "monitor" | "communication" | "other";
  trigger?: string;        // optional: condition for when to execute
  lastTriggered?: string;
  triggerCount: number;
}

function ensureDir() { mkdirSync(ORDERS_DIR, { recursive: true }); }
function agentFile(agent: string) { return join(ORDERS_DIR, `${agent}.jsonl`); }

/**
 * Add a standing order for an agent.
 */
export function addOrder(
  agent: string,
  order: string,
  options: {
    priority?: StandingOrder["priority"];
    category?: StandingOrder["category"];
    expiresAt?: string;
    trigger?: string;
  } = {}
): StandingOrder {
  ensureDir();
  const so: StandingOrder = {
    id: `so-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
    agent, order,
    priority: options.priority || "normal",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: options.expiresAt,
    active: true,
    category: options.category || "other",
    trigger: options.trigger,
    triggerCount: 0,
  };
  const f = agentFile(agent);
  const existing = existsSync(f) ? readFileSync(f, "utf-8").split("\n").filter(Boolean) : [];
  writeFileSync(f, [...existing, JSON.stringify(so)].join("\n") + "\n");
  return so;
}

/**
 * Get all active orders for an agent.
 */
export function getOrders(agent: string): StandingOrder[] {
  const f = agentFile(agent);
  if (!existsSync(f)) return [];
  const now = new Date().toISOString();
  return readFileSync(f, "utf-8").split("\n").filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter((o: StandingOrder | null): o is StandingOrder =>
    o !== null && o.active && (!o.expiresAt || o.expiresAt >= now)
  );
}

/**
 * Get orders formatted as system prompt context.
 */
export function getOrdersAsPrompt(agent: string): string {
  const orders = getOrders(agent);
  if (orders.length === 0) return "";

  const sorted = [...orders].sort((a, b) => {
    const pri = { critical: 0, high: 1, normal: 2, low: 3 };
    return pri[a.priority] - pri[b.priority];
  });

  return "## Standing Orders (persistent)\n" +
    sorted.map(o => {
      const icon = o.priority === "critical" ? "🔴" : o.priority === "high" ? "🟠" : o.priority === "normal" ? "🟡" : "🟢";
      return `${icon} [${o.category}] ${o.order}`;
    }).join("\n") +
    "\n\nThese orders persist across all sessions. Follow them unless explicitly overridden.";
}

/**
 * Deactivate an order.
 */
export function deactivateOrder(agent: string, orderId: string): boolean {
  const f = agentFile(agent);
  if (!existsSync(f)) return false;
  const lines = readFileSync(f, "utf-8").split("\n").filter(Boolean);
  let found = false;
  const updated = lines.map(l => {
    try {
      const o = JSON.parse(l);
      if (o.id === orderId) { o.active = false; o.updatedAt = new Date().toISOString(); found = true; }
      return JSON.stringify(o);
    } catch { return l; }
  });
  if (found) writeFileSync(f, updated.join("\n") + "\n");
  return found;
}

/**
 * Mark an order as triggered.
 */
export function triggerOrder(agent: string, orderId: string): boolean {
  const f = agentFile(agent);
  if (!existsSync(f)) return false;
  const lines = readFileSync(f, "utf-8").split("\n").filter(Boolean);
  let found = false;
  const updated = lines.map(l => {
    try {
      const o = JSON.parse(l);
      if (o.id === orderId) {
        o.lastTriggered = new Date().toISOString();
        o.triggerCount = (o.triggerCount || 0) + 1;
        found = true;
      }
      return JSON.stringify(o);
    } catch { return l; }
  });
  if (found) writeFileSync(f, updated.join("\n") + "\n");
  return found;
}

/**
 * Get order statistics for an agent.
 */
export function getOrderStats(agent: string): { total: number; active: number; byPriority: Record<string, number>; byCategory: Record<string, number> } {
  const f = agentFile(agent);
  if (!existsSync(f)) return { total: 0, active: 0, byPriority: {}, byCategory: {} };

  const all = readFileSync(f, "utf-8").split("\n").filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);

  const active = all.filter((o: StandingOrder) => o.active);
  const byPriority: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const o of active) {
    byPriority[o.priority] = (byPriority[o.priority] || 0) + 1;
    byCategory[o.category] = (byCategory[o.category] || 0) + 1;
  }

  return { total: all.length, active: active.length, byPriority, byCategory };
}

/**
 * List all agents with standing orders.
 */
export function listAgentsWithOrders(): string[] {
  ensureDir();
  return readdirSync(ORDERS_DIR)
    .filter(f => f.endsWith(".jsonl"))
    .map(f => f.replace(".jsonl", ""));
}
