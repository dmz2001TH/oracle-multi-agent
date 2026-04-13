import { Hono } from "hono";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { cfgLimit } from "../config.js";

export const logsApi = new Hono();

function agentFromDir(dirName: string): string {
  const parts = dirName.replace(/^-/, "").split("-");
  const ghIdx = parts.indexOf("github");
  if (ghIdx >= 0 && parts[ghIdx + 1] === "com" && parts.length > ghIdx + 3) return parts.slice(ghIdx + 2).join("-");
  return parts.slice(-2).join("-");
}

logsApi.get("/api/logs", (c) => {
  const q = c.req.query("q") || "";
  const agentFilter = c.req.query("agent") || "";
  const limit = Math.min(+(c.req.query("limit") || String(cfgLimit("logsDefault"))) || cfgLimit("logsDefault"), cfgLimit("logsMax"));
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) return c.json({ entries: [], total: 0 });

  const results: any[] = [];
  let dirs: string[]; try { dirs = readdirSync(projectsDir); } catch { return c.json({ entries: [], total: 0 }); }

  for (const dir of dirs) {
    const agent = agentFromDir(dir);
    if (agentFilter && !agent.toLowerCase().includes(agentFilter.toLowerCase())) continue;
    const dirPath = join(projectsDir, dir);
    try { if (!statSync(dirPath).isDirectory()) continue; } catch { continue; }
    for (const file of readdirSync(dirPath).filter(f => f.endsWith(".jsonl"))) {
      try {
        const lines = readFileSync(join(dirPath, file), "utf-8").split("\n").filter(Boolean);
        for (let i = lines.length - 1; i >= 0 && results.length < limit; i--) {
          if (q && !lines[i].toLowerCase().includes(q.toLowerCase())) continue;
          try { const parsed = JSON.parse(lines[i]); if (parsed.type === "file-history-snapshot") continue; results.push({ agent, type: parsed.type, timestamp: parsed.timestamp }); } catch {}
        }
      } catch {}
      if (results.length >= limit) break;
    }
    if (results.length >= limit) break;
  }
  return c.json({ entries: results, total: results.length });
});

logsApi.get("/api/logs/agents", (c) => {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) return c.json({ agents: [], total: 0 });
  const agentMap = new Map<string, { files: number; lines: number; lastModified: string | null }>();
  let dirs: string[]; try { dirs = readdirSync(projectsDir); } catch { return c.json({ agents: [], total: 0 }); }
  for (const dir of dirs) {
    const dirPath = join(projectsDir, dir);
    try { if (!statSync(dirPath).isDirectory()) continue; } catch { continue; }
    const agent = agentFromDir(dir);
    const existing = agentMap.get(agent) || { files: 0, lines: 0, lastModified: null };
    for (const file of readdirSync(dirPath).filter(f => f.endsWith(".jsonl"))) {
      existing.files++;
      try { existing.lines += readFileSync(join(dirPath, file), "utf-8").split("\n").filter(Boolean).length; } catch {}
      try { const mtime = statSync(join(dirPath, file)).mtime.toISOString(); if (!existing.lastModified || mtime > existing.lastModified) existing.lastModified = mtime; } catch {}
    }
    agentMap.set(agent, existing);
  }
  const agents = [...agentMap.entries()].map(([name, stats]) => ({ name, ...stats })).sort((a, b) => (b.lastModified || "").localeCompare(a.lastModified || ""));
  return c.json({ agents, total: agents.length });
});
