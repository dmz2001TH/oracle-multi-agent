import { hostExec, listSessions } from "./ssh.js";
import { tmux } from "./tmux.js";
import { loadConfig } from "./config.js";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { FLEET_DIR } from "./paths.js";

export interface WorktreeInfo {
  path: string; branch: string; repo: string; mainRepo: string;
  name: string; status: "active" | "stale" | "orphan";
  tmuxWindow?: string; fleetFile?: string;
}

export async function scanWorktrees(): Promise<WorktreeInfo[]> {
  const config = loadConfig();
  const ghqRoot = config.ghqRoot;
  let wtPaths: string[] = [];
  try { const raw = await hostExec(`find ${ghqRoot} -maxdepth 4 -name '*.wt-*' -type d 2>/dev/null`); wtPaths = raw.split("\n").filter(Boolean); } catch {}
  const sessions = await listSessions();
  const runningWindows = new Set<string>();
  for (const s of sessions) for (const w of s.windows) runningWindows.add(w.name);
  const fleetWindows = new Map<string, string>();
  try {
    for (const file of readdirSync(FLEET_DIR).filter(f => f.endsWith(".json"))) {
      const cfg = JSON.parse(readFileSync(join(FLEET_DIR, file), "utf-8"));
      for (const w of cfg.windows || []) { if (w.repo) fleetWindows.set(w.repo, file); }
    }
  } catch {}
  const results: WorktreeInfo[] = [];
  for (const wtPath of wtPaths) {
    const dirName = wtPath.split("/").pop()!;
    const parts = dirName.split(".wt-");
    if (parts.length < 2) continue;
    const mainRepoName = parts[0]; const wtName = parts[1];
    const relPath = wtPath.replace(ghqRoot + "/", "");
    const parentParts = relPath.split("/"); parentParts.pop();
    const org = parentParts.join("/");
    const mainRepo = `${org}/${mainRepoName}`; const repo = `${org}/${dirName}`;
    let branch = "";
    try { branch = (await hostExec(`git -C '${wtPath}' rev-parse --abbrev-ref HEAD 2>/dev/null`)).trim(); } catch { branch = "unknown"; }
    let tmuxWindow: string | undefined;
    for (const s of sessions) for (const w of s.windows) {
      const taskPart = wtName.replace(/^\d+-/, "");
      if (w.name.endsWith(`-${taskPart}`) || w.name === taskPart) tmuxWindow = w.name;
    }
    results.push({ path: wtPath, branch, repo, mainRepo, name: wtName, status: tmuxWindow ? "active" : "stale", tmuxWindow, fleetFile: fleetWindows.get(repo) });
  }
  return results;
}

export async function cleanupWorktree(wtPath: string): Promise<string[]> {
  const config = loadConfig();
  const log: string[] = [];
  const dirName = wtPath.split("/").pop()!;
  const parts = dirName.split(".wt-");
  if (parts.length < 2) { log.push(`not a worktree: ${dirName}`); return log; }
  const mainRepoName = parts[0]; const relPath = wtPath.replace(config.ghqRoot + "/", "");
  const parentParts = relPath.split("/"); parentParts.pop();
  const org = parentParts.join("/");
  const mainPath = join(config.ghqRoot, org, mainRepoName);
  const sessions = await listSessions();
  const wtName = parts[1]; const taskPart = wtName.replace(/^\d+-/, "");
  for (const s of sessions) for (const w of s.windows) {
    if (w.name.endsWith(`-${taskPart}`) || w.name === taskPart) {
      try { await tmux.killWindow(`${s.name}:${w.name}`); log.push(`killed window ${s.name}:${w.name}`); } catch { log.push(`window already closed: ${w.name}`); }
    }
  }
  let branch = "";
  try { branch = (await hostExec(`git -C '${wtPath}' rev-parse --abbrev-ref HEAD`)).trim(); } catch {}
  try { await hostExec(`git -C '${mainPath}' worktree remove '${wtPath}' --force`); await hostExec(`git -C '${mainPath}' worktree prune`); log.push(`removed worktree ${dirName}`); }
  catch (e: any) { log.push(`worktree remove failed: ${e.message || e}`); }
  if (branch && branch !== "main" && branch !== "HEAD" && branch !== "unknown") {
    try { await hostExec(`git -C '${mainPath}' branch -d '${branch}'`); log.push(`deleted branch ${branch}`); }
    catch { log.push(`branch ${branch} not deleted`); }
  }
  try {
    for (const file of readdirSync(FLEET_DIR).filter(f => f.endsWith(".json"))) {
      const filePath = join(FLEET_DIR, file);
      const cfg = JSON.parse(readFileSync(filePath, "utf-8"));
      const before = cfg.windows?.length || 0;
      cfg.windows = (cfg.windows || []).filter((w: any) => w.repo !== `${org}/${dirName}`);
      if (cfg.windows.length < before) { writeFileSync(filePath, JSON.stringify(cfg, null, 2) + "\n"); log.push(`removed from ${file}`); }
    }
  } catch {}
  return log;
}
