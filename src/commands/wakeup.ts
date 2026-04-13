/**
 * ScheduleWakeup — Chapter 9: The Cron Loop
 *
 * Self-paced re-invocation. Instead of fixed cadence,
 * the agent decides when to resume.
 *
 * Usage (CLI):
 *   oracle wakeup 270 "check build status" [--reason "bun build ~6min"]
 *
 * Usage (SDK/API):
 *   POST /api/wake/schedule — { delaySeconds, prompt, reason }
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const WAKEUP_DIR = join(homedir(), ".oracle", "wake");

interface WakeupEntry {
  id: string;
  scheduledAt: string;
  fireAt: string;
  delaySeconds: number;
  prompt: string;
  reason: string;
  fired: boolean;
}

function ensureDir() { mkdirSync(WAKEUP_DIR, { recursive: true }); }

function nextId(): string {
  ensureDir();
  const files = readdirSync(WAKEUP_DIR).filter((f: string) => f.endsWith(".json"));
  const maxNum = files.reduce((max: number, f: string) => {
    const n = parseInt(f.replace(".json", ""), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return String(maxNum + 1);
}

export function scheduleWakeup(delaySeconds: number, prompt: string, reason: string = ""): WakeupEntry {
  ensureDir();
  const now = new Date();
  const fireAt = new Date(now.getTime() + delaySeconds * 1000);

  const entry: WakeupEntry = {
    id: nextId(),
    scheduledAt: now.toISOString(),
    fireAt: fireAt.toISOString(),
    delaySeconds,
    prompt,
    reason,
    fired: false,
  };

  writeFileSync(join(WAKEUP_DIR, `${entry.id}.json`), JSON.stringify(entry, null, 2));

  // Schedule via at command (Unix) — fire a re-injection
  try {
    const fireTime = fireAt.toISOString().slice(11, 16); // HH:MM
    const fireDate = fireAt.toISOString().slice(0, 10); // YYYY-MM-DD
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    const cmd = `echo "maw hey oracle '${escapedPrompt}'" | at ${fireTime} ${fireDate} 2>/dev/null`;
    execSync(cmd, { stdio: "pipe" });
  } catch {
    console.warn(`\x1b[33m⚠ 'at' command unavailable — wakeup stored but won't auto-fire. Use cron polling.\x1b[0m`);
  }

  return entry;
}

export function listPendingWakeups(): WakeupEntry[] {
  ensureDir();
  const files = readdirSync(WAKEUP_DIR).filter((f: string) => f.endsWith(".json"));
  const now = Date.now();

  return files
    .map((f: string) => {
      try { return JSON.parse(readFileSync(join(WAKEUP_DIR, f), "utf-8")); } catch { return null; }
    })
    .filter((e: WakeupEntry | null): e is WakeupEntry =>
      e !== null && !e.fired && new Date(e.fireAt).getTime() > now
    )
    .sort((a: WakeupEntry, b: WakeupEntry) => a.fireAt.localeCompare(b.fireAt));
}

export function cmdWakeup(args: string[]): void {
  const delayStr = args[0];
  if (!delayStr) {
    console.error("usage: oracle wakeup <delaySeconds> \"prompt\" [--reason \"...\"]");
    process.exit(1);
  }

  const delaySeconds = parseInt(delayStr, 10);
  if (isNaN(delaySeconds) || delaySeconds < 1) {
    console.error("error: delaySeconds must be a positive integer");
    process.exit(1);
  }

  // Collect prompt — everything between delay and first --flag
  const rest = args.slice(1);
  const promptParts: string[] = [];
  let i = 0;
  while (i < rest.length && !rest[i].startsWith("--")) {
    promptParts.push(rest[i]);
    i++;
  }

  if (promptParts.length === 0) {
    console.error("usage: oracle wakeup <delaySeconds> \"prompt\" [--reason \"...\"]");
    process.exit(1);
  }

  const prompt = promptParts.join(" ");

  // Parse flags
  let reason = "";
  const flagArgs = rest.slice(i);
  for (let j = 0; j < flagArgs.length; j++) {
    if (flagArgs[j] === "--reason" && flagArgs[j + 1]) reason = flagArgs[++j];
  }

  const entry = scheduleWakeup(delaySeconds, prompt, reason);
  const fireAt = new Date(entry.fireAt).toLocaleTimeString();

  console.log(`\x1b[32m✓\x1b[0m Wakeup scheduled for ${fireAt} (in ${delaySeconds}s)`);
  if (reason) console.log(`  reason: ${reason}`);
  console.log(`  prompt: ${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}`);
}
