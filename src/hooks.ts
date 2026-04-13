import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { spawn } from "child_process";

const CONFIG_PATH = join(homedir(), ".oracle", "maw.hooks.json");

interface HooksConfig { hooks?: Record<string, string>; }

let configCache: HooksConfig | null = null;

async function loadHooksConfig(): Promise<HooksConfig> {
  if (configCache) return configCache;
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    configCache = JSON.parse(raw);
    return configCache!;
  } catch { configCache = {}; return configCache; }
}

function expandPath(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

export async function runHook(
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
