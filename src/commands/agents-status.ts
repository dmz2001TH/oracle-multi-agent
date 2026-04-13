/**
 * Agent Status Monitor — Chapter 13, 14: What The Human Sees + Failure Modes
 *
 * Scans tmux sessions for running agents, reads heartbeat data,
 * and flags idle agents as "stuck".
 *
 * Usage (CLI):
 *   oracle agents [status]
 *   oracle agents kill <name>
 */

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { AgentStatus } from "../lib/schemas.js";

const AGENTS_DIR = join(homedir(), ".oracle", "agents");
const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

interface HeartbeatData {
  name: string;
  ts: string;
  status: string;
  task: string;
  branch: string;
  pid?: number;
}

interface TmuxSession {
  name: string;
  pid: number;
  created: string;
  attached: boolean;
}

function listTmuxSessions(): TmuxSession[] {
  try {
    const raw = execSync(
      "tmux list-sessions -F '#{session_name}:#{session_pid}:#{session_created}:#{session_attached}' 2>/dev/null",
      { encoding: "utf-8" }
    ).trim();

    if (!raw) return [];

    return raw.split("\n").filter(Boolean).map(line => {
      const [name, pid, created, attached] = line.split(":");
      return {
        name,
        pid: parseInt(pid, 10) || 0,
        created: new Date(parseInt(created, 10) * 1000).toISOString(),
        attached: attached === "1",
      };
    });
  } catch {
    return [];
  }
}

function readHeartbeat(agentName: string): HeartbeatData | null {
  const path = join(AGENTS_DIR, agentName, "heartbeat.json");
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function isStale(ts: string, maxAgeMs: number = STUCK_THRESHOLD_MS): boolean {
  const age = Date.now() - new Date(ts).getTime();
  return age > maxAgeMs;
}

export function listAgentStatuses(): AgentStatus[] {
  mkdirSync(AGENTS_DIR, { recursive: true });
  const sessions = listTmuxSessions();
  const statuses: AgentStatus[] = [];

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

      if (isStale(hb.ts)) {
        status = "stuck";
      } else if (hb.status === "working" || hb.status === "PROGRESS") {
        status = "working";
      } else if (hb.status === "DONE" || hb.status === "done") {
        status = "done";
      }
    } else {
      // No heartbeat — check if tmux pane has a running claude process
      try {
        const cmd = execSync(
          `tmux list-panes -t '${sess.name}' -F '#{pane_pid}:#{pane_current_command}' 2>/dev/null`,
          { encoding: "utf-8" }
        ).trim();
        const hasClaude = cmd.split("\n").some(line => /claude|codex/i.test(line));
        status = hasClaude ? "working" : "idle";
      } catch {
        status = "idle";
      }
    }

    statuses.push({
      name: sess.name,
      status,
      lastHeartbeat,
      currentTask,
      branch,
      tmuxSession: sess.name,
    });
  }

  return statuses;
}

export function cmdAgentsStatus(): void {
  const statuses = listAgentStatuses();

  if (!statuses.length) {
    console.log("\x1b[90mno agents running (no tmux sessions found)\x1b[0m");
    return;
  }

  console.log(`\n\x1b[36mAGENTS\x1b[0m (${statuses.length}):\n`);
  for (const a of statuses) {
    const icon = a.status === "working" ? "🟢" : a.status === "stuck" ? "🔴" : a.status === "done" ? "✅" : "⚪";
    const statusColor = a.status === "working" ? "\x1b[32m" : a.status === "stuck" ? "\x1b[31m" : a.status === "done" ? "\x1b[36m" : "\x1b[90m";

    const hbAge = a.lastHeartbeat
      ? `${Math.round((Date.now() - new Date(a.lastHeartbeat).getTime()) / 1000)}s ago`
      : "no heartbeat";

    console.log(`  ${icon} ${a.name.padEnd(20)} ${statusColor}${a.status}\x1b[0m`);
    if (a.currentTask) console.log(`     task: ${a.currentTask}`);
    if (a.branch) console.log(`     branch: ${a.branch}`);
    console.log(`     heartbeat: ${hbAge}`);
  }

  // Flag stuck agents
  const stuck = statuses.filter(a => a.status === "stuck");
  if (stuck.length) {
    console.log(`\n  \x1b[31m⚠ ${stuck.length} agent(s) stuck:\x1b[0m ${stuck.map(a => a.name).join(", ")}`);
  }
  console.log();
}

export function cmdAgentsKill(name: string): void {
  if (!name) {
    console.error("usage: oracle agents kill <name>");
    process.exit(1);
  }

  try {
    execSync(`tmux has-session -t '${name}' 2>/dev/null`, { stdio: "pipe" });
  } catch {
    console.error(`\x1b[31merror\x1b[0m: tmux session "${name}" not found`);
    process.exit(1);
  }

  try {
    execSync(`tmux kill-session -t '${name}'`, { stdio: "pipe" });
    console.log(`\x1b[32m✓\x1b[0m Agent "${name}" killed`);
  } catch (err: any) {
    console.error(`\x1b[31merror\x1b[0m: ${err.message}`);
    process.exit(1);
  }
}
