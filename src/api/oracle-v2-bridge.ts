/**
 * Oracle-v2 Bridge API — Proxies requests to oracle-v2 MCP server on port 47778
 *
 * When oracle-v2 is running (bun src/server.ts), these routes forward requests
 * and integrate oracle-v2 tools into our oracle-multi-agent system.
 *
 * Endpoints:
 *   GET  /api/oracle-v2/status      — Check if oracle-v2 is running
 *   GET  /api/oracle-v2/search      — Search oracle-v2 knowledge base
 *   POST /api/oracle-v2/learn       — Add to oracle-v2 knowledge base
 *   GET  /api/oracle-v2/stats       — oracle-v2 database statistics
 *   GET  /api/oracle-v2/list        — Browse oracle-v2 documents
 *   GET  /api/oracle-v2/reflect     — Random principle/learning
 *   POST /api/oracle-v2/forum       — Create forum thread
 *   GET  /api/oracle-v2/forum       — List forum threads
 *   POST /api/oracle-v2/trace       — Log a trace
 *   GET  /api/oracle-v2/trace       — List traces
 *   POST /api/oracle-v2/inbox       — Manage inbox
 *   GET  /api/oracle-v2/inbox       — Check inbox
 *   POST /api/oracle-v2/handoff     — Create handoff
 *   GET  /api/oracle-v2/concepts    — Browse concepts
 *   GET  /api/oracle-v2/schedule    — Get schedule
 *   POST /api/oracle-v2/schedule    — Create scheduled task
 */

import { Hono } from "hono";

export const oracleV2Api = new Hono();

const ORACLE_V2_PORT = process.env.ORACLE_V2_PORT || 47778;
const ORACLE_V2_URL = `http://localhost:${ORACLE_V2_PORT}`;

// Helper: forward request to oracle-v2
async function forward(method: string, path: string, body?: any): Promise<Response> {
  const url = `${ORACLE_V2_URL}${path}`;
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10000),
  };
  if (body && method !== "GET") {
    opts.body = JSON.stringify(body);
  }
  return fetch(url, opts);
}

// Helper: proxy response
async function proxy(c: any, method: string, path: string, body?: any) {
  try {
    const res = await forward(method, path, body);
    const data = await res.json().catch(() => ({}));
    return c.json(data, res.status);
  } catch (e: any) {
    if (e.name === "AbortError" || e.code === "ECONNREFUSED") {
      return c.json({ error: "oracle-v2 not running on port " + ORACLE_V2_PORT, hint: "Run: cd _ref/oracle-v2 && bun src/server.ts" }, 503);
    }
    return c.json({ error: e.message }, 502);
  }
}

// GET /api/oracle-v2/status — health check
oracleV2Api.get("/api/oracle-v2/status", async (c) => {
  try {
    const res = await forward("GET", "/health");
    const data = await res.json().catch(() => ({}));
    return c.json({ ok: true, oracleV2: data, port: ORACLE_V2_PORT });
  } catch (e: any) {
    return c.json({ ok: false, error: "oracle-v2 not running", port: ORACLE_V2_PORT, hint: "cd _ref/oracle-v2 && bun src/server.ts" });
  }
});

// GET /api/oracle-v2/search?q=...&limit=...
oracleV2Api.get("/api/oracle-v2/search", async (c) => {
  const qs = new URL(c.req.url).search;
  return proxy(c, "GET", `/api/search${qs}`);
});

// POST /api/oracle-v2/learn — add knowledge
oracleV2Api.post("/api/oracle-v2/learn", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return proxy(c, "POST", "/api/knowledge", body);
});

// GET /api/oracle-v2/stats
oracleV2Api.get("/api/oracle-v2/stats", async (c) => {
  return proxy(c, "GET", "/api/stats");
});

// GET /api/oracle-v2/list
oracleV2Api.get("/api/oracle-v2/list", async (c) => {
  const qs = new URL(c.req.url).search;
  return proxy(c, "GET", `/api/knowledge${qs}`);
});

// GET /api/oracle-v2/reflect
oracleV2Api.get("/api/oracle-v2/reflect", async (c) => {
  return proxy(c, "GET", "/api/knowledge/reflect");
});

// POST /api/oracle-v2/forum — create thread
oracleV2Api.post("/api/oracle-v2/forum", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return proxy(c, "POST", "/api/forum", body);
});

// GET /api/oracle-v2/forum — list threads
oracleV2Api.get("/api/oracle-v2/forum", async (c) => {
  const qs = new URL(c.req.url).search;
  return proxy(c, "GET", `/api/forum${qs}`);
});

// GET /api/oracle-v2/forum/:id — read thread
oracleV2Api.get("/api/oracle-v2/forum/:id", async (c) => {
  const id = c.req.param("id");
  return proxy(c, "GET", `/api/forum/${id}`);
});

// POST /api/oracle-v2/trace — log trace
oracleV2Api.post("/api/oracle-v2/trace", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return proxy(c, "POST", "/api/traces", body);
});

// GET /api/oracle-v2/trace — list traces
oracleV2Api.get("/api/oracle-v2/trace", async (c) => {
  const qs = new URL(c.req.url).search;
  return proxy(c, "GET", `/api/traces${qs}`);
});

// GET /api/oracle-v2/trace/:id — get trace
oracleV2Api.get("/api/oracle-v2/trace/:id", async (c) => {
  const id = c.req.param("id");
  return proxy(c, "GET", `/api/traces/${id}`);
});

// POST /api/oracle-v2/inbox
oracleV2Api.post("/api/oracle-v2/inbox", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return proxy(c, "POST", "/api/inbox", body);
});

// GET /api/oracle-v2/inbox
oracleV2Api.get("/api/oracle-v2/inbox", async (c) => {
  const qs = new URL(c.req.url).search;
  return proxy(c, "GET", `/api/inbox${qs}`);
});

// POST /api/oracle-v2/handoff
oracleV2Api.post("/api/oracle-v2/handoff", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return proxy(c, "POST", "/api/handoff", body);
});

// GET /api/oracle-v2/concepts
oracleV2Api.get("/api/oracle-v2/concepts", async (c) => {
  const qs = new URL(c.req.url).search;
  return proxy(c, "GET", `/api/concepts${qs}`);
});

// GET /api/oracle-v2/schedule
oracleV2Api.get("/api/oracle-v2/schedule", async (c) => {
  return proxy(c, "GET", "/api/schedule");
});

// POST /api/oracle-v2/schedule
oracleV2Api.post("/api/oracle-v2/schedule", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return proxy(c, "POST", "/api/schedule", body);
});

// Dashboard proxy — serve oracle-v2 dashboard
oracleV2Api.get("/api/oracle-v2/dashboard", async (c) => {
  try {
    const res = await forward("GET", "/dashboard");
    const html = await res.text();
    return c.html(html);
  } catch {
    return c.text("oracle-v2 dashboard not available (port " + ORACLE_V2_PORT + ")", 503);
  }
});
