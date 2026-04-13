/**
 * Tokens API — Chapter 6: Overview & Monitoring
 *
 * Endpoints:
 *   GET    /api/tokens                 — all token usage
 *   POST   /api/tokens                — record usage { agent, inputTokens, outputTokens, cost } OR { action: "reset" }
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { TokenUsage, TokenStats } from "../lib/schemas.js";

export const tokensApi = new Hono();

const TOKENS_FILE = join(homedir(), ".oracle", "tokens.json");

function loadAll(): TokenUsage[] {
  try { return JSON.parse(readFileSync(TOKENS_FILE, "utf-8")); } catch { return []; }
}

function saveAll(usage: TokenUsage[]): void {
  mkdirSync(join(homedir(), ".oracle"), { recursive: true });
  writeFileSync(TOKENS_FILE, JSON.stringify(usage, null, 2));
}

// Get all token usage
tokensApi.get("/api/tokens", (c) => {
  const agents = loadAll();
  const stats: TokenStats = {
    agents,
    totalInput: agents.reduce((s, a) => s + a.inputTokens, 0),
    totalOutput: agents.reduce((s, a) => s + a.outputTokens, 0),
    totalCost: Math.round(agents.reduce((s, a) => s + a.cost, 0) * 10000) / 10000,
  };
  return c.json(stats);
});

// Record token usage for an agent OR reset all
tokensApi.post("/api/tokens", async (c) => {
  const input = await c.req.json();

  // Reset action
  if (input.action === "reset") {
    saveAll([]);
    return c.json({ ok: true });
  }

  // Record usage
  const agentName = input.agent;
  if (!agentName) {
    return c.json({ error: "agent is required (or send { action: 'reset' })" }, 400);
  }

  const all = loadAll();
  const existing = all.find(a => a.agent === agentName);
  if (existing) {
    existing.inputTokens += input.inputTokens || 0;
    existing.outputTokens += input.outputTokens || 0;
    existing.totalTokens = existing.inputTokens + existing.outputTokens;
    existing.cost += input.cost || 0;
    existing.lastUpdated = new Date().toISOString();
  } else {
    all.push({
      agent: agentName,
      inputTokens: input.inputTokens || 0,
      outputTokens: input.outputTokens || 0,
      totalTokens: (input.inputTokens || 0) + (input.outputTokens || 0),
      cost: input.cost || 0,
      lastUpdated: new Date().toISOString(),
    });
  }

  saveAll(all);
  return c.json({ ok: true });
});
