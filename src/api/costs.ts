import { Hono } from "hono";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export const costsApi = new Hono();

const COST_PER_MTOK: Record<string, { input: number; output: number }> = {
  opus: { input: 15, output: 75 }, sonnet: { input: 3, output: 15 }, haiku: { input: 0.25, output: 1.25 },
};

function modelTier(model: string): string { if (model.includes("opus")) return "opus"; if (model.includes("haiku")) return "haiku"; return "sonnet"; }

function agentNameFromDir(dir: string): string {
  const parts = dir.replace(/^-/, "").split("-");
  const ghIdx = parts.indexOf("github");
  if (ghIdx >= 0 && parts[ghIdx + 1] === "com" && parts.length > ghIdx + 3) return parts.slice(ghIdx + 2).join("-");
  return parts.slice(-2).join("-");
}

costsApi.get("/api/costs", (c) => {
  const projectsDir = join(homedir(), ".claude", "projects");
  let dirs: string[];
  try { dirs = readdirSync(projectsDir).filter((d) => { try { return statSync(join(projectsDir, d)).isDirectory(); } catch { return false; } }); }
  catch { return c.json({ agents: [], total: { tokens: 0, cost: 0, sessions: 0, agents: 0 } }); }

  const agents: Record<string, any> = {};
  for (const dir of dirs) {
    const dirPath = join(projectsDir, dir);
    let files: string[]; try { files = readdirSync(dirPath).filter(f => f.endsWith(".jsonl")); } catch { continue; }
    if (!files.length) continue;
    const agentName = agentNameFromDir(dir);
    if (!agents[agentName]) agents[agentName] = { name: agentName, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreateTokens: 0, totalTokens: 0, estimatedCost: 0, sessions: 0, turns: 0, models: {}, lastActive: "" };
    for (const file of files) {
      try {
        const lines = readFileSync(join(dirPath, file), "utf-8").split("\n").filter(Boolean);
        for (const line of lines) {
          let obj: any; try { obj = JSON.parse(line); } catch { continue; }
          if (obj.type !== "assistant" || !obj.message?.usage) continue;
          const u = obj.message.usage;
          const a = agents[agentName];
          a.inputTokens += u.input_tokens || 0; a.outputTokens += u.output_tokens || 0;
          a.cacheReadTokens += u.cache_read_input_tokens || 0; a.cacheCreateTokens += u.cache_creation_input_tokens || 0;
          a.totalTokens += (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
          a.turns++;
          const tier = modelTier(obj.message.model || ""); a.models[tier] = (a.models[tier] || 0) + 1;
          if (obj.timestamp > a.lastActive) a.lastActive = obj.timestamp;
        }
        agents[agentName].sessions++;
      } catch {}
    }
  }
  for (const a of Object.values(agents)) {
    const rates = COST_PER_MTOK[modelTier("")];
    a.estimatedCost = ((a.inputTokens + a.cacheReadTokens + a.cacheCreateTokens) / 1e6) * rates.input + (a.outputTokens / 1e6) * rates.output;
  }
  const agentList = Object.values(agents).filter((a: any) => a.sessions > 0).sort((a: any, b: any) => b.estimatedCost - a.estimatedCost);
  return c.json({ agents: agentList, total: { tokens: agentList.reduce((s: number, a: any) => s + a.totalTokens, 0), cost: agentList.reduce((s: number, a: any) => s + a.estimatedCost, 0), sessions: agentList.reduce((s: number, a: any) => s + a.sessions, 0), agents: agentList.length } });
});
