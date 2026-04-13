import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { tmux } from "../tmux.js";
import type { MawWS } from "../types.js";

interface TeamData { name: string; description: string; members: any[]; tasks: any[]; alive: boolean; }

const TEAMS_DIR = join(homedir(), ".claude/teams");
const TASKS_DIR = join(homedir(), ".claude/tasks");

async function livePaneIds(): Promise<Set<string>> {
  try {
    const panes = await tmux.listPanes();
    return new Set(panes.map(p => p.id));
  } catch { return new Set(); }
}

function isTeamAlive(members: any[], panes: Set<string>): boolean {
  for (const m of members) {
    if (m.backendType === "tmux" && m.tmuxPaneId && panes.has(m.tmuxPaneId)) return true;
    if (m.backendType === "in-process" && m.cwd && m.cwd.startsWith(homedir()) && m.joinedAt && Date.now() - m.joinedAt < 2 * 60 * 60 * 1000) return true;
    if ((m.agentType === "team-lead" || m.name === "team-lead") && m.cwd?.startsWith(homedir()) && m.joinedAt && Date.now() - m.joinedAt < 2 * 60 * 60 * 1000) return true;
  }
  return false;
}

export async function scanTeams(): Promise<TeamData[]> {
  try {
    const dirs = readdirSync(TEAMS_DIR).filter(d => existsSync(join(TEAMS_DIR, d, "config.json")));
    const panes = await livePaneIds();
    return dirs.map(d => {
      try {
        const config = JSON.parse(readFileSync(join(TEAMS_DIR, d, "config.json"), "utf-8"));
        let tasks: any[] = [];
        try { tasks = readdirSync(join(TASKS_DIR, d)).filter(f => f.endsWith(".json")).map(f => { try { return JSON.parse(readFileSync(join(TASKS_DIR, d, f), "utf-8")); } catch { return null; } }).filter(Boolean); } catch {}
        return { ...config, tasks, alive: isTeamAlive(config.members || [], panes) };
      } catch { return null; }
    }).filter(Boolean) as TeamData[];
  } catch { return []; }
}

export async function broadcastTeams(clients: Set<MawWS>, lastJson: { value: string }): Promise<void> {
  if (clients.size === 0) return;
  const teams = await scanTeams();
  const json = JSON.stringify(teams);
  if (json === lastJson.value) return;
  lastJson.value = json;
  for (const ws of clients) ws.send(JSON.stringify({ type: "teams", teams }));
}
