/**
 * Cron API — Chapter 9: The Cron Loop
 *
 * File-backed cron job registry. Each job has:
 *   - config.json: job definition
 *   - backlog.md: state carrier between firings
 *
 * Endpoints:
 *   POST   /api/cron        — create job
 *   GET    /api/cron         — list jobs
 *   GET    /api/cron/:id     — get job
 *   DELETE /api/cron/:id     — remove job
 *   POST   /api/cron/:id/run — trigger immediately
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { CronJob } from "../lib/schemas.js";

export const cronApi = new Hono();

const CRON_DIR = join(homedir(), ".oracle", "cron");

function ensureDir() { mkdirSync(CRON_DIR, { recursive: true }); }

function jobDir(id: string): string { return join(CRON_DIR, id); }
function configPath(id: string): string { return join(jobDir(id), "config.json"); }
function backlogPath(id: string): string { return join(jobDir(id), "backlog.md"); }

function nextId(): string {
  ensureDir();
  const dirs = readdirSync(CRON_DIR).filter(d => {
    try { return existsSync(join(CRON_DIR, d, "config.json")); } catch { return false; }
  });
  const maxNum = dirs.reduce((max, d) => {
    const n = parseInt(d, 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return String(maxNum + 1);
}

function loadJob(id: string): CronJob | null {
  try { return JSON.parse(readFileSync(configPath(id), "utf-8")); } catch { return null; }
}

function saveJob(job: CronJob): void {
  const dir = jobDir(job.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath(job.id), JSON.stringify(job, null, 2));
}

// Create job
cronApi.post("/api/cron", async (c) => {
  const input = await c.req.json();
  if (!input.schedule || !input.prompt) {
    return c.json({ error: "schedule and prompt are required" }, 400);
  }

  const id = nextId();
  const name = input.name || `cron-${id}`;

  const job: CronJob = {
    id,
    name,
    schedule: input.schedule,
    prompt: input.prompt,
    enabled: true,
    firings: 0,
  };

  saveJob(job);

  // Initialize backlog
  const backlog = input.backlog || "# Backlog\n\n";
  writeFileSync(backlogPath(id), backlog);

  return c.json(job, 201);
});

// List jobs
cronApi.get("/api/cron", (c) => {
  ensureDir();
  if (!existsSync(CRON_DIR)) return c.json({ jobs: [] });

  const dirs = readdirSync(CRON_DIR);
  const jobs: CronJob[] = [];
  for (const d of dirs) {
    const job = loadJob(d);
    if (job) jobs.push(job);
  }

  return c.json({ jobs, total: jobs.length });
});

// Get single job
cronApi.get("/api/cron/:id", (c) => {
  const job = loadJob(c.req.param("id"));
  if (!job) return c.json({ error: "job not found" }, 404);

  const bp = backlogPath(c.req.param("id"));
  let backlog = "";
  try { backlog = readFileSync(bp, "utf-8"); } catch {}

  return c.json({ ...job, backlog });
});

// Delete job
cronApi.delete("/api/cron/:id", (c) => {
  const id = c.req.param("id");
  const dir = jobDir(id);
  if (!existsSync(configPath(id))) return c.json({ error: "job not found" }, 404);

  // Remove config + backlog
  try { unlinkSync(configPath(id)); } catch {}
  try { unlinkSync(backlogPath(id)); } catch {}
  try { require("fs").rmdirSync(dir); } catch {}

  return c.json({ ok: true });
});

// Trigger immediately
cronApi.post("/api/cron/:id/run", (c) => {
  const job = loadJob(c.req.param("id"));
  if (!job) return c.json({ error: "job not found" }, 404);

  job.firings += 1;
  job.lastRun = new Date().toISOString();
  saveJob(job);

  return c.json({ ok: true, firing: job.firings, job });
});

// Get backlog
cronApi.get("/api/cron/:id/backlog", (c) => {
  const id = c.req.param("id");
  if (!loadJob(id)) return c.json({ error: "job not found" }, 404);

  const bp = backlogPath(id);
  let backlog = "";
  try { backlog = readFileSync(bp, "utf-8"); } catch {}

  return c.json({ id, backlog });
});

// Update backlog
cronApi.put("/api/cron/:id/backlog", async (c) => {
  const id = c.req.param("id");
  if (!loadJob(id)) return c.json({ error: "job not found" }, 404);

  const { backlog } = await c.req.json();
  writeFileSync(backlogPath(id), backlog ?? "");

  return c.json({ ok: true });
});
