/**
 * Task Log API — Chapter 4: Task Tracking
 *
 * Endpoints:
 *   POST   /api/tasks/:id/logs         — add log entry
 *   GET    /api/tasks/:id/logs         — list logs for task
 *   GET    /api/tasks/logs/all         — all logs across tasks
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { TaskLogEntry } from "../lib/schemas.js";

export const taskLogsApi = new Hono();

const LOGS_DIR = join(homedir(), ".oracle", "task-logs");

function ensureDir() { mkdirSync(LOGS_DIR, { recursive: true }); }

function taskLogDir(taskId: string): string { return join(LOGS_DIR, taskId); }

function nextId(taskId: string): string {
  const dir = taskLogDir(taskId);
  if (!existsSync(dir)) return "1";
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  const maxNum = files.reduce((max, f) => {
    const n = parseInt(f.replace(".json", ""), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return String(maxNum + 1);
}

// Add log entry to a task
taskLogsApi.post("/api/tasks/:id/logs", async (c) => {
  const taskId = c.req.param("id");
  const input = await c.req.json();

  if (!input.message) {
    return c.json({ error: "message is required" }, 400);
  }

  const dir = taskLogDir(taskId);
  mkdirSync(dir, { recursive: true });

  const entry: TaskLogEntry = {
    id: nextId(taskId),
    taskId,
    type: input.type || "log",
    message: input.message,
    author: input.author,
    ts: new Date().toISOString(),
  };

  writeFileSync(join(dir, `${entry.id}.json`), JSON.stringify(entry, null, 2));

  return c.json(entry, 201);
});

// List logs for a specific task
taskLogsApi.get("/api/tasks/:id/logs", (c) => {
  const taskId = c.req.param("id");
  const dir = taskLogDir(taskId);

  if (!existsSync(dir)) {
    return c.json({ logs: [], total: 0 });
  }

  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  const logs: TaskLogEntry[] = files
    .map(f => {
      try { return JSON.parse(readFileSync(join(dir, f), "utf-8")); } catch { return null; }
    })
    .filter(Boolean) as TaskLogEntry[];

  logs.sort((a, b) => a.ts.localeCompare(b.ts));

  return c.json({ logs, total: logs.length });
});

// List all logs across all tasks
taskLogsApi.get("/api/tasks/logs/all", (c) => {
  ensureDir();
  if (!existsSync(LOGS_DIR)) {
    return c.json({ logs: [], total: 0 });
  }

  const allLogs: TaskLogEntry[] = [];
  const taskDirs = readdirSync(LOGS_DIR);

  for (const td of taskDirs) {
    const dir = join(LOGS_DIR, td);
    try {
      const files = readdirSync(dir).filter(f => f.endsWith(".json"));
      for (const f of files) {
        try {
          allLogs.push(JSON.parse(readFileSync(join(dir, f), "utf-8")));
        } catch {}
      }
    } catch {}
  }

  allLogs.sort((a, b) => b.ts.localeCompare(a.ts));

  const limit = Math.min(100, +(c.req.query("limit") || "50"));
  return c.json({ logs: allLogs.slice(0, limit), total: allLogs.length });
});
