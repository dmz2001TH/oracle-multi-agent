/**
 * Memory Bridge API — Exposes MemoryStore methods via HTTP
 *
 * Endpoints:
 *   GET    /api/v2/memory/search?q=     — search memories (FTS5)
 *   GET    /api/v2/memory/all           — list all memories
 *   POST   /api/v2/memory               — add memory
 *   POST   /api/v2/memory/:id/supersede — supersede a memory
 *   GET    /api/v2/memory/stats         — knowledge base stats
 *   GET    /api/v2/memory/recap         — session recap
 *   GET    /api/v2/memory/rrr           — RRR retrospective
 *   GET    /api/v2/memory/standup       — daily standup
 *   GET    /api/v2/messages             — get messages
 *   POST   /api/v2/messages             — send message
 *   GET    /api/v2/messages/unread      — unread messages
 *   GET    /api/v2/threads              — list threads
 *   POST   /api/v2/threads              — create thread
 *   GET    /api/v2/threads/:id          — get thread messages
 */

import { Hono } from "hono";
import { join } from "path";
import { homedir } from "os";
import { store } from "./agent-bridge.js";

export const memoryBridgeApi = new Hono();

// ─── Search memories ────────────────────────────────────────────
memoryBridgeApi.get("/api/v2/memory/search", (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "q parameter required" }, 400);

  const limit = Number(c.req.query("limit") || 10);
  const agentId = c.req.query("agent") || undefined;
  const category = c.req.query("category") || undefined;

  try {
    const results = store.searchMemories(q, { limit, agentId, category } as any);
    return c.json({ results, total: results.length, query: q });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── List all memories ──────────────────────────────────────────
memoryBridgeApi.get("/api/v2/memory/all", (c) => {
  const limit = Number(c.req.query("limit") || 50);
  const offset = Number(c.req.query("offset") || 0);

  try {
    const results = store.getAllMemories(limit);
    return c.json({ memories: results, total: results.length, limit, offset });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Add memory ─────────────────────────────────────────────────
memoryBridgeApi.post("/api/v2/memory", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { content, agentId, category, importance, tags } = body;

  if (!content) return c.json({ error: "content is required" }, 400);

  try {
    const id = store.addMemory(
      agentId || "system",
      content,
      category || "general",
      importance || 1,
      tags || ""
    );
    return c.json({ ok: true, id }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Supersede memory ───────────────────────────────────────────
memoryBridgeApi.post("/api/v2/memory/:id/supersede", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  try {
    store.supersedeMemory(id, body.reason || "outdated");
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Knowledge base stats ───────────────────────────────────────
memoryBridgeApi.get("/api/v2/memory/stats", (c) => {
  try {
    const stats = store.getStats();
    return c.json(stats);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Session recap ──────────────────────────────────────────────
memoryBridgeApi.get("/api/v2/memory/recap", (c) => {
  try {
    const recap = store.generateSessionSummary();
    return c.json({ recap });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── RRR retrospective ──────────────────────────────────────────
memoryBridgeApi.get("/api/v2/memory/rrr", (c) => {
  try {
    const rrr = store.generateRRR();
    return c.json({ rrr });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Daily standup ──────────────────────────────────────────────
memoryBridgeApi.get("/api/v2/memory/standup", (c) => {
  try {
    const standup = store.generateStandup();
    return c.json({ standup });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Get messages ───────────────────────────────────────────────
memoryBridgeApi.get("/api/v2/messages", (c) => {
  const agentId = c.req.query("agent") || null;
  const limit = Number(c.req.query("limit") || 20);

  try {
    const messages = store.getMessages(agentId as any, limit);
    return c.json({ messages, total: messages.length });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Send message ───────────────────────────────────────────────
memoryBridgeApi.post("/api/v2/messages", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { from, content, to, channel } = body;

  if (!content) return c.json({ error: "content is required" }, 400);

  try {
    store.sendMessage(from || "system", content, to || null, channel || "general", "human");
    return c.json({ ok: true }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Unread messages ────────────────────────────────────────────
memoryBridgeApi.get("/api/v2/messages/unread", (c) => {
  try {
    const messages = store.getUnreadMessages();
    return c.json({ messages, total: messages.length });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Mark messages read ─────────────────────────────────────────
memoryBridgeApi.post("/api/v2/messages/read", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { agentId } = body;

  try {
    store.markRead(agentId);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── List threads ───────────────────────────────────────────────
memoryBridgeApi.get("/api/v2/threads", (c) => {
  try {
    const threads = store.listThreads();
    return c.json({ threads, total: threads.length });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Create thread ──────────────────────────────────────────────
memoryBridgeApi.post("/api/v2/threads", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { title, createdBy } = body;

  if (!title) return c.json({ error: "title is required" }, 400);

  try {
    const id = store.createThread(title, createdBy || "human");
    return c.json({ ok: true, id }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Get thread messages ────────────────────────────────────────
memoryBridgeApi.get("/api/v2/threads/:id", (c) => {
  const id = c.req.param("id");
  try {
    const thread = store.getThread(id);
    if (!thread) return c.json({ error: "thread not found" }, 404);
    return c.json(thread);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Activity timeline ──────────────────────────────────────────
memoryBridgeApi.get("/api/v2/activity", (c) => {
  const hours = Number(c.req.query("hours") || 24);
  try {
    const timeline = store.getActivityTimeline(hours);
    return c.json({ timeline, total: timeline.length, hours });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Search stats ───────────────────────────────────────────────
memoryBridgeApi.get("/api/v2/memory/search-stats", (c) => {
  try {
    const stats = store.getSearchStats();
    return c.json(stats);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
