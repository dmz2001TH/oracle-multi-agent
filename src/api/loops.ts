/**
 * Loop Management API — Chapter 5: Loops
 *
 * Extends cron with enable/disable/history management.
 *
 * Endpoints:
 *   PATCH  /api/cron/:id/enable       — enable a loop
 *   PATCH  /api/cron/:id/disable      — disable a loop
 *   GET    /api/cron/:id/history       — firing history
 *   POST   /api/cron/:id/history      — record a firing
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { CronJob } from "../lib/schemas.js";

export const loopsApi = new Hono();

const CRON_DIR = join(homedir(), ".oracle", "cron");

function jobDir(id: string): string { return join(CRON_DIR, id); }
function configPath(id: string): string { return join(jobDir(id), "config.json"); }
function historyDir(id: string): string { return join(jobDir(id), "history"); }

function loadJob(id: string): CronJob | null {
  try { return JSON.parse(readFileSync(configPath(id), "utf-8")); } catch { return null; }
}

function saveJob(job: CronJob): void {
  writeFileSync(configPath(job.id), JSON.stringify(job, null, 2));
}

// Enable loop
loopsApi.patch("/api/cron/:id/enable", (c) => {
  const job = loadJob(c.req.param("id"));
  if (!job) return c.json({ error: "job not found" }, 404);

  job.enabled = true;
  saveJob(job);
  return c.json({ ok: true, job });
});

// Disable loop
loopsApi.patch("/api/cron/:id/disable", (c) => {
  const job = loadJob(c.req.param("id"));
  if (!job) return c.json({ error: "job not found" }, 404);

  job.enabled = false;
  saveJob(job);
  return c.json({ ok: true, job });
});

// Get firing history
loopsApi.get("/api/cron/:id/history", (c) => {
  const id = c.req.param("id");
  if (!loadJob(id)) return c.json({ error: "job not found" }, 404);

  const dir = historyDir(id);
  if (!existsSync(dir)) {
    return c.json({ history: [], total: 0 });
  }

  const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort();
  const history = files.map(f => {
    try { return JSON.parse(readFileSync(join(dir, f), "utf-8")); } catch { return null; }
  }).filter(Boolean);

  return c.json({ history, total: history.length });
});

// Record a firing event
loopsApi.post("/api/cron/:id/history", async (c) => {
  const id = c.req.param("id");
  if (!loadJob(id)) return c.json({ error: "job not found" }, 404);

  const input = await c.req.json();
  const dir = historyDir(id);
  mkdirSync(dir, { recursive: true });

  const entry = {
    id: Date.now().toString(),
    firedAt: new Date().toISOString(),
    success: input.success ?? true,
    message: input.message || "",
    duration: input.duration,
  };

  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  writeFileSync(join(dir, `${files.length + 1}.json`), JSON.stringify(entry, null, 2));

  return c.json(entry, 201);
});
