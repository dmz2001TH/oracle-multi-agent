/**
 * Think API — Chapter 6: Overview & Monitoring
 *
 * Agents propose improvements, bugs, features, refactors.
 *
 * Endpoints:
 *   POST   /api/think                  — create proposal
 *   GET    /api/think                  — list proposals
 *   PATCH  /api/think/:id             — update proposal status
 *   DELETE /api/think/:id             — delete proposal
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ThinkProposal } from "../lib/schemas.js";

export const thinkApi = new Hono();

const THINK_DIR = join(homedir(), ".oracle", "think");

function ensureDir() { mkdirSync(THINK_DIR, { recursive: true }); }

function proposalPath(id: string): string { return join(THINK_DIR, `${id}.json`); }

function nextId(): string {
  ensureDir();
  const files = readdirSync(THINK_DIR).filter(f => f.endsWith(".json"));
  const maxNum = files.reduce((max, f) => {
    const n = parseInt(f.replace(".json", ""), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return String(maxNum + 1);
}

function loadProposal(id: string): ThinkProposal | null {
  try { return JSON.parse(readFileSync(proposalPath(id), "utf-8")); } catch { return null; }
}

// Create proposal
thinkApi.post("/api/think", async (c) => {
  const input = await c.req.json();

  if (!input.title || !input.oracle) {
    return c.json({ error: "title and oracle are required" }, 400);
  }

  const proposal: ThinkProposal = {
    id: nextId(),
    oracle: input.oracle,
    type: input.type || "improvement",
    title: input.title,
    description: input.description || "",
    priority: input.priority || "medium",
    status: "proposed",
    ts: new Date().toISOString(),
  };

  ensureDir();
  writeFileSync(proposalPath(proposal.id), JSON.stringify(proposal, null, 2));

  return c.json(proposal, 201);
});

// List proposals
thinkApi.get("/api/think", (c) => {
  ensureDir();
  if (!existsSync(THINK_DIR)) return c.json({ proposals: [] });

  const oracle = c.req.query("oracle");
  const status = c.req.query("status");

  const files = readdirSync(THINK_DIR).filter(f => f.endsWith(".json"));
  let proposals: ThinkProposal[] = files
    .map(f => {
      try { return JSON.parse(readFileSync(join(THINK_DIR, f), "utf-8")); } catch { return null; }
    })
    .filter(Boolean) as ThinkProposal[];

  if (oracle) proposals = proposals.filter(p => p.oracle === oracle);
  if (status) proposals = proposals.filter(p => p.status === status);

  proposals.sort((a, b) => b.ts.localeCompare(a.ts));

  return c.json({ proposals, total: proposals.length });
});

// Update proposal status
thinkApi.patch("/api/think/:id", async (c) => {
  const proposal = loadProposal(c.req.param("id"));
  if (!proposal) return c.json({ error: "proposal not found" }, 404);

  const input = await c.req.json();
  if (input.status) proposal.status = input.status;
  if (input.priority) proposal.priority = input.priority;

  writeFileSync(proposalPath(proposal.id), JSON.stringify(proposal, null, 2));

  return c.json(proposal);
});

// Delete proposal
thinkApi.delete("/api/think/:id", (c) => {
  const id = c.req.param("id");
  if (!loadProposal(id)) return c.json({ error: "proposal not found" }, 404);

  try { unlinkSync(proposalPath(id)); } catch {}
  return c.json({ ok: true });
});
