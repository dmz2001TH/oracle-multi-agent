import { loadConfig, saveConfig, type TriggerConfig, type TriggerEvent } from "./config.js";
import { logAudit } from "./audit.js";
import { execa } from "execa";

export interface TriggerContext { agent?: string; repo?: string; issue?: string; [key: string]: string | undefined; }

export interface TriggerFireResult {
  trigger: TriggerConfig; action: string; ok: boolean;
  output?: string; error?: string; ts: number;
}

const lastFired = new Map<number, TriggerFireResult>();
const idleTimers = new Map<string, number>();
const agentPrevState = new Map<string, "busy" | "idle">();

function expandAction(action: string, event: TriggerEvent, ctx: TriggerContext): string {
  let result = action.replace(/\{event\}/g, event);
  for (const [key, value] of Object.entries(ctx)) {
    if (value !== undefined) result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

export function getTriggers(): TriggerConfig[] { return loadConfig().triggers || []; }

export function getTriggerHistory(): { index: number; result: TriggerFireResult }[] {
  return [...lastFired.entries()].map(([index, result]) => ({ index, result })).sort((a, b) => b.result.ts - a.result.ts);
}

export async function fire(event: TriggerEvent, ctx: TriggerContext = {}): Promise<TriggerFireResult[]> {
  const triggers = getTriggers();
  const results: TriggerFireResult[] = [];
  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i];
    if (t.on !== event) continue;
    if (t.repo && ctx.repo && t.repo !== ctx.repo) continue;
    if (event === "agent-idle" && t.timeout && ctx.agent) {
      const lastActivity = idleTimers.get(ctx.agent);
      if (lastActivity && (Date.now() - lastActivity) / 1000 < t.timeout) continue;
    }
    const action = expandAction(t.action, event, ctx);
    const result: TriggerFireResult = { trigger: t, action, ok: false, ts: Date.now() };
    try {
      const { stdout, exitCode } = await execa("bash", ["-c", action], { reject: false });
      if (exitCode !== 0) throw new Error(`exit ${exitCode}`);
      result.ok = true; result.output = stdout.trim();
    } catch (err: any) { result.error = err.message?.slice(0, 200) || "unknown"; }
    lastFired.set(i, result); results.push(result);
    logAudit("trigger:fire", [event, t.action, result.ok ? "ok" : "error"], result.ok ? "ok" : result.error);
    if (t.once && result.ok) {
      const config = loadConfig();
      saveConfig({ triggers: (config.triggers || []).filter((_: TriggerConfig, idx: number) => idx !== i) });
    }
  }
  return results;
}

export function markAgentActive(agent: string): void {
  idleTimers.set(agent, Date.now());
  agentPrevState.set(agent, "busy");
}

export async function checkIdleTriggers(): Promise<string[]> {
  const triggers = getTriggers().filter(t => t.on === "agent-idle");
  if (!triggers.length) return [];
  const fired: string[] = [];
  for (const [agent, lastActive] of idleTimers) {
    if (agentPrevState.get(agent) !== "busy") continue;
    const idleSec = (Date.now() - lastActive) / 1000;
    for (const t of triggers) {
      if (t.timeout && idleSec >= t.timeout) {
        const results = await fire("agent-idle", { agent });
        if (results.some(r => r.ok)) { fired.push(agent); agentPrevState.set(agent, "idle"); idleTimers.delete(agent); }
      }
    }
  }
  return fired;
}
