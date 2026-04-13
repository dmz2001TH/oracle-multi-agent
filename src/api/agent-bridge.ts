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

// Initialize store and manager (singleton)
const DB_PATH = process.env.ORACLE_DB_PATH || join(homedir(), ".config", "oracle", "oracle.db");
const store = new MemoryStore(DB_PATH);
const manager = new AgentManager(store, {
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  mimoApiKey: process.env.MIMO_API_KEY || "",
  provider: process.env.LLM_PROVIDER || "gemini",
  agentModel: process.env.AGENT_MODEL || "gemini-2.0-flash",
  port: Number(process.env.HUB_PORT || 3456),
  maxAgents: Number(process.env.MAX_CONCURRENT_AGENTS || 5),
});

export { store, manager };
export const agentBridgeApi = new Hono();

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

  if (!message) return c.json({ error: "message is required" }, 400);

  try {
    const result = await manager.chatWithAgent(id, message);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
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
