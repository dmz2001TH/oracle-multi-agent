/**
 * Lead-Compiles Merge Helper — Chapter 4, 7: Task Tracking + Implementation Team
 *
 * Merges completed agent branches in dependency order.
 * Only the lead merges — subordinates report and stop.
 *
 * Usage:
 *   oracle merge <team> [--cwd X] [--no-push] [--no-test] [--dry-run]
 *
 * Flow:
 *   1. Read TaskList for team (completed tasks)
 *   2. Sort by dependency order (blockedBy)
 *   3. For each: git merge <branch> --no-ff
 *   4. Run tests (npm test / bun test)
 *   5. If pass: git push, mark tasks done
 *   6. Cleanup: git worktree remove
 */

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "path";
import { homedir } from "node:os";
import type { Task } from "../lib/schemas.js";

const TASKS_DIR = join(homedir(), ".oracle", "tasks");

function git(cmd: string, cwd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (err: any) {
    throw new Error(`git ${cmd.split(" ")[0]}: ${err.stderr?.trim() || err.message}`);
  }
}

function loadTasks(): Task[] {
  if (!existsSync(TASKS_DIR)) return [];
  const files = readdirSync(TASKS_DIR).filter(f => f.endsWith(".json"));
  return files.map(f => {
    try { return JSON.parse(readFileSync(join(TASKS_DIR, f), "utf-8")); } catch { return null; }
  }).filter(Boolean) as Task[];
}

function saveTask(task: Task): void {
  const { writeFileSync, mkdirSync } = require("fs");
  mkdirSync(TASKS_DIR, { recursive: true });
  writeFileSync(join(TASKS_DIR, `${task.id}.json`), JSON.stringify(task, null, 2));
}

/**
 * Topological sort by blockedBy dependencies.
 * Returns tasks in merge order (leaves first).
 */
function topologicalSort(tasks: Task[]): Task[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const sorted: Task[] = [];
  const visited = new Set<string>();

  function visit(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);

    const task = taskMap.get(id);
    if (!task) return;

    if (task.blockedBy) {
      for (const depId of task.blockedBy) {
        visit(depId);
      }
    }

    sorted.push(task);
  }

  for (const task of tasks) {
    visit(task.id);
  }

  return sorted;
}

interface MergeResult {
  taskId: string;
  branch: string;
  status: "merged" | "conflict" | "test-failed" | "skipped";
  error?: string;
}

export function cmdMergeTeam(team: string, opts: { cwd?: string; noPush?: boolean; noTest?: boolean; dryRun?: boolean } = {}): void {
  const cwd = opts.cwd || process.cwd();

  // Resolve git root
  let repoRoot: string;
  try {
    repoRoot = git("rev-parse --show-toplevel", cwd);
  } catch (err: any) {
    console.error(`\x1b[31merror\x1b[0m: not a git repository`);
    process.exit(1);
  }

  // Load completed tasks for this team
  const allTasks = loadTasks();
  const completedTasks = allTasks.filter(t => t.team === team && t.status === "completed" && t.branch);

  if (!completedTasks.length) {
    console.log(`\x1b[90mno completed tasks with branches for team "${team}"\x1b[0m`);
    return;
  }

  console.log(`\n\x1b[36mMERGE TEAM: ${team}\x1b[0m`);
  console.log(`  ${completedTasks.length} completed task(s) to merge\n`);

  // Sort by dependency order
  const sorted = topologicalSort(completedTasks);
  const results: MergeResult[] = [];

  // Ensure we're on the default branch
  const currentBranch = git("rev-parse --abbrev-ref HEAD", repoRoot);
  console.log(`  current branch: ${currentBranch}`);

  for (const task of sorted) {
    const branch = task.branch!;
    console.log(`\n  \x1b[33m── #${task.id}: ${task.subject} (${branch}) ──\x1b[0m`);

    // Check if branch exists
    try {
      git(`rev-parse --verify ${branch}`, repoRoot);
    } catch {
      console.log(`    \x1b[33mskipped:\x1b[0m branch ${branch} not found`);
      results.push({ taskId: task.id, branch, status: "skipped", error: "branch not found" });
      continue;
    }

    if (opts.dryRun) {
      console.log(`    \x1b[90m[dry-run] would merge ${branch} into ${currentBranch}\x1b[0m`);
      results.push({ taskId: task.id, branch, status: "merged" });
      continue;
    }

    // Merge
    try {
      git(`merge ${branch} --no-ff -m "merge: #${task.id} ${task.subject}"`, repoRoot);
      console.log(`    \x1b[32m✓\x1b[0m merged`);
    } catch (err: any) {
      // Try to abort merge on conflict
      try { git("merge --abort", repoRoot); } catch {}
      console.log(`    \x1b[31m✗\x1b[0m conflict: ${err.message}`);
      results.push({ taskId: task.id, branch, status: "conflict", error: err.message });
      continue;
    }

    results.push({ taskId: task.id, branch, status: "merged" });
  }

  // Run tests (unless skipped)
  if (!opts.noTest && !opts.dryRun) {
    const mergedCount = results.filter(r => r.status === "merged").length;
    if (mergedCount > 0) {
      console.log(`\n  \x1b[33m── running tests ──\x1b[0m`);
      try {
        // Try npm test first, fall back to bun test
        try {
          execSync("npm test", { cwd: repoRoot, stdio: "inherit", timeout: 120_000 });
        } catch {
          execSync("bun test", { cwd: repoRoot, stdio: "inherit", timeout: 120_000 });
        }
        console.log(`    \x1b[32m✓\x1b[0m tests passed`);
      } catch {
        console.log(`    \x1b[31m✗\x1b[0m tests failed`);
        console.log(`    \x1b[33mhint:\x1b[0m fix tests, then re-run or use --no-test`);
      }
    }
  }

  // Push (unless skipped)
  if (!opts.noPush && !opts.dryRun) {
    const mergedCount = results.filter(r => r.status === "merged").length;
    if (mergedCount > 0) {
      console.log(`\n  \x1b[33m── pushing ──\x1b[0m`);
      try {
        git("push", repoRoot);
        console.log(`    \x1b[32m✓\x1b[0m pushed`);
      } catch (err: any) {
        console.log(`    \x1b[31m✗\x1b[0m push failed: ${err.message}`);
      }
    }
  }

  // Cleanup: remove merged branches + worktrees
  if (!opts.dryRun) {
    for (const r of results) {
      if (r.status === "merged") {
        try { git(`branch -d ${r.branch}`, repoRoot); } catch {}
      }
    }
  }

  // Feed event
  try {
    const { readFileSync } = require("node:fs");
    const cfg = JSON.parse(readFileSync(join(homedir(), ".config", "oracle", "oracle.config.json"), "utf-8"));
    const port = cfg.port || 3456;
    const merged = results.filter(r => r.status === "merged").length;
    const conflicts = results.filter(r => r.status === "conflict").length;
    fetch(`http://localhost:${port}/api/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "TeamMerge",
        oracle: team,
        host: cfg.node || "local",
        message: `merged ${merged} branches, ${conflicts} conflicts`,
        ts: Date.now(),
      }),
    }).catch(() => {});
  } catch {}

  // Summary
  console.log(`\n  \x1b[36m── summary ──\x1b[0m`);
  const merged = results.filter(r => r.status === "merged").length;
  const conflicts = results.filter(r => r.status === "conflict").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  console.log(`    merged:    ${merged}`);
  if (conflicts) console.log(`    conflicts: \x1b[31m${conflicts}\x1b[0m`);
  if (skipped) console.log(`    skipped:   ${skipped}`);
  console.log();
}
