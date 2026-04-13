/**
 * Heartbeat Protocol — Chapter 14: Failure Modes
 *
 * Agents write heartbeats periodically so the monitor can detect
 * silent/stuck agents. Pattern from Ch 14 prevention layer.
 *
 * Integration: spawn skeleton should call heartbeat() during PROGRESS.
 *
 * Heartbeat file: ~/.oracle/agents/<name>/heartbeat.json
 * Schema: { name, ts, status, task, branch, pid }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface Heartbeat {
  name: string;
  ts: string;
  status: "working" | "idle" | "stuck" | "done" | "PROGRESS" | "DONE" | "STUCK";
  task: string;
  branch: string;
  pid?: number;
}

const AGENTS_DIR = join(homedir(), ".oracle", "agents");
const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function agentDir(name: string): string {
  return join(AGENTS_DIR, name);
}

function heartbeatPath(name: string): string {
  return join(agentDir(name), "heartbeat.json");
}

/**
 * Write a heartbeat for the given agent.
 * Call this from within the spawned agent's process or from the orchestrator.
 */
export function heartbeat(name: string, task: string, branch: string, status: Heartbeat["status"] = "working"): Heartbeat {
  const dir = agentDir(name);
  mkdirSync(dir, { recursive: true });

  const hb: Heartbeat = {
    name,
    ts: new Date().toISOString(),
    status,
    task,
    branch,
    pid: process.pid,
  };

  writeFileSync(heartbeatPath(name), JSON.stringify(hb, null, 2));
  return hb;
}

/**
 * Read the latest heartbeat for an agent.
 */
export function getHeartbeat(name: string): Heartbeat | null {
  const path = heartbeatPath(name);
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Check if an agent's heartbeat is stale (no update in maxAgeMs).
 */
export function isStale(name: string, maxAgeMs: number = DEFAULT_MAX_AGE_MS): boolean {
  const hb = getHeartbeat(name);
  if (!hb) return true; // No heartbeat = stale
  const age = Date.now() - new Date(hb.ts).getTime();
  return age > maxAgeMs;
}

/**
 * List all heartbeats for all agents.
 */
export function listHeartbeats(): Heartbeat[] {
  if (!existsSync(AGENTS_DIR)) return [];

  const { readdirSync } = require("node:fs");
  const dirs = readdirSync(AGENTS_DIR);
  const heartbeats: Heartbeat[] = [];

  for (const d of dirs) {
    const hb = getHeartbeat(d);
    if (hb) heartbeats.push(hb);
  }

  return heartbeats;
}
