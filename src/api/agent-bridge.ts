/**
 * Agent Bridge API — Connects manager.js + store.js to Hono HTTP
 *
 * Endpoints:
 *   GET    /api/v2/agents              — list all agents (running + registered)
 *   POST   /api/v2/agents/spawn        — spawn a new agent
 *   GET    /api/v2/agents/:id          — get agent details
 *   DELETE /api/v2/agents/:id          — stop an agent
 *   POST   /api/v2/agents/:id/chat     — send message to agent, get response
 *   POST   /api/v2/agents/:from/tell/:to — agent-to-agent message
 *   POST   /api/v2/agents/broadcast    — broadcast to all running agents
 */

import { Hono } from "hono";
import { join } from "path";
import { homedir } from "os";
import { MemoryStore } from "../memory/store.js";
import { AgentManager } from "../agents/manager.js";

// WebSocket broadcast helper (set by index.ts)
function wsBroadcast(data: any) {
  try { (globalThis as any).__wsBroadcast?.(data); } catch {}
}

// Initialize store and manager (singleton)
const DB_PATH = process.env.ORACLE_DB_PATH || join(homedir(), ".config", "oracle", "oracle.db");
const store = new MemoryStore(DB_PATH);
const manager = new AgentManager(store, {
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  mimoApiKey: process.env.MIMO_API_KEY || "",
  mimoApiBase: process.env.MIMO_API_BASE || "https://api.xiaomimimo.com/v1",
  provider: process.env.LLM_PROVIDER || "gemini",
  agentModel: process.env.AGENT_MODEL || "gemini-2.0-flash",
  port: Number(process.env.HUB_PORT || 3456),
  maxAgents: Number(process.env.MAX_CONCURRENT_AGENTS || 5),
});

export { store, manager };
export const agentBridgeApi = new Hono();

// ─── Legacy route aliases (agent workers call without /v2/) ────
agentBridgeApi.get("/api/agents", (c) => {
  const registered = store.listAgents();
  const running = manager.getRunningAgents();
  const merged = registered.map((a: any) => ({
    ...a,
    running: running.some((r: any) => r.id === a.id),
  }));
  return c.json(merged); // Return array directly for dashboard compatibility
});

// POST /api/agents — spawn agent (dashboard compatibility)
agentBridgeApi.post("/api/agents", async (c) => {
  try {
    const body = await c.req.json();
    const { name, role, personality } = body;
    if (!name) return c.json({ error: 'name is required' }, 400);
    const agent = await manager.spawnAgent(name, role || 'general', personality || '');

    // Broadcast to dashboard
    try {
      const wsBroadcast = (globalThis as any).__wsBroadcast;
      if (wsBroadcast) {
        wsBroadcast({ type: 'agent_spawned', agent });
      }
    } catch {}

    return c.json(agent);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// DELETE /api/agents/:id — stop agent (dashboard compatibility)
agentBridgeApi.delete("/api/agents/:id", async (c) => {
  try {
    const id = c.req.param('id');
    await manager.stopAgent(id);

    // Broadcast to dashboard
    try {
      const wsBroadcast = (globalThis as any).__wsBroadcast;
      if (wsBroadcast) {
        wsBroadcast({ type: 'agent_died', agentId: id });
      }
    } catch {}

    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /api/stats — dashboard stats
agentBridgeApi.get("/api/stats", (c) => {
  try {
    const registered = store.listAgents();
    const running = manager.getRunningAgents();
    const memStats = store.getStats();
    return c.json({
      agents: registered.length,
      activeAgents: running.length,
      memories: memStats?.memories || 0,
      messages: memStats?.messages || 0,
      uptime: process.uptime(),
    });
  } catch {
    return c.json({ agents: 0, activeAgents: 0, memories: 0, messages: 0 });
  }
});

// Dashboard compatibility routes (Vite React app expects these)
agentBridgeApi.get("/api/plugins", (c) => {
  return c.json({
    plugins: [
      { name: 'logger', hooks: ['feed_event', 'agent_spawn', 'shutdown'], hasInit: false, loaded: true },
      { name: 'stats', hooks: ['agent_message', 'agent_spawn', 'task_create'], hasInit: false, loaded: true },
    ],
    total: 2,
  });
});

agentBridgeApi.get("/api/ui-state", (c) => {
  return c.json({
    theme: 'dark', sidebarOpen: true, activeView: 'office',
    soundEnabled: true, compactMode: false, lastViewed: null, custom: {}, ts: Date.now(),
  });
});

agentBridgeApi.post("/api/ui-state", async (c) => {
  return c.json({ ok: true });
});

agentBridgeApi.get("/api/pin-info", (c) => {
  return c.json({ locked: false, pinned: [] });
});

agentBridgeApi.post("/api/pin-info", async (c) => {
  return c.json({ ok: true, pinned: [] });
});

agentBridgeApi.get("/api/tokens/rate", (c) => {
  return c.json({ totalTokens: 0, totalRequests: 0, ratePerHour: 0, window: 3600, remaining: Infinity });
});

agentBridgeApi.get("/api/maw-log", (c) => {
  const qs = new URL(c.req.url).search;
  return c.redirect(`/api/logs${qs}`, 307);
});

agentBridgeApi.post("/api/agents/:fromId/tell/:toId", async (c) => {
  const { fromId, toId } = c.req.param();
  const body = await c.req.json();
  const target = manager.getRunningAgents().find((a: any) => a.id === toId);
  if (!target) return c.json({ error: "Target agent not running" }, 404);
  const fromAgent: any = store.getAgent(fromId);
  try {
    (target as any).process.send({ type: 'incoming_message', from: fromId, fromName: fromAgent?.name || 'Unknown', content: body.message });
    return c.json({ ok: true, sent: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

agentBridgeApi.post("/api/agent-callback/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  switch (body.type) {
    case 'memory':
      if (body.data?.content) store.addMemory(id, body.data.content, body.data.category, body.data.importance, body.data.tags);
      break;
    case 'message':
      if (body.data?.content) store.sendMessage(id, body.data.content, body.data.to, body.data.threadId);
      break;
    case 'status':
      store.updateAgentStatus(id, body.data?.status || 'active');
      break;
    case 'thought': case 'response': case 'task':
      store.sendMessage(id, `[${body.type}] ${body.data?.content || JSON.stringify(body.data)}`, null, null, 'system');
      break;
  }
  return c.json({ ok: true });
});

// ─── V2 API routes ──────────────────────────────────────────────

// ─── List all agents ────────────────────────────────────────────
agentBridgeApi.get("/api/v2/agents", (c) => {
  const registered = store.listAgents();
  const running = manager.getRunningAgents();
  const runningIds = new Set(running.map((a: any) => a.id));

  const agents = registered.map((a: any) => ({
    ...a,
    running: runningIds.has(a.id),
  }));

  // Add running agents not in DB
  for (const r of running) {
    if (!agents.find((a: any) => a.id === r.id)) {
      agents.push({ ...r, running: true });
    }
  }

  return c.json({ agents, total: agents.length });
});

// ─── Spawn agent ────────────────────────────────────────────────
agentBridgeApi.post("/api/v2/agents/spawn", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = body.name;
  const role = body.role || "general";
  const personality = body.personality || "";

  if (!name) return c.json({ error: "name is required" }, 400);

  try {
    const result = await manager.spawnAgent(name, role, personality);
    wsBroadcast({ type: 'agent_spawned', agent: result });
    return c.json(result, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// ─── Get agent details ──────────────────────────────────────────
agentBridgeApi.get("/api/v2/agents/:id", (c) => {
  const id = c.req.param("id");
  const agent = store.getAgent(id);
  if (!agent) return c.json({ error: "agent not found" }, 404);

  const running = manager.getRunningAgents().find((a: any) => a.id === id);
  const recentMessages = store.getMessages(id as any, 10);

  return c.json({
    ...agent,
    running: !!running,
    recentMessages,
  });
});

// ─── Stop agent ─────────────────────────────────────────────────
agentBridgeApi.delete("/api/v2/agents/:id", (c) => {
  const id = c.req.param("id");
  try {
    manager.stopAgent(id);
    wsBroadcast({ type: 'agent_stopped', agentId: id });
    return c.json({ ok: true, stopped: id });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// ─── Chat with agent ────────────────────────────────────────────
agentBridgeApi.post("/api/v2/agents/:id/chat", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const message = body.message;

  if (!message) return c.json({ error: "กรุณาส่งข้อความ (message is required)" }, 400);

  try {
    const result = await manager.chatWithAgent(id, message);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message || "เกิดข้อผิดพลาด", hint: "เอเจนต์อาจหยุดทำงาน — ลองสร้างใหม่ด้วย /wake" }, 400);
  }
});

// ─── Agent-to-agent message ─────────────────────────────────────
agentBridgeApi.post("/api/v2/agents/:fromId/tell/:toId", async (c) => {
  const fromId = c.req.param("fromId");
  const toId = c.req.param("toId");
  const body = await c.req.json().catch(() => ({}));
  const message = body.message;

  if (!message) return c.json({ error: "message is required" }, 400);

  try {
    const result = manager.agentTellAgent(fromId, toId, message);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// ─── Broadcast ──────────────────────────────────────────────────
agentBridgeApi.post("/api/v2/agents/broadcast", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const message = body.message;
  if (!message) return c.json({ error: "message is required" }, 400);

  const running = manager.getRunningAgents();
  const results: any[] = [];

  for (const agent of running) {
    try {
      const resp = await manager.chatWithAgent(agent.id, message);
      results.push({ agent: agent.name, success: true, response: resp });
    } catch (err: any) {
      results.push({ agent: agent.name, success: false, error: err.message });
    }
  }

  return c.json({ broadcast: true, recipients: results.length, results });
});

// ─── Agent callback (workers post back here) ────────────────────
agentBridgeApi.post("/api/v2/agent-callback/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  switch (body.type) {
    case "memory":
      store.addMemory(id, body.data?.content, body.data?.category, body.data?.importance, body.data?.tags);
      break;
    case "message":
      store.sendMessage(id, body.data?.content, body.data?.to, body.data?.channel);
      break;
    case "status":
      store.updateAgentStatus(id, body.data?.status || "active");
      break;
  }

  return c.json({ ok: true });
});
