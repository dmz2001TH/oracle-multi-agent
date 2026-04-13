import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execaSync } from "execa";
import { CONFIG_FILE } from "./paths.js";
import { refreshContext } from "./lib/context.js";

function detectGhqRoot(): string {
  try {
    const { stdout } = execaSync("ghq", ["root"]);
    const root = stdout.trim();
    const ghRoot = join(root, "github.com");
    try { readFileSync(join(ghRoot, ".")); return ghRoot; } catch { return root; }
  } catch { return join(require("os").homedir(), "Code", "github.com"); }
}

export type TriggerEvent = "issue-close" | "pr-merge" | "agent-idle" | "agent-wake" | "agent-crash";

export interface TriggerConfig {
  on: TriggerEvent;
  repo?: string;
  timeout?: number;
  action: string;
  name?: string;
  once?: boolean;
}

export interface PeerConfig { name: string; url: string; }

export interface MawIntervals {
  capture?: number; sessions?: number; status?: number; teams?: number;
  preview?: number; peerFetch?: number; crashCheck?: number;
}

export interface MawTimeouts {
  http?: number; health?: number; ping?: number; pty?: number;
  workspace?: number; shellInit?: number; wakeRetry?: number; wakeVerify?: number;
}

export interface MawLimits {
  feedMax?: number; feedDefault?: number; feedHistory?: number;
  logsMax?: number; logsDefault?: number; logsTruncate?: number;
  messageTruncate?: number; ptyCols?: number; ptyRows?: number;
}

export interface MawConfig {
  host: string; port: number; ghqRoot: string; oracleUrl: string;
  env: Record<string, string>; commands: Record<string, string>;
  sessions: Record<string, string>; tmuxSocket?: string; peers?: string[];
  idleTimeoutMinutes?: number; federationToken?: string; autoRestart?: boolean;
  triggers?: TriggerConfig[]; node?: string; namedPeers?: PeerConfig[];
  agents?: Record<string, string>; githubOrg?: string; githubOrgs?: string[];
  sessionIds?: Record<string, string>; psiPath?: string;
  tls?: { cert: string; key: string }; intervals?: MawIntervals;
  timeouts?: MawTimeouts; limits?: MawLimits; hmacWindowSeconds?: number; pin?: string;
}

const DEFAULTS: MawConfig = {
  host: "local", port: 3456, ghqRoot: detectGhqRoot(),
  oracleUrl: "http://localhost:47779", env: {}, commands: { default: "claude" }, sessions: {},
};

export const D = {
  intervals: { capture: 50, sessions: 5000, status: 3000, teams: 3000, preview: 2000, peerFetch: 10000, crashCheck: 30000 },
  timeouts: { http: 5000, health: 3000, ping: 5000, pty: 5000, workspace: 5000, shellInit: 3000, wakeRetry: 500, wakeVerify: 3000 },
  limits: { feedMax: 500, feedDefault: 50, feedHistory: 50, logsMax: 500, logsDefault: 50, logsTruncate: 500, messageTruncate: 100, ptyCols: 500, ptyRows: 200 },
  hmacWindowSeconds: 300,
} as const;

export function cfgInterval(key: keyof typeof D.intervals): number {
  return loadConfig().intervals?.[key] ?? D.intervals[key];
}
export function cfgTimeout(key: keyof typeof D.timeouts): number {
  return loadConfig().timeouts?.[key] ?? D.timeouts[key];
}
export function cfgLimit(key: keyof typeof D.limits): number {
  return loadConfig().limits?.[key] ?? D.limits[key];
}
export function cfg<K extends keyof MawConfig>(key: K): MawConfig[K] {
  return loadConfig()[key] ?? (DEFAULTS as MawConfig)[key];
}

let cached: MawConfig | null = null;

function validateConfig(raw: Record<string, unknown>): Partial<MawConfig> {
  const result: Record<string, unknown> = {};
  const warn = (field: string, msg: string) => console.warn(`[oracle] config warning: ${field} ${msg}, using default`);

  if ("host" in raw && typeof raw.host === "string" && raw.host.trim()) result.host = raw.host.trim();
  if ("port" in raw) { const p = Number(raw.port); if (Number.isInteger(p) && p >= 1 && p <= 65535) result.port = p; }
  if ("ghqRoot" in raw && typeof raw.ghqRoot === "string") result.ghqRoot = raw.ghqRoot;
  if ("oracleUrl" in raw && typeof raw.oracleUrl === "string") result.oracleUrl = raw.oracleUrl;
  if ("env" in raw && raw.env && typeof raw.env === "object" && !Array.isArray(raw.env)) result.env = raw.env;
  if ("commands" in raw && raw.commands && typeof raw.commands === "object" && !Array.isArray(raw.commands)) {
    const cmds = raw.commands as Record<string, unknown>;
    if (typeof cmds.default === "string") result.commands = cmds as Record<string, string>;
  }
  if ("sessions" in raw && raw.sessions && typeof raw.sessions === "object" && !Array.isArray(raw.sessions)) result.sessions = raw.sessions;
  if ("tmuxSocket" in raw && typeof raw.tmuxSocket === "string") result.tmuxSocket = raw.tmuxSocket;
  if ("triggers" in raw && Array.isArray(raw.triggers)) {
    result.triggers = raw.triggers.filter((t: any) => t && typeof t === "object" && typeof t.on === "string" && typeof t.action === "string");
  }
  if ("federationToken" in raw && typeof raw.federationToken === "string" && raw.federationToken.length >= 16) result.federationToken = raw.federationToken;
  if ("pin" in raw && typeof raw.pin === "string") result.pin = raw.pin;
  if ("node" in raw && typeof raw.node === "string" && raw.node.trim()) result.node = raw.node.trim();
  if ("namedPeers" in raw && Array.isArray(raw.namedPeers)) {
    result.namedPeers = (raw.namedPeers as any[]).filter((p: any) => p && typeof p.name === "string" && typeof p.url === "string");
  }
  if ("agents" in raw && raw.agents && typeof raw.agents === "object" && !Array.isArray(raw.agents)) result.agents = raw.agents;
  if ("peers" in raw && Array.isArray(raw.peers)) result.peers = raw.peers.filter((p: any) => typeof p === "string");
  if ("githubOrg" in raw && typeof raw.githubOrg === "string") result.githubOrg = raw.githubOrg;
  return result as Partial<MawConfig>;
}

export function loadConfig(): MawConfig {
  if (cached) return cached;
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    cached = { ...DEFAULTS, ...validateConfig(raw) };
  } catch { cached = { ...DEFAULTS }; }
  return cached;
}

export function resetConfig() { cached = null; }

export function saveConfig(update: Partial<MawConfig>) {
  const current = loadConfig();
  const merged = { ...current, ...update };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + "\n", "utf-8");
  resetConfig();
  refreshContext();
  return loadConfig();
}

export function configForDisplay(): MawConfig & { envMasked: Record<string, string> } {
  const config = loadConfig();
  const envMasked: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.env)) {
    envMasked[k] = v.length <= 4 ? "•".repeat(v.length) : v.slice(0, 3) + "•".repeat(Math.min(v.length - 3, 20));
  }
  const result: any = { ...config, env: {}, envMasked };
  if (result.federationToken) result.federationToken = result.federationToken.slice(0, 4) + "•".repeat(12);
  return result;
}

function matchGlob(pattern: string, name: string): boolean {
  if (pattern === name) return true;
  if (pattern.startsWith("*") && name.endsWith(pattern.slice(1))) return true;
  if (pattern.endsWith("*") && name.startsWith(pattern.slice(0, -1))) return true;
  return false;
}

export function buildCommand(agentName: string): string {
  const config = loadConfig();
  let cmd = config.commands.default || "claude";
  for (const [pattern, command] of Object.entries(config.commands)) {
    if (pattern === "default") continue;
    if (matchGlob(pattern, agentName)) { cmd = command; break; }
  }
  const sessionIds: Record<string, string> = (config as any).sessionIds || {};
  const sessionId = sessionIds[agentName] || Object.entries(sessionIds).find(([p]) => p !== "default" && matchGlob(p, agentName))?.[1];
  if (sessionId) {
    if (cmd.includes("--continue")) cmd = cmd.replace(/\s*--continue\b/, ` --resume "${sessionId}"`);
    else cmd += ` --resume "${sessionId}"`;
  }
  return cmd;
}

export function getEnvVars(): Record<string, string> { return loadConfig().env || {}; }

export function buildCommandInDir(agentName: string, cwd: string): string {
  return `cd '${cwd}'"' && { ${buildCommand(agentName)}; }`;
}
