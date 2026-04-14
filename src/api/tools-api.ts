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
