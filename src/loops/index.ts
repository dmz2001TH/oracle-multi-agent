/**
 * Loops — Scheduled tasks with cron-like scheduling
 *
 * Inspired by maw's loop system:
 *   - CronCreate — fixed interval, external trigger
 *   - ScheduleWakeup — dynamic, self-triggered
 *   - Each firing is stateless — state lives on disk
 *   - Sentinel termination (stop when condition met)
 */

import { EventEmitter } from "events";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DATA_DIR = process.env.ORACLE_DATA_DIR || join(homedir(), ".oracle");
const LOOPS_FILE = join(DATA_DIR, "loops.jsonl");

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface Loop {
  id: string;
  name: string;
  description: string;
  agent: string; // which agent runs this
  schedule: string; // cron expression: "*/5 * * * *"
  prompt: string; // what to do on each firing
  enabled: boolean;
  requireIdle: boolean; // wait until agent is idle
  lastRun?: number;
  nextRun?: number;
  runCount: number;
  successCount: number;
  failCount: number;
  createdAt: number;
  history: LoopRun[];
}

export interface LoopRun {
  id: string;
  loopId: string;
  startedAt: number;
  completedAt?: number;
  success?: boolean;
  output?: string;
  error?: string;
}

export interface ScheduleWakeup {
  id: string;
  agentName: string;
  delaySeconds: number;
  prompt: string;
  reason: string;
  scheduledAt: number;
  wakeAt: number;
  triggered: boolean;
}

// ═══════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════

const loops: Map<string, Loop> = new Map();
const wakeups: Map<string, ScheduleWakeup> = new Map();
const timers: Map<string, ReturnType<typeof setInterval>> = new Map();
const loopsBus = new EventEmitter();

let idCounter = 0;
function nextId(prefix: string = "loop"): string {
  return `${prefix}-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

function ensureDir(): void {
  const dir = join(DATA_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function persist(): void {
  ensureDir();
  const lines = [...loops.values()].map(l => JSON.stringify(l));
  writeFileSync(LOOPS_FILE, lines.join("\n") + "\n");
}

function load(): void {
  if (!existsSync(LOOPS_FILE)) return;
  readFileSync(LOOPS_FILE, "utf-8").split("\n").filter(Boolean).forEach(l => {
    try {
      const loop = JSON.parse(l) as Loop;
      loops.set(loop.id, loop);
      if (loop.enabled) scheduleTimer(loop);
    } catch {}
  });
}

load();

// ═══════════════════════════════════════════════════════════
// Cron Expression Parser (simple)
// ═══════════════════════════════════════════════════════════

/**
 * Parse simple cron expressions and return next fire time (ms)
 * Supports: star-slash-N (every N) and M H patterns
 * Fields: Minute Hour DayOfMonth Month DayOfWeek
 */
export function nextCronFire(cronExpr: string, from: number = Date.now()): number {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Invalid cron: ${cronExpr}`);

  const [minExpr, hourExpr, , , dowExpr] = parts;
  const from_date = new Date(from);

  // Search next 7 days (10080 minutes)
  for (let offset = 1; offset <= 10080; offset++) {
    const candidate = new Date(from + offset * 60000);
    const m = candidate.getMinutes();
    const h = candidate.getHours();
    const dow = candidate.getDay();

    if (!matchCron(minExpr, m)) continue;
    if (!matchCron(hourExpr, h)) continue;
    if (dowExpr !== "*" && !matchCron(dowExpr, dow)) continue;

    return candidate.getTime();
  }

  return from + 7 * 24 * 60 * 60 * 1000; // fallback: 1 week
}

function matchCron(expr: string, value: number): boolean {
  if (expr === "*") return true;
  if (expr.startsWith("*/")) {
    const step = parseInt(expr.slice(2));
    return step > 0 && value % step === 0;
  }
  if (expr.includes(",")) {
    return expr.split(",").some(e => matchCron(e.trim(), value));
  }
  if (expr.includes("-")) {
    const [start, end] = expr.split("-").map(Number);
    return value >= start && value <= end;
  }
  return parseInt(expr) === value;
}

// ═══════════════════════════════════════════════════════════
// CronCreate — fixed interval scheduling
// ═══════════════════════════════════════════════════════════

export function createLoop(params: {
  name: string;
  description?: string;
  agent: string;
  schedule: string;
  prompt: string;
  requireIdle?: boolean;
}): Loop {
  const id = nextId("loop");
  const nextRun = nextCronFire(params.schedule);

  const loop: Loop = {
    id,
    name: params.name,
    description: params.description || "",
    agent: params.agent,
    schedule: params.schedule,
    prompt: params.prompt,
    enabled: true,
    requireIdle: params.requireIdle ?? true,
    nextRun,
    runCount: 0,
    successCount: 0,
    failCount: 0,
    createdAt: Date.now(),
    history: [],
  };

  loops.set(id, loop);
  scheduleTimer(loop);
  persist();
  loopsBus.emit("loop:created", loop);
  return loop;
}

function scheduleTimer(loop: Loop): void {
  // Clear existing timer
  const existing = timers.get(loop.id);
  if (existing) clearInterval(existing);

  // Calculate interval from cron (use first fire as reference)
  const interval = Math.max(60000, (loop.nextRun || Date.now()) - Date.now());

  // Use a check interval (every 30s) to see if it's time to fire
  const timer = setInterval(() => {
    if (!loop.enabled) return;
    const now = Date.now();
    if (loop.nextRun && now >= loop.nextRun) {
      fireLoop(loop);
    }
  }, 30000);

  timers.set(loop.id, timer);
}

async function fireLoop(loop: Loop): Promise<void> {
  const runId = nextId("run");
  const run: LoopRun = {
    id: runId,
    loopId: loop.id,
    startedAt: Date.now(),
  };

  loop.history.push(run);
  loop.runCount++;
  loop.lastRun = Date.now();
  loop.nextRun = nextCronFire(loop.schedule, Date.now());

  loopsBus.emit("loop:firing", { loop, run });

  // The actual firing is delegated to the orchestrator via event
  // The loop system doesn't execute prompts — it triggers events
  // that the orchestrator listens to and creates goals/tasks from
  loopsBus.emit("loop:execute", {
    loop,
    run,
    prompt: loop.prompt,
    agent: loop.agent,
  });

  persist();
}

export function getLoop(loopId: string): Loop | undefined {
  return loops.get(loopId);
}

export function listLoops(enabledOnly: boolean = false): Loop[] {
  let result = [...loops.values()];
  if (enabledOnly) result = result.filter(l => l.enabled);
  return result.sort((a, b) => (a.nextRun || Infinity) - (b.nextRun || Infinity));
}

export function enableLoop(loopId: string): boolean {
  const loop = loops.get(loopId);
  if (!loop) return false;
  loop.enabled = true;
  loop.nextRun = nextCronFire(loop.schedule);
  scheduleTimer(loop);
  persist();
  loopsBus.emit("loop:enabled", loop);
  return true;
}

export function disableLoop(loopId: string): boolean {
  const loop = loops.get(loopId);
  if (!loop) return false;
  loop.enabled = false;
  const timer = timers.get(loopId);
  if (timer) { clearInterval(timer); timers.delete(loopId); }
  persist();
  loopsBus.emit("loop:disabled", loop);
  return true;
}

export function deleteLoop(loopId: string): boolean {
  const loop = loops.get(loopId);
  if (!loop) return false;
  const timer = timers.get(loopId);
  if (timer) { clearInterval(timer); timers.delete(loopId); }
  loops.delete(loopId);
  persist();
  loopsBus.emit("loop:deleted", loop);
  return true;
}

export function triggerLoop(loopId: string): boolean {
  const loop = loops.get(loopId);
  if (!loop) return false;
  fireLoop(loop);
  return true;
}

export function getLoopHistory(loopId: string, limit: number = 20): LoopRun[] {
  const loop = loops.get(loopId);
  if (!loop) return [];
  return loop.history.slice(-limit);
}

// ═══════════════════════════════════════════════════════════
// ScheduleWakeup — dynamic self-pacing
// ═══════════════════════════════════════════════════════════

export function scheduleWakeup(params: {
  agentName: string;
  delaySeconds: number;
  prompt: string;
  reason: string;
}): ScheduleWakeup {
  const wakeup: ScheduleWakeup = {
    id: nextId("wake"),
    agentName: params.agentName,
    delaySeconds: params.delaySeconds,
    prompt: params.prompt,
    reason: params.reason,
    scheduledAt: Date.now(),
    wakeAt: Date.now() + params.delaySeconds * 1000,
    triggered: false,
  };
  wakeups.set(wakeup.id, wakeup);

  setTimeout(() => {
    if (!wakeup.triggered) {
      wakeup.triggered = true;
      loopsBus.emit("wakeup:triggered", wakeup);
    }
  }, params.delaySeconds * 1000);

  return wakeup;
}

export function listWakeups(): ScheduleWakeup[] {
  return [...wakeups.values()]
    .filter(w => !w.triggered)
    .sort((a, b) => a.wakeAt - b.wakeAt);
}

// ═══════════════════════════════════════════════════════════
// Format
// ═══════════════════════════════════════════════════════════

export function formatLoops(): string {
  const all = listLoops();
  if (all.length === 0) return "No loops configured. Use POST /api/loops to create one.";

  const lines: string[] = ["🔄 Loops — Scheduled Tasks", "═".repeat(50)];
  for (const loop of all) {
    const status = loop.enabled ? "✓" : "✗";
    const lastRun = loop.lastRun ? new Date(loop.lastRun).toLocaleTimeString() : "never";
    const nextRun = loop.nextRun ? new Date(loop.nextRun).toLocaleTimeString() : "N/A";
    lines.push(`${status} ${loop.name} [${loop.agent}]`);
    lines.push(`  ${loop.description}`);
    lines.push(`  ${loop.schedule} | last: ${lastRun} | next: ${nextRun}`);
    lines.push(`  runs: ${loop.runCount} | ✅ ${loop.successCount} | ❌ ${loop.failCount}`);
  }
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════
// Stats
// ═══════════════════════════════════════════════════════════

export function getLoopStats(): {
  totalLoops: number;
  enabledLoops: number;
  totalRuns: number;
  totalWakeups: number;
} {
  const all = [...loops.values()];
  return {
    totalLoops: all.length,
    enabledLoops: all.filter(l => l.enabled).length,
    totalRuns: all.reduce((s, l) => s + l.runCount, 0),
    totalWakeups: wakeups.size,
  };
}

// ═══════════════════════════════════════════════════════════
// Event Bus
// ═══════════════════════════════════════════════════════════

export function onLoopEvent(event: string, handler: (...args: any[]) => void): () => void {
  loopsBus.on(event, handler);
  return () => loopsBus.off(event, handler);
}
