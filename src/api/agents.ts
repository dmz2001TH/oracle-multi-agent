/**
 * Agents Status API — Chapter 8, 13, 14: Federation + Failure Modes
 *
 * Endpoints:
 *   GET /api/agents/status — list all running agents across fleet
 *
 * Combines: tmux session scan + heartbeat data + peer federation
 */

import { Hono } from "hono";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { AgentStatus } from "../lib/schemas.js";

export const agentsApi = new Hono();

const AGENTS_DIR = join(homedir(), ".oracle", "agents");
const STUCK_THRESHOLD_MS = 10 * 60 * 1000;

interface HeartbeatData {
  name: string;
  ts: string;
  status: string;
  task: string;
  branch: string;
  pid?: number;
}

function listTmuxSessions(): { name: string; attached: boolean }[] {
  try {
    const raw = execSync(
      "tmux list-sessions -F '#{session_name}:#{session_attached}' 2>/dev/null",
      { encoding: "utf-8" }
    ).trim();
    if (!raw) return [];
    return raw.split("\n").filter(Boolean).map(line => {
      const [name, attached] = line.split(":");
      return { name, attached: attached === "1" };
    });
  } catch {
    return [];
  }
}

function readHeartbeat(agentName: string): HeartbeatData | null {
  try {
    return JSON.parse(readFileSync(join(AGENTS_DIR, agentName, "heartbeat.json"), "utf-8"));
  } catch {
    return null;
  }
}

agentsApi.get("/api/agents/status", (c) => {
  mkdirSync(AGENTS_DIR, { recursive: true });
  const sessions = listTmuxSessions();
  const agents: AgentStatus[] = [];

  for (const sess of sessions) {
    const hb = readHeartbeat(sess.name);
    let status: AgentStatus["status"] = "idle";
    let lastHeartbeat: string | undefined;
    let currentTask: string | undefined;
    let branch: string | undefined;

    if (hb) {
      lastHeartbeat = hb.ts;
      currentTask = hb.task;
      branch = hb.branch;

      const age = Date.now() - new Date(hb.ts).getTime();
      if (age > STUCK_THRESHOLD_MS) {
        status = "stuck";
      } else if (hb.status === "working" || hb.status === "PROGRESS") {
        status = "working";
      } else if (hb.status === "DONE" || hb.status === "done") {
        status = "done";
      }
    } else {
      // No heartbeat — check if pane has claude running
      try {
        const cmd = execSync(
          `tmux list-panes -t '${sess.name}' -F '#{pane_current_command}' 2>/dev/null`,
          { encoding: "utf-8" }
        ).trim();
        status = cmd.split("\n").some(l => /claude|codex/i.test(l)) ? "working" : "idle";
      } catch {
        status = "idle";
      }
    }

    agents.push({
      name: sess.name,
      status,
      lastHeartbeat,
      currentTask,
      branch,
      tmuxSession: sess.name,
    });
  }

  return c.json({ agents, total: agents.length });
});

agentsApi.get("/api/agents/status/:name", (c) => {
  const name = c.req.param("name");
  const hb = readHeartbeat(name);

  // Check if tmux session exists
  let tmuxAlive = false;
  try {
    execSync(`tmux has-session -t '${name}' 2>/dev/null`, { stdio: "pipe" });
    tmuxAlive = true;
  } catch {}

  if (!hb && !tmuxAlive) {
    return c.json({ error: "agent not found" }, 404);
  }

  const age = hb ? Date.now() - new Date(hb.ts).getTime() : null;
  const stale = age !== null && age > STUCK_THRESHOLD_MS;

  return c.json({
    name,
    tmuxAlive,
    stale,
    ageSeconds: age !== null ? Math.round(age / 1000) : null,
    heartbeat: hb,
  });
});
