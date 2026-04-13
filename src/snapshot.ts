import { mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { CONFIG_DIR } from "./paths.js";
import { listSessions } from "./ssh.js";
import { loadConfig } from "./config.js";

export const SNAPSHOT_DIR = join(CONFIG_DIR, "snapshots");
mkdirSync(SNAPSHOT_DIR, { recursive: true });

const MAX_SNAPSHOTS = 720;

export interface SnapshotWindow { name: string; paneCmd?: string; }
export interface SnapshotSession { name: string; windows: SnapshotWindow[]; }
export interface Snapshot {
  timestamp: string; trigger: string; node?: string; sessions: SnapshotSession[];
}

export async function takeSnapshot(trigger: string): Promise<string> {
  const sessions = await listSessions();
  const config = loadConfig();
  const snapshot: Snapshot = {
    timestamp: new Date().toISOString(), trigger,
    node: config.node ?? "local",
    sessions: sessions.map(s => ({ name: s.name, windows: s.windows.map(w => ({ name: w.name })) })),
  };
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filepath = join(SNAPSHOT_DIR, `${ts}.json`);
  writeFileSync(filepath, JSON.stringify(snapshot, null, 2) + "\n");
  pruneSnapshots();
  return filepath;
}

export function listSnapshots(): { file: string; timestamp: string; trigger: string; sessionCount: number; windowCount: number }[] {
  return readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith(".json")).sort().reverse().map(f => {
    try {
      const data: Snapshot = JSON.parse(readFileSync(join(SNAPSHOT_DIR, f), "utf-8"));
      return { file: f, timestamp: data.timestamp, trigger: data.trigger, sessionCount: data.sessions.length, windowCount: data.sessions.reduce((s, x) => s + x.windows.length, 0) };
    } catch { return { file: f, timestamp: "?", trigger: "?", sessionCount: 0, windowCount: 0 }; }
  });
}

export function loadSnapshot(fileOrTimestamp: string): Snapshot | null {
  const files = readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith(".json")).sort().reverse();
  const match = files.find(f => f === fileOrTimestamp || f === `${fileOrTimestamp}.json` || f.startsWith(fileOrTimestamp));
  if (!match) return null;
  try { return JSON.parse(readFileSync(join(SNAPSHOT_DIR, match), "utf-8")); } catch { return null; }
}

export function latestSnapshot(): Snapshot | null {
  const files = readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith(".json")).sort().reverse();
  if (!files.length) return null;
  try { return JSON.parse(readFileSync(join(SNAPSHOT_DIR, files[0]), "utf-8")); } catch { return null; }
}

function pruneSnapshots() {
  const files = readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith(".json")).sort();
  while (files.length > MAX_SNAPSHOTS) { try { unlinkSync(join(SNAPSHOT_DIR, files.shift()!)); } catch {} }
}
