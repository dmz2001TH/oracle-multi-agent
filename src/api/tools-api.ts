/**
 * Tools API — File operations and data query endpoints for agent tool use.
 *
 * Endpoints:
 *   POST /api/tools/read-file    — Read file contents
 *   POST /api/tools/write-file   — Write file contents
 *   GET  /api/tools/query/:source — Query goals/tasks/experiences/memories
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { homedir } from "os";

const WORKSPACE = process.env.ORACLE_WORKSPACE || join(homedir(), ".oracle");
const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit

export const toolsApi = new Hono();

// ─── File Read ────────────────────────────────────────────────
toolsApi.post("/api/tools/read-file", async (c) => {
  try {
    const { path: filePath, maxLines = 200 } = await c.req.json();

    if (!filePath) return c.json({ error: "path is required" }, 400);

    // Resolve path — allow relative to workspace or absolute
    const resolved = filePath.startsWith("/")
      ? filePath
      : join(WORKSPACE, filePath);

    // Security: prevent reading sensitive files
    const blocked = [".env", ".git/config", "id_rsa", "id_ed25519", ".pem"];
    if (blocked.some(b => resolved.includes(b))) {
      return c.json({ error: "Access to this file is restricted" }, 403);
    }

    if (!existsSync(resolved)) {
      return c.json({ error: `File not found: ${filePath}` }, 404);
    }

    const content = readFileSync(resolved, "utf-8");
    const lines = content.split("\n");
    const truncated = lines.length > maxLines;

    return c.json({
      path: filePath,
      lines: lines.slice(0, maxLines),
      totalLines: lines.length,
      truncated,
      size: content.length,
    });
  } catch (err: any) {
    return c.json({ error: `Read failed: ${err.message}` }, 500);
  }
});

// ─── File Write ───────────────────────────────────────────────
toolsApi.post("/api/tools/write-file", async (c) => {
  try {
    const { path: filePath, content } = await c.req.json();

    if (!filePath || content === undefined) {
      return c.json({ error: "path and content are required" }, 400);
    }

    // Resolve path — allow relative to workspace or absolute
    const resolved = filePath.startsWith("/")
      ? filePath
      : join(WORKSPACE, filePath);

    // Security: prevent overwriting sensitive files
    const blocked = [".env", ".git/config", "id_rsa", "id_ed25519", ".pem", "openclaw.json"];
    if (blocked.some(b => resolved.includes(b))) {
      return c.json({ error: "Cannot overwrite this file" }, 403);
    }

    // Size check
    if (content.length > MAX_FILE_SIZE) {
      return c.json({ error: `Content too large (${content.length} bytes, max ${MAX_FILE_SIZE})` }, 400);
    }

    // Create parent dirs
    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, content, "utf-8");

    return c.json({
      ok: true,
      path: filePath,
      bytesWritten: content.length,
    });
  } catch (err: any) {
    return c.json({ error: `Write failed: ${err.message}` }, 500);
  }
});

// ─── Data Query ───────────────────────────────────────────────
toolsApi.get("/api/tools/query/:source", (c) => {
  try {
    const source = c.req.param("source");
    const filter = c.req.query("filter") || "";
    const limit = parseInt(c.req.query("limit") || "20");

    let results: any[] = [];
    const filterParts = filter ? Object.fromEntries(
      filter.split(",").map(f => {
        const [k, v] = f.split("=");
        return [k?.trim(), v?.trim()];
      }).filter(([k, v]) => k && v)
    ) : {};

    switch (source) {
      case "goals": {
        const goalsDir = join(homedir(), ".oracle", "goals");
        const goalsFile = join(goalsDir, "goals.jsonl");
        if (!existsSync(goalsFile)) break;
        const lines = readFileSync(goalsFile, "utf-8").split("\n").filter(Boolean);
        results = lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
          .filter(Boolean);
        if (filterParts.status) results = results.filter((g: any) => g.status === filterParts.status);
        break;
      }
      case "tasks": {
        const tasksFile = join(homedir(), ".oracle", "goals", "tasks.jsonl");
        if (!existsSync(tasksFile)) break;
        const lines = readFileSync(tasksFile, "utf-8").split("\n").filter(Boolean);
        results = lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
          .filter(Boolean);
        if (filterParts.status) results = results.filter((t: any) => t.status === filterParts.status);
        if (filterParts.goalId) results = results.filter((t: any) => t.goalId === filterParts.goalId);
        break;
      }
      case "experiences": {
        const expFile = join(homedir(), ".oracle", "experience", "experiences.jsonl");
        if (!existsSync(expFile)) break;
        const lines = readFileSync(expFile, "utf-8").split("\n").filter(Boolean);
        results = lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
          .filter(Boolean);
        if (filterParts.outcome) results = results.filter((e: any) => e.outcome === filterParts.outcome);
        break;
      }
      case "memories": {
        const memFile = join(homedir(), ".oracle", "plans", "cycles.jsonl");
        // Query memories via the API instead
        return c.json({ source, note: "Use /api/memory/search for memory queries", results: [], count: 0 });
      }
      case "agents": {
        return c.json({ source, note: "Use /api/agents for agent queries", results: [], count: 0 });
      }
      default:
        return c.json({ error: `Unknown source: ${source}. Use: goals, tasks, experiences, memories, agents` }, 400);
    }

    return c.json({
      source,
      filter: filter || null,
      results: results.slice(0, limit),
      count: results.length,
      limited: results.length > limit,
    });
  } catch (err: any) {
    return c.json({ error: `Query failed: ${err.message}` }, 500);
  }
});
