/**
 * Agents Status API — Chapter 8, 13, 14: Federation + Failure Modes
 *
 * Endpoints:
 *   GET /api/agents/status — list all running agents across fleet
 *
 * Combines: tmux session scan (or background process scan on Windows) + heartbeat data
 */

import { Hono } from "hono";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { AgentStatus } from "../lib/schemas.js";
import { hasTmux, devNull, isWindows } from "../platform.js";

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
      `tmux list-sessions -F '#{session_name}:#{session_attached}' 2>${devNull}`,
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

function listBackgroundAgents(): { name: string; alive: boolean }[] {
  if (!existsSync(AGENTS_DIR)) return [];
  const dirs = readdirSync(AGENTS_DIR);
  const agents: { name: string; alive: boolean }[] = [];

  for (const dir of dirs) {
    const pidFile = join(AGENTS_DIR, dir, "pid");
    try {
      const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
      if (isNaN(pid)) continue;
      let alive = false;
      try {
        if (isWindows) {
          execSync(`tasklist /FI "PID eq ${pid}" 2>${devNull}`, { stdio: "pipe" });
        } else {
          execSync(`kill -0 ${pid} 2>${devNull}`, { stdio: "pipe" });
        }
        alive = true;
      } catch {}
      agents.push({ name: dir, alive });
    } catch {}
  }
  return agents;
}

function readHeartbeat(agentName: string): HeartbeatData | null {
  try {
    return JSON.parse(readFileSync(join(AGENTS_DIR, agentName, "heartbeat.json"), "utf-8"));
  } catch {
    return null;
  }
}

function computeStatus(hb: HeartbeatData | null, isAlive: boolean): AgentStatus["status"] {
  if (hb) {
    const age = Date.now() - new Date(hb.ts).getTime();
    if (age > STUCK_THRESHOLD_MS) return "stuck";
    if (hb.status === "working" || hb.status === "PROGRESS") return "working";
    if (hb.status === "DONE" || hb.status === "done") return "done";
  }
  return isAlive ? "working" : "idle";
}

agentsApi.get("/api/agents/status", (c) => {
  mkdirSync(AGENTS_DIR, { recursive: true });
  const agents: AgentStatus[] = [];

  if (hasTmux()) {
    const sessions = listTmuxSessions();
    for (const sess of sessions) {
      const hb = readHeartbeat(sess.name);
      let isAlive = true;
      if (!hb) {
        try {
          const cmd = execSync(
            `tmux list-panes -t '${sess.name}' -F '#{pane_current_command}' 2>${devNull}`,
            { encoding: "utf-8" }
          ).trim();
          isAlive = cmd.split("\n").some(l => /claude|codex/i.test(l));
        } catch { isAlive = false; }
      }
      agents.push({
        name: sess.name,
        status: computeStatus(hb, isAlive),
        lastHeartbeat: hb?.ts,
        currentTask: hb?.task,
        branch: hb?.branch,
        tmuxSession: sess.name,
      });
    }
  } else {
    const bgAgents = listBackgroundAgents();
    for (const agent of bgAgents) {
      const hb = readHeartbeat(agent.name);
      agents.push({
        name: agent.name,
        status: computeStatus(hb, agent.alive),
        lastHeartbeat: hb?.ts,
        currentTask: hb?.task,
        branch: hb?.branch,
      });
    }
  }

  return c.json({ agents, total: agents.length });
});

agentsApi.get("/api/agents/status/:name", (c) => {
  const name = c.req.param("name");
  const hb = readHeartbeat(name);

  let processAlive = false;
  if (hasTmux()) {
    try {
      execSync(`tmux has-session -t '${name}' 2>${devNull}`, { stdio: "pipe" });
      processAlive = true;
    } catch {}
  } else {
    try {
      const pidFile = join(AGENTS_DIR, name, "pid");
      const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
      if (!isNaN(pid)) {
        if (isWindows) {
          execSync(`tasklist /FI "PID eq ${pid}" 2>${devNull}`, { stdio: "pipe" });
        } else {
          execSync(`kill -0 ${pid} 2>${devNull}`, { stdio: "pipe" });
        }
        processAlive = true;
      }
    } catch {}
  }

  if (!processAlive) {
    // Process is dead — agent is gone. Heartbeat file may linger as orphaned data.
    if (!hb) {
      return c.json({ error: "agent not found" }, 404);
    }
    // Return 404 with stale heartbeat info for debugging
    const age = Date.now() - new Date(hb.ts).getTime();
    return c.json({
      error: "agent not found",
      name,
      processAlive: false,
      stale: true,
      ageSeconds: Math.round(age / 1000),
      heartbeat: hb,
    }, 404);
  }

  const age = hb ? Date.now() - new Date(hb.ts).getTime() : null;
  const stale = age !== null && age > STUCK_THRESHOLD_MS;

  return c.json({
    name,
    processAlive,
    stale,
    ageSeconds: age !== null ? Math.round(age / 1000) : null,
    heartbeat: hb,
  });
});
