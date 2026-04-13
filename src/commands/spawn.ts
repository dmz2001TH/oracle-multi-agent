/**
 * Spawn Skeleton — Chapter 8: Federation Agent
 *
 * Creates a process (tmux session on Linux/Mac, node-pty on Windows),
 * launches claude -p with a baked-in reporting contract.
 * The agent must report PROGRESS every 5 min and DONE/STUCK when finished.
 *
 * Usage (CLI):
 *   oracle spawn <name> "task description" [--cwd X] [--orchestrator X] [--branch X]
 *
 * Usage (SDK):
 *   spawnAgent("wasm-host", "implement #317", { cwd: "/repo", orchestrator: "mawjs-oracle" })
 */

import { execSync, spawn as nodeSpawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { hasTmux, shellQuote, devNull, isWindows } from "../platform.js";

export interface SpawnOptions {
  cwd?: string;
  orchestrator?: string;
  branch?: string;
  model?: string;
  dangerouslySkipPermissions?: boolean;
}

const REPORTING_CONTRACT = (name: string, orchestrator: string) => `
STEP 5: Report progress AT LEAST every 5 minutes with:
  maw hey ${orchestrator} "[${name}] PROGRESS: <what you just did>"
STEP 6: When done OR stuck, send:
  maw hey ${orchestrator} "[${name}] DONE: <branch>" (success)
  maw hey ${orchestrator} "[${name}] STUCK: <reason>" (failure)
STEP 7: Also write a summary to the inbox:
  maw inbox write "[${name}] <summary>"
Do not exit until STEP 6 has run successfully.
`.trim();

function buildClaudeCommand(task: string, opts: SpawnOptions, orchestrator: string): string {
  const skipPerms = opts.dangerouslySkipPermissions ?? false;
  const reportingContract = REPORTING_CONTRACT(opts.orchestrator || "oracle", orchestrator);
  const fullPrompt = `${task}\n\n---\nREPORTING CONTRACT (mandatory):\n${reportingContract}`;

  const claudeFlags = skipPerms ? "--dangerously-skip-permissions" : "";
  const modelFlag = opts.model ? `--model ${opts.model}` : "";

  if (isWindows) {
    // Windows: use double-quote escaping
    const escapedPrompt = fullPrompt.replace(/"/g, '""');
    const branchCmd = opts.branch
      ? `git checkout -b ${opts.branch} 2>NUL || git checkout ${opts.branch}; `
      : "";
    return `${branchCmd}claude ${claudeFlags} ${modelFlag} -p "${escapedPrompt}"`.trim();
  }

  // Unix: use single-quote escaping
  const escapedPrompt = fullPrompt.replace(/'/g, "'\\''");
  const branchCmd = opts.branch
    ? `git checkout -b ${opts.branch} 2>/dev/null || git checkout ${opts.branch}; `
    : "";
  return `${branchCmd}claude ${claudeFlags} ${modelFlag} -p '${escapedPrompt}'`.trim();
}

/**
 * Spawn via tmux (Linux/Mac/WSL).
 */
function spawnWithTmux(name: string, claudeCmd: string, cwd: string): void {
  const quotedName = shellQuote(name);
  const quotedCwd = shellQuote(cwd);

  // Check if session already exists
  try {
    execSync(`tmux has-session -t ${quotedName} 2>${devNull}`, { stdio: "pipe" });
    throw new Error(`tmux session "${name}" already exists. Kill it first or pick a different name.`);
  } catch (err: any) {
    if (err.message?.includes("already exists")) throw err;
  }

  // Create tmux session
  execSync(`tmux new-session -d -s ${quotedName} -c ${quotedCwd}`, { stdio: "pipe" });

  // Send command via send-keys
  const tmuxTarget = `${name}:0`;
  execSync(`tmux send-keys -t ${shellQuote(tmuxTarget)} ${shellQuote(claudeCmd)} Enter`, { stdio: "pipe" });
}

/**
 * Spawn via node child_process (Windows / no-tmux fallback).
 * Uses a detached background process that writes output to a log file.
 */
function spawnWithChildProcess(name: string, claudeCmd: string, cwd: string): void {
  const agentDir = join(homedir(), ".oracle", "agents", name);
  mkdirSync(agentDir, { recursive: true });

  const logFile = join(agentDir, "output.log");

  // Build a shell command that runs claude and logs output
  let shellCmd: string;
  let shellArgs: string[];

  if (isWindows) {
    shellCmd = "powershell.exe";
    shellArgs = ["-Command", `& { ${claudeCmd} } 2>&1 | Tee-Object -FilePath "${logFile}"`];
  } else {
    shellCmd = "bash";
    shellArgs = ["-c", `${claudeCmd} 2>&1 | tee "${logFile}"`];
  }

  const child = nodeSpawn(shellCmd, shellArgs, {
    cwd,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ORACLE_AGENT: name },
  });

  // Write PID for heartbeat tracking
  const { writeFileSync } = require("node:fs");
  writeFileSync(join(agentDir, "pid"), String(child.pid));

  child.unref(); // Allow parent to exit
}

export function spawnAgent(name: string, task: string, opts: SpawnOptions = {}): void {
  const cwd = opts.cwd || process.cwd();
  const orchestrator = opts.orchestrator || "oracle";
  const useTmux = hasTmux();

  // Ensure agent directory exists for heartbeat
  const agentDir = join(homedir(), ".oracle", "agents", name);
  mkdirSync(agentDir, { recursive: true });

  // Validate cwd
  if (!existsSync(cwd)) {
    throw new Error(`cwd does not exist: ${cwd}`);
  }

  // Build the claude command
  const claudeCmd = buildClaudeCommand(task, opts, orchestrator);

  // Spawn with appropriate backend
  if (useTmux) {
    spawnWithTmux(name, claudeCmd, cwd);
  } else {
    spawnWithChildProcess(name, claudeCmd, cwd);
  }

  // Output
  const backend = useTmux ? "tmux session" : "background process";
  console.log(`\x1b[32m✓\x1b[0m Spawned agent "${name}" (${backend})`);
  console.log(`  cwd:         ${cwd}`);
  console.log(`  orchestrator: ${orchestrator}`);
  if (opts.branch) console.log(`  branch:      ${opts.branch}`);
  console.log(`  task:        ${task.slice(0, 80)}${task.length > 80 ? "..." : ""}`);
  console.log();
  if (useTmux) {
    console.log(`  \x1b[90mpeek:  oracle peek ${name}\x1b[0m`);
    console.log(`  \x1b[90mattach: tmux attach -t ${name}\x1b[0m`);
    console.log(`  \x1b[90mkill:   tmux kill-session -t ${name}\x1b[0m`);
  } else {
    console.log(`  \x1b[90mlog:   ${join(agentDir, "output.log")}\x1b[0m`);
    console.log(`  \x1b[90mpid:   ${join(agentDir, "pid")}\x1b[0m`);
    console.log(`  \x1b[90mkill:   oracle agents kill ${name}\x1b[0m`);
  }

  // Emit feed event
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), ".config", "oracle", "oracle.config.json"), "utf-8"));
    const port = cfg.port || 3456;
    fetch(`http://localhost:${port}/api/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "AgentSpawn",
        oracle: name,
        host: cfg.node || "local",
        message: `spawned (${backend}): ${task.slice(0, 100)}`,
        ts: Date.now(),
      }),
    }).catch(() => {});
  } catch {}
}
