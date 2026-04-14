/**
 * Tools API — File operations, data query, and tool registry for agent tool use.
 *
 * 8. Endpoints:
 *   GET  /api/tools              — List all available tools
 *   GET  /api/tools/:name        — Get tool definition by name
 *   POST /api/tools/read-file    — Read file contents
 *   POST /api/tools/write-file   — Write file contents
 *   GET  /api/tools/query/:source — Query goals/tasks/experiences
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

const WORKSPACE = process.env.ORACLE_WORKSPACE || join(homedir(), ".oracle");
const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit

export const toolsApi = new Hono();

// ═══════════════════════════════════════════════════════════
// 8. Tool Registry
// ═══════════════════════════════════════════════════════════

const TOOL_REGISTRY = [
  {
    name: "remember",
    description: "Store a piece of information in long-term memory",
    params: { content: "string", category: "string?", importance: "int?", tags: "string?" },
  },
  {
    name: "search_memory",
    description: "Search through stored memories",
    params: { query: "string", limit: "int?" },
  },
  {
    name: "tell",
    description: "Send a message to another agent",
    params: { agent_name: "string", message: "string" },
  },
  {
    name: "list_agents",
    description: "See all agents in the system",
    params: {},
  },
  {
    name: "get_messages",
    description: "Check for messages from other agents",
    params: { channel: "string?", limit: "int?" },
  },
  {
    name: "create_task",
    description: "Create a task for yourself or another agent",
    params: { title: "string", description: "string?", assigned_to: "string?", priority: "int?" },
  },
  {
    name: "spawn_agent",
    description: "Spawn a new teammate agent (specialist or helper)",
    params: { name: "string", role: "string", task: "string?" },
  },
  {
    name: "read_file",
    description: "Read the contents of a file from disk",
    params: { path: "string", max_lines: "int?" },
  },
  {
    name: "write_file",
    description: "Write content to a file on disk",
    params: { path: "string", content: "string" },
  },
  {
    name: "call_api",
    description: "Make an HTTP request to an external or internal API",
    params: { url: "string", method: "string?", headers: "object?", body: "string?" },
  },
  {
    name: "query_data",
    description: "Query stored data (goals, tasks, experiences) with filters",
    params: { source: "string", filter: "string?", limit: "int?" },
  },
];

// ═══════════════════════════════════════════════════════════
// Unified Tool Dispatch (for orchestrator tool chaining)
// POST /api/tools/:name — dispatch tool call by name
// ═══════════════════════════════════════════════════════════

toolsApi.post("/api/tools/:name", async (c) => {
  const toolName = c.req.param("name");
  let args: any = {};
  try { args = await c.req.json(); } catch {}

  switch (toolName) {
    case "read_file":
    case "read-file": {
      const path = args.path;
      if (!path) return c.json({ error: "path is required" }, 400);
      const resolved = path.startsWith("/") ? path : join(WORKSPACE, path);
      if (BLOCKED_FILES.some(b => resolved.includes(b))) return c.json({ error: "Access restricted" }, 403);
      if (!existsSync(resolved)) return c.json({ error: `File not found: ${path}` }, 404);
      const content = readFileSync(resolved, "utf-8");
      const lines = content.split("\n");
      const maxLines = args.max_lines || args.maxLines || 200;
      return c.json({ path, lines: lines.slice(0, maxLines), totalLines: lines.length, truncated: lines.length > maxLines });
    }

    case "write_file":
    case "write-file": {
      const path = args.path;
      const content = args.content;
      if (!path || content === undefined) return c.json({ error: "path and content are required" }, 400);
      const resolved = path.startsWith("/") ? path : join(WORKSPACE, path);
      if (BLOCKED_FILES.some(b => resolved.includes(b))) return c.json({ error: "Cannot overwrite this file" }, 403);
      if (content.length > MAX_FILE_SIZE) return c.json({ error: "Content too large" }, 400);
      mkdirSync(dirname(resolved), { recursive: true });
      writeFileSync(resolved, content, "utf-8");
      return c.json({ ok: true, path, bytesWritten: content.length });
    }

    case "call_api": {
      try {
        const url = args.url;
        if (!url) return c.json({ error: "url is required" }, 400);
        const method = args.method || "GET";
        const headers = { "Content-Type": "application/json", ...(args.headers || {}) };
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const fetchOpts: any = { method, headers, signal: controller.signal };
        if (["POST", "PUT", "PATCH"].includes(method) && args.body) fetchOpts.body = args.body;
        const res = await fetch(url, fetchOpts);
        clearTimeout(timeout);
        const text = await res.text();
        let body: any;
        try { body = JSON.parse(text); } catch { body = text; }
        return c.json({ status: res.status, ok: res.ok, body });
      } catch (err: any) {
        return c.json({ error: `API call failed: ${err.message}` }, 500);
      }
    }

    case "query_data": {
      const source = args.source;
      if (!source) return c.json({ error: "source is required" }, 400);
      const filter = args.filter || "";
      const limit = args.limit || 20;
      const filterParts = filter
        ? Object.fromEntries(filter.split(",").map((f: string) => { const [k, v] = f.split("="); return [k?.trim(), v?.trim()]; }).filter(([k, v]: any) => k && v))
        : {};
      let results: any[] = [];
      switch (source) {
        case "goals": {
          const f = join(homedir(), ".oracle", "goals", "goals.jsonl");
          if (existsSync(f)) { results = readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l: string) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); if (filterParts.status) results = results.filter((g: any) => g.status === filterParts.status); }
          break;
        }
        case "tasks": {
          const f = join(homedir(), ".oracle", "goals", "tasks.jsonl");
          if (existsSync(f)) { results = readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l: string) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); if (filterParts.status) results = results.filter((t: any) => t.status === filterParts.status); }
          break;
        }
        case "experiences": {
          const f = join(homedir(), ".oracle", "experience", "experiences.jsonl");
          if (existsSync(f)) { results = readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l: string) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); }
          break;
        }
        default: return c.json({ error: `Unknown source: ${source}` }, 400);
      }
      return c.json({ source, results: results.slice(0, limit), count: results.length });
    }

    case "remember": {
      // Store to a local memories file
      try {
        const memFile = join(homedir(), ".oracle", "memories.jsonl");
        mkdirSync(dirname(memFile), { recursive: true });
        const entry = JSON.stringify({ content: args.content, category: args.category || "general", importance: args.importance || 1, timestamp: new Date().toISOString() });
        const { appendFileSync } = await import("fs");
        appendFileSync(memFile, entry + "\n");
        return c.json({ ok: true, message: `Remembered: "${String(args.content).slice(0, 50)}..."` });
      } catch (err: any) {
        return c.json({ error: `Remember failed: ${err.message}` }, 500);
      }
    }

    default:
      return c.json({ error: `Unknown tool: ${toolName}. Available: read_file, write_file, call_api, query_data, remember` }, 404);
  }
});

// GET /api/tools — list all tools
toolsApi.get("/api/tools", (c) => {
  return c.json({
    ok: true,
    tools: TOOL_REGISTRY,
    total: TOOL_REGISTRY.length,
  });
});

// GET /api/tools/:name — get specific tool definition
toolsApi.get("/api/tools/:name", (c) => {
  const name = c.req.param("name");
  const tool = TOOL_REGISTRY.find(t => t.name === name);
  if (!tool) {
    return c.json({ ok: false, error: `Tool "${name}" not found. Available: ${TOOL_REGISTRY.map(t => t.name).join(", ")}` }, 404);
  }
  return c.json({ ok: true, tool });
});

// ═══════════════════════════════════════════════════════════
// File Operations
// ═══════════════════════════════════════════════════════════

const BLOCKED_FILES = [".env", ".git/config", "id_rsa", "id_ed25519", ".pem", "openclaw.json", "credentials"];

// POST /api/tools/read-file
toolsApi.post("/api/tools/read-file", async (c) => {
  try {
    const { path: filePath, maxLines = 200 } = await c.req.json();
    if (!filePath) return c.json({ error: "path is required" }, 400);

    const resolved = filePath.startsWith("/") ? filePath : join(WORKSPACE, filePath);
    if (BLOCKED_FILES.some(b => resolved.includes(b))) {
      return c.json({ error: "Access to this file is restricted" }, 403);
    }
    if (!existsSync(resolved)) {
      return c.json({ error: `File not found: ${filePath}` }, 404);
    }

    const content = readFileSync(resolved, "utf-8");
    const lines = content.split("\n");
    return c.json({
      path: filePath,
      lines: lines.slice(0, maxLines),
      totalLines: lines.length,
      truncated: lines.length > maxLines,
      size: content.length,
    });
  } catch (err: any) {
    return c.json({ error: `Read failed: ${err.message}` }, 500);
  }
});

// POST /api/tools/write-file
toolsApi.post("/api/tools/write-file", async (c) => {
  try {
    const { path: filePath, content } = await c.req.json();
    if (!filePath || content === undefined) {
      return c.json({ error: "path and content are required" }, 400);
    }

    const resolved = filePath.startsWith("/") ? filePath : join(WORKSPACE, filePath);
    if (BLOCKED_FILES.some(b => resolved.includes(b))) {
      return c.json({ error: "Cannot overwrite this file" }, 403);
    }
    if (content.length > MAX_FILE_SIZE) {
      return c.json({ error: `Content too large (${content.length} bytes, max ${MAX_FILE_SIZE})` }, 400);
    }

    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, content, "utf-8");

    return c.json({ ok: true, path: filePath, bytesWritten: content.length });
  } catch (err: any) {
    return c.json({ error: `Write failed: ${err.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// Data Query
// ═══════════════════════════════════════════════════════════

toolsApi.get("/api/tools/query/:source", (c) => {
  try {
    const source = c.req.param("source");
    const filter = c.req.query("filter") || "";
    const limit = parseInt(c.req.query("limit") || "20");

    const filterParts = filter
      ? Object.fromEntries(
          filter.split(",").map(f => {
            const [k, v] = f.split("=");
            return [k?.trim(), v?.trim()];
          }).filter(([k, v]) => k && v)
        )
      : {};

    let results: any[] = [];

    switch (source) {
      case "goals": {
        const f = join(homedir(), ".oracle", "goals", "goals.jsonl");
        if (!existsSync(f)) break;
        results = readFileSync(f, "utf-8").split("\n").filter(Boolean)
          .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        if (filterParts.status) results = results.filter((g: any) => g.status === filterParts.status);
        break;
      }
      case "tasks": {
        const f = join(homedir(), ".oracle", "goals", "tasks.jsonl");
        if (!existsSync(f)) break;
        results = readFileSync(f, "utf-8").split("\n").filter(Boolean)
          .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        if (filterParts.status) results = results.filter((t: any) => t.status === filterParts.status);
        if (filterParts.goalId) results = results.filter((t: any) => t.goalId === filterParts.goalId);
        break;
      }
      case "experiences": {
        const f = join(homedir(), ".oracle", "experience", "experiences.jsonl");
        if (!existsSync(f)) break;
        results = readFileSync(f, "utf-8").split("\n").filter(Boolean)
          .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        if (filterParts.outcome) results = results.filter((e: any) => e.outcome === filterParts.outcome);
        break;
      }
      case "memories":
        return c.json({ source, note: "Use /api/memory/search for memory queries", results: [], count: 0 });
      case "agents":
        return c.json({ source, note: "Use /api/agents for agent queries", results: [], count: 0 });
      default:
        return c.json({ error: `Unknown source: ${source}. Use: goals, tasks, experiences, memories, agents` }, 400);
    }

    return c.json({
      source, filter: filter || null,
      results: results.slice(0, limit),
      count: results.length,
      limited: results.length > limit,
    });
  } catch (err: any) {
    return c.json({ error: `Query failed: ${err.message}` }, 500);
  }
});
