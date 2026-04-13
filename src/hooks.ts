/**
 * Hook System — Guide Ch7: Rule Enforcement
 *
 * Built-in hooks for common rules:
 *   - task-logging: require log entry when task is claimed
 *   - cc-bob: notify the "Bob" (team lead) on key events
 *   - block-merge: prevent merge if tasks incomplete
 *   - auto-tag: tag messages/events by type
 *
 * Also supports external scripts via maw.hooks.json (original pattern).
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { spawn } from "child_process";

// ─── Paths ──────────────────────────────────────────────────────

const ORACLE_DIR = join(homedir(), ".oracle");
const HOOKS_CONFIG = join(ORACLE_DIR, "maw.hooks.json");
const HOOK_LOG = join(ORACLE_DIR, "hook-log.jsonl");

// ─── Hook Types ─────────────────────────────────────────────────

export type HookEvent =
  | "task.claim"
  | "task.complete"
  | "task.block"
  | "meeting.create"
  | "meeting.note"
  | "message.send"
  | "think.propose"
  | "cron.fire"
  | "agent.spawn"
  | "agent.die";

export interface HookContext {
  event: HookEvent;
  from?: string;
  to?: string;
  data: Record<string, any>;
  ts: string;
}

export interface HookResult {
  handled: boolean;
  action?: string;
  message?: string;
}

export type HookHandler = (ctx: HookContext) => Promise<HookResult> | HookResult;

// ─── Built-in Rules ─────────────────────────────────────────────

const builtInRules: Record<string, HookHandler> = {

  // Rule: require task log on claim
  "task-claim-require-log": (ctx) => {
    if (ctx.event !== "task.claim") return { handled: false };
    const hasLog = ctx.data.log || ctx.data.description;
    if (!hasLog) {
      return {
        handled: true,
        action: "warn",
        message: "⚠️  Task claimed without log entry. Use `oracle tasklog add` to document intent.",
      };
    }
    return { handled: false };
  },

  // Rule: notify team lead (Bob) on task completion
  "cc-bob-on-complete": (ctx) => {
    if (ctx.event !== "task.complete") return { handled: false };
    const owner = ctx.data.owner || ctx.from;
    const bob = ctx.data.teamLead || "bob";
    if (owner && owner !== bob) {
      return {
        handled: true,
        action: "notify",
        message: `📋 Task completed by ${owner}: "${ctx.data.subject}" → notifying ${bob}`,
      };
    }
    return { handled: false };
  },

  // Rule: auto-tag meetings
  "auto-tag-meeting": (ctx) => {
    if (ctx.event !== "meeting.create") return { handled: false };
    const topic = (ctx.data.topic || "").toLowerCase();
    const tags: string[] = [];
    if (topic.includes("bug") || topic.includes("fix")) tags.push("bug");
    if (topic.includes("review") || topic.includes("retro")) tags.push("review");
    if (topic.includes("plan") || topic.includes("sprint")) tags.push("planning");
    if (topic.includes("deploy") || topic.includes("release")) tags.push("release");
    if (tags.length) {
      return {
        handled: true,
        action: "tag",
        message: `Auto-tagged meeting: ${tags.join(", ")}`,
      };
    }
    return { handled: false };
  },

  // Rule: block duplicate proposals
  "no-duplicate-think": (ctx) => {
    if (ctx.event !== "think.propose") return { handled: false };
    // Actual duplicate check happens at API level
    // This hook just warns about similar titles
    return { handled: false };
  },
};

// ─── External Hooks ─────────────────────────────────────────────

interface HooksConfig { hooks?: Record<string, string>; }

let configCache: HooksConfig | null = null;

async function loadHooksConfig(): Promise<HooksConfig> {
  if (configCache) return configCache;
  try {
    const raw = await readFile(HOOKS_CONFIG, "utf-8");
    configCache = JSON.parse(raw);
    return configCache!;
  } catch {
    configCache = {};
    return configCache;
  }
}

function expandPath(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

async function runExternalHook(
  event: string,
  data: { from?: string; to: string; message: string; channel?: string },
) {
  const config = await loadHooksConfig();
  const script = config.hooks?.[event];
  if (!script) return;
  const env = {
    ...process.env,
    ORACLE_EVENT: event,
    ORACLE_TIMESTAMP: new Date().toISOString(),
    ORACLE_FROM: data.from || "unknown",
    ORACLE_TO: data.to,
    ORACLE_MESSAGE: data.message,
    ORACLE_CHANNEL: data.channel || "hey",
  };
  try {
    const child = spawn("sh", ["-c", expandPath(script)], { env, stdio: "ignore", detached: true });
    child.unref();
  } catch {}
}

// ─── Core Hook Runner ───────────────────────────────────────────

function logHook(ctx: HookContext, result: HookResult) {
  try {
    if (!existsSync(ORACLE_DIR)) mkdirSync(ORACLE_DIR, { recursive: true });
    const entry = JSON.stringify({
      ts: ctx.ts,
      event: ctx.event,
      from: ctx.from,
      handled: result.handled,
      action: result.action,
      message: result.message,
    });
    appendFileSync(HOOK_LOG, entry + "\n");
  } catch {}
}

export async function runHook(
  event: string,
  data: { from?: string; to: string; message: string; channel?: string },
) {
  const ctx: HookContext = {
    event: event as HookEvent,
    from: data.from,
    to: data.to,
    data: { message: data.message, channel: data.channel },
    ts: new Date().toISOString(),
  };

  // Run built-in rules
  for (const [name, handler] of Object.entries(builtInRules)) {
    try {
      const result = await handler(ctx);
      if (result.handled) {
        logHook(ctx, result);
        // Log to stdout for visibility
        if (result.message) console.log(`[hook:${name}] ${result.message}`);
      }
    } catch {}
  }

  // Run external hook script
  await runExternalHook(event, data);
}

// ─── Hook Engine (richer API) ───────────────────────────────────

export async function runHooks(ctx: HookContext): Promise<HookResult[]> {
  const results: HookResult[] = [];

  for (const [name, handler] of Object.entries(builtInRules)) {
    try {
      const result = await handler(ctx);
      if (result.handled) {
        logHook(ctx, result);
        results.push(result);
      }
    } catch {}
  }

  return results;
}

// ─── Config Management ──────────────────────────────────────────

export async function getHookConfig(): Promise<HooksConfig> {
  return loadHooksConfig();
}

export async function setHook(event: string, script: string): Promise<void> {
  const config = await loadHooksConfig();
  if (!config.hooks) config.hooks = {};
  config.hooks[event] = script;
  if (!existsSync(ORACLE_DIR)) mkdirSync(ORACLE_DIR, { recursive: true });
  writeFileSync(HOOKS_CONFIG, JSON.stringify(config, null, 2));
  configCache = null; // bust cache
}

export async function removeHook(event: string): Promise<boolean> {
  const config = await loadHooksConfig();
  if (!config.hooks?.[event]) return false;
  delete config.hooks[event];
  writeFileSync(HOOKS_CONFIG, JSON.stringify(config, null, 2));
  configCache = null;
  return true;
}

export function listBuiltInRules(): string[] {
  return Object.keys(builtInRules);
}
