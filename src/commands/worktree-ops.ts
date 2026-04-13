/**
 * Worktree Operations — Chapter 7: The Implementation Team
 *
 * Provides isolated git worktrees for parallel agent work.
 * Each agent works in its own worktree → no write contention.
 *
 * Usage:
 *   oracle worktree create <branch> [--agent X] [--cwd X]
 *   oracle worktree ls [--cwd X]
 *   oracle worktree prune [--cwd X] [--merged]
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const WORKTREE_BASE = join(homedir(), ".oracle", "worktrees");

function git(cmd: string, cwd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (err: any) {
    throw new Error(`git ${cmd.split(" ")[0]}: ${err.stderr?.trim() || err.message}`);
  }
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  agent?: string;
  status: "active" | "merged" | "orphan";
}

function resolveRepoRoot(cwd: string): string {
  return git("rev-parse --show-toplevel", cwd);
}

function listWorktrees(cwd: string): WorktreeInfo[] {
  const raw = git("worktree list --porcelain", cwd);
  const entries: WorktreeInfo[] = [];
  const blocks = raw.split("\n\n");

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    let path = "";
    let branch = "";
    let commit = "";

    for (const line of lines) {
      if (line.startsWith("worktree ")) path = line.slice(9);
      else if (line.startsWith("branch ")) branch = line.slice(7).replace("refs/heads/", "");
      else if (line.startsWith("HEAD ")) commit = line.slice(5, 13);
      else if (line === "bare") { path = lines[0].slice(9); branch = "(bare)"; }
    }

    if (path) {
      // Try to find agent name from directory convention
      const dirName = path.split("/").pop() || "";
      const agent = dirName.startsWith("wt-") ? dirName.slice(3) : undefined;

      entries.push({ path, branch, commit, agent, status: "active" });
    }
  }

  return entries;
}

export function cmdWorktreeCreate(branch: string, opts: { agent?: string; cwd?: string } = {}): void {
  const cwd = opts.cwd || process.cwd();
  const repoRoot = resolveRepoRoot(cwd);
  const agent = opts.agent;

  mkdirSync(WORKTREE_BASE, { recursive: true });

  const dirName = agent ? `wt-${agent}` : `wt-${branch.replace(/[^a-zA-Z0-9-]/g, "-")}`;
  const worktreePath = join(WORKTREE_BASE, dirName);

  if (existsSync(worktreePath)) {
    throw new Error(`worktree already exists: ${worktreePath}`);
  }

  // Create worktree
  git(`worktree add -b ${branch} '${worktreePath}'`, repoRoot);

  console.log(`\x1b[32m✓\x1b[0m Worktree created`);
  console.log(`  path:   ${worktreePath}`);
  console.log(`  branch: ${branch}`);
  if (agent) console.log(`  agent:  ${agent}`);
}

export function cmdWorktreeList(opts: { cwd?: string } = {}): void {
  const cwd = opts.cwd || process.cwd();
  const repoRoot = resolveRepoRoot(cwd);

  const worktrees = listWorktrees(repoRoot);

  if (worktrees.length <= 1) {
    console.log("\x1b[90mno additional worktrees (only main worktree)\x1b[0m");
    return;
  }

  console.log(`\n\x1b[36mWORKTREES\x1b[0m (${worktrees.length}):\n`);
  for (const wt of worktrees) {
    const isMain = wt.path === repoRoot;
    const icon = isMain ? "🏠" : "🌿";
    const agentStr = wt.agent ? ` \x1b[33m@${wt.agent}\x1b[0m` : "";
    const mainTag = isMain ? " \x1b[90m(main)\x1b[0m" : "";

    console.log(`  ${icon} ${wt.branch.padEnd(25)} ${wt.commit}${agentStr}${mainTag}`);
    if (!isMain) console.log(`     \x1b[90m${wt.path}\x1b[0m`);
  }
  console.log();
}

export function cmdWorktreePrune(opts: { cwd?: string; merged?: boolean } = {}): void {
  const cwd = opts.cwd || process.cwd();
  const repoRoot = resolveRepoRoot(cwd);

  // Dry run: find merged branches
  const worktrees = listWorktrees(repoRoot).filter(wt => wt.path !== repoRoot);

  if (!worktrees.length) {
    console.log("\x1b[90mno worktrees to prune\x1b[0m");
    return;
  }

  const mainBranch = git("rev-parse --abbrev-ref HEAD", repoRoot);
  let pruned = 0;

  for (const wt of worktrees) {
    if (wt.branch === mainBranch) continue;

    // Check if branch is merged
    let isMerged = false;
    try {
      git(`merge-base --is-ancestor ${wt.branch} ${mainBranch}`, repoRoot);
      isMerged = true;
    } catch {
      // Not merged
    }

    if (isMerged || opts.merged === false) {
      console.log(`  \x1b[33m⚠ pruning:\x1b[0m ${wt.branch} (${wt.path})`);
      try {
        git(`worktree remove '${wt.path}'`, repoRoot);
        git(`branch -d ${wt.branch}`, repoRoot);
        pruned++;
      } catch (err: any) {
        console.error(`  \x1b[31m✗\x1b[0m ${err.message}`);
      }
    }
  }

  // Standard prune
  git("worktree prune", repoRoot);

  if (pruned > 0) {
    console.log(`\n\x1b[32m✓\x1b[0m Pruned ${pruned} worktree(s)`);
  } else {
    console.log("\x1b[90mno merged worktrees found\x1b[0m");
  }
}
