/**
 * Spawn Skeleton — Chapter 8: Federation Agent
 *
 * Creates a tmux session, launches claude -p with a baked-in
 * reporting contract. The agent must report PROGRESS every 5 min
 * and DONE/STUCK when finished.
 *
 * Usage (CLI):
 *   oracle spawn <name> "task description" [--cwd X] [--orchestrator X] [--branch X]
 *
 * Usage (SDK):
 *   spawnAgent("wasm-host", "implement #317", { cwd: "/repo", orchestrator: "mawjs-oracle" })
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

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

function tmuxCmd(): string {
  return "tmux";
}

export function spawnAgent(name: string, task: string, opts: SpawnOptions = {}): void {
  const cwd = opts.cwd || process.cwd();
  const orchestrator = opts.orchestrator || "oracle";
  const skipPerms = opts.dangerouslySkipPermissions ?? false;

  // Ensure agent directory exists for heartbeat
  const agentDir = join(homedir(), ".oracle", "agents", name);
  mkdirSync(agentDir, { recursive: true });

  // Validate cwd
  if (!existsSync(cwd)) {
    throw new Error(`cwd does not exist: ${cwd}`);
  }

  // Check if session already exists
  try {
    execSync(`${tmuxCmd()} has-session -t '${name}' 2>/dev/null`, { stdio: "pipe" });
    throw new Error(`tmux session "${name}" already exists. Kill it first or pick a different name.`);
  } catch (err: any) {
    // Session doesn't exist — good, proceed
    if (err.message?.includes("already exists")) throw err;
  }

  // Create tmux session
  execSync(`${tmuxCmd()} new-session -d -s '${name}' -c '${cwd}'`, { stdio: "pipe" });

  // Build prompt with reporting contract
  const reportingContract = REPORTING_CONTRACT(name, orchestrator);
  const fullPrompt = `${task}\n\n---\nREPORTING CONTRACT (mandatory):\n${reportingContract}`;

  // Build claude command
  const claudeFlags = skipPerms ? "--dangerously-skip-permissions" : "";
  const modelFlag = opts.model ? `--model ${opts.model}` : "";
  const branchFlag = opts.branch ? `git checkout -b ${opts.branch} 2>/dev/null || git checkout ${opts.branch}; ` : "";

  // Escape single quotes in prompt for shell safety
  const escapedPrompt = fullPrompt.replace(/'/g, "'\\''");
  const claudeCmd = `${branchFlag}claude ${claudeFlags} ${modelFlag} -p '${escapedPrompt}'`.trim();

  // Send via tmux send-keys (wrapped in maw hey style)
  const tmuxTarget = `${name}:0`;
  execSync(`${tmuxCmd()} send-keys -t '${tmuxTarget}' "${claudeCmd.replace(/"/g, '\\"')}" Enter`, { stdio: "pipe" });

  console.log(`\x1b[32m✓\x1b[0m Spawned agent "${name}" in tmux session`);
  console.log(`  cwd:         ${cwd}`);
  console.log(`  orchestrator: ${orchestrator}`);
  if (opts.branch) console.log(`  branch:      ${opts.branch}`);
  console.log(`  task:        ${task.slice(0, 80)}${task.length > 80 ? "..." : ""}`);
  console.log();
  console.log(`  \x1b[90mpeek:  oracle peek ${name}\x1b[0m`);
  console.log(`  \x1b[90mattach: tmux attach -t ${name}\x1b[0m`);
  console.log(`  \x1b[90mkill:   tmux kill-session -t ${name}\x1b[0m`);
}
