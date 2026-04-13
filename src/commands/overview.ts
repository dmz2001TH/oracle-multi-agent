/**
 * Overview Command — Chapter 13: What The Human Sees
 *
 * War room: live status of multiple agents at a glance.
 *
 * Usage:
 *   oracle overview              — show all running agents
 *   oracle overview agent1 agent2 — show specific agents
 */

import { execSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const AGENTS_DIR = join(homedir(), ".oracle", "agents");
const STUCK_THRESHOLD_MS = 10 * 60 * 1000;

interface AgentOverview {
  name: string;
  status: "working" | "idle" | "stuck" | "done" | "dead";
  lastLine: string;
  heartbeatAge: string | null;
  task: string | null;
  branch: string | null;
}

function listTmuxNames(): string[] {
  try {
    const raw = execSync("tmux list-sessions -F '#{session_name}' 2>/dev/null", { encoding: "utf-8" }).trim();
    return raw ? raw.split("\n").filter(Boolean) : [];
  } catch { return []; }
}

function captureLastLine(name: string): string {
  try {
    const content = execSync(
      `tmux capture-pane -t '${name}' -p -S -3 2>/dev/null`,
      { encoding: "utf-8" }
    ).trim();
    const lines = content.split("\n").filter(l => l.trim());
    return lines.pop() || "(empty)";
  } catch { return "(unreachable)"; }
}

function readHeartbeat(name: string): { ts: string; status: string; task: string; branch: string } | null {
  try { return JSON.parse(readFileSync(join(AGENTS_DIR, name, "heartbeat.json"), "utf-8")); } catch { return null; }
}

function hasClaudeProcess(name: string): boolean {
  try {
    const cmd = execSync(
      `tmux list-panes -t '${name}' -F '#{pane_current_command}' 2>/dev/null`,
      { encoding: "utf-8" }
    ).trim();
    return cmd.split("\n").some(l => /claude|codex/i.test(l));
  } catch { return false; }
}

export function cmdOverview(names: string[] = []): void {
  mkdirSync(AGENTS_DIR, { recursive: true });

  // Get session names to show
  const allSessions = listTmuxNames();
  const targetNames = names.length > 0
    ? names.filter(n => allSessions.includes(n))
    : allSessions;

  if (!targetNames.length) {
    console.log("\x1b[90mno agents running (no tmux sessions found)\x1b[0m");
    return;
  }

  // Show unfound names
  const notFound = names.filter(n => !allSessions.includes(n));
  for (const n of notFound) {
    console.log(`\x1b[33m⚠\x1b[0m agent not found: ${n}`);
  }

  console.log(`\n\x1b[36m═══ OVERVIEW ═══\x1b[0m\n`);

  const overviews: AgentOverview[] = [];

  for (const name of targetNames) {
    const hb = readHeartbeat(name);
    const lastLine = captureLastLine(name);
    const hasClaude = hasClaudeProcess(name);

    let status: AgentOverview["status"] = "dead";
    let heartbeatAge: string | null = null;

    if (hb) {
      const age = Date.now() - new Date(hb.ts).getTime();
      heartbeatAge = `${Math.round(age / 1000)}s`;

      if (age > STUCK_THRESHOLD_MS) {
        status = "stuck";
      } else if (hb.status === "DONE" || hb.status === "done") {
        status = "done";
      } else if (hb.status === "working" || hb.status === "PROGRESS") {
        status = "working";
      } else {
        status = hasClaude ? "working" : "idle";
      }
    } else {
      status = hasClaude ? "working" : "idle";
    }

    overviews.push({
      name,
      status,
      lastLine,
      heartbeatAge,
      task: hb?.task || null,
      branch: hb?.branch || null,
    });
  }

  // Render
  for (const a of overviews) {
    const dot = a.status === "working" ? "\x1b[32m●\x1b[0m"
      : a.status === "stuck" ? "\x1b[31m●\x1b[0m"
      : a.status === "done" ? "\x1b[36m●\x1b[0m"
      : "\x1b[90m●\x1b[0m";

    const statusStr = a.status === "working" ? "\x1b[32mworking\x1b[0m"
      : a.status === "stuck" ? "\x1b[31mSTUCK\x1b[0m"
      : a.status === "done" ? "\x1b[36mdone\x1b[0m"
      : "\x1b[90midle\x1b[0m";

    const hbStr = a.heartbeatAge ? `  hb: ${a.heartbeatAge} ago` : "";
    const taskStr = a.task ? `\n     task: ${a.task}` : "";
    const branchStr = a.branch ? `  [${a.branch}]` : "";

    console.log(`${dot} ${a.name.padEnd(20)} ${statusStr}${branchStr}${hbStr}${taskStr}`);
    console.log(`     \x1b[90m⤷ ${a.lastLine.slice(0, 80)}\x1b[0m`);
  }

  // Summary
  const working = overviews.filter(a => a.status === "working").length;
  const stuck = overviews.filter(a => a.status === "stuck").length;
  const idle = overviews.filter(a => a.status === "idle" || a.status === "dead").length;

  console.log();
  console.log(`  ${working} working  ${stuck > 0 ? `\x1b[31m${stuck} stuck\x1b[0m` : "0 stuck"}  ${idle} idle`);
  console.log();
}
