/**
 * Self-Healing System — Error recovery and adaptive retry
 * When agents fail, this system analyzes the error, suggests fixes,
 * and retries with modified approach.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const HEALING_DIR = join(homedir(), ".oracle", "healing");

export interface FailureEvent {
  id: string;
  timestamp: string;
  agentName: string;
  taskId: string;
  goalId?: string;
  action: string;               // what was attempted
  error: string;                // error message
  context: string;              // what led to this
  attempt: number;              // which attempt this is
  maxAttempts: number;
  recovery?: RecoveryAction;
  resolved: boolean;
}

export interface RecoveryAction {
  strategy: "retry" | "alternative" | "decompose" | "escalate" | "skip";
  description: string;
  modifiedAction?: string;      // if retry with changes
  newAgentRole?: string;        // if switching agent
  subtasks?: string[];          // if decomposing
  timestamp: string;
}

export interface HealingPattern {
  errorPattern: string;         // regex or keyword match
  strategy: RecoveryAction["strategy"];
  recommendation: string;
  successRate: number;
  timesApplied: number;
  timesWorked: number;
}

function ensureDir() { mkdirSync(HEALING_DIR, { recursive: true }); }
function failuresFile() { return join(HEALING_DIR, "failures.jsonl"); }
function patternsFile() { return join(HEALING_DIR, "healing-patterns.jsonl"); }

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Failure Recording ───

export function recordFailure(agentName: string, taskId: string, action: string, error: string, context: string, attempt: number, maxAttempts: number, goalId?: string): FailureEvent {
  ensureDir();
  const event: FailureEvent = {
    id: genId("fail"),
    timestamp: new Date().toISOString(),
    agentName,
    taskId,
    goalId,
    action,
    error,
    context,
    attempt,
    maxAttempts,
    resolved: false,
  };

  // Auto-analyze and suggest recovery
  event.recovery = analyzeAndRecover(event);

  appendFileSync(failuresFile(), JSON.stringify(event) + "\n");
  return event;
}

export function markResolved(failureId: string, recoveryUsed: string): void {
  ensureDir();
  if (!existsSync(failuresFile())) return;
  const lines = readFileSync(failuresFile(), "utf-8").split("\n").filter(Boolean);
  const updated = lines.map(l => {
    try {
      const f = JSON.parse(l);
      if (f.id === failureId) {
        f.resolved = true;
      }
      return JSON.stringify(f);
    } catch { return l; }
  });
  writeFileSync(failuresFile(), updated.join("\n") + "\n");
}

// ─── Error Analysis ───

/**
 * Analyze a failure and recommend a recovery strategy.
 */
export function analyzeAndRecover(event: FailureEvent): RecoveryAction {
  const error = event.error.toLowerCase();
  const attempt = event.attempt;
  const maxAttempts = event.maxAttempts;

  // Check known patterns first
  const patterns = getHealingPatterns();
  for (const p of patterns) {
    if (error.includes(p.errorPattern.toLowerCase())) {
      return {
        strategy: p.strategy,
        description: p.recommendation,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Timeout errors → retry with longer timeout
  if (error.includes("timeout") || error.includes("timed out")) {
    return {
      strategy: attempt < maxAttempts ? "retry" : "escalate",
      description: attempt < maxAttempts
        ? `Retry with longer timeout (attempt ${attempt + 1}/${maxAttempts})`
        : "Multiple timeouts — escalate to human or try different approach",
      modifiedAction: event.action + " [extended_timeout]",
      timestamp: new Date().toISOString(),
    };
  }

  // Permission / auth errors → escalate immediately
  if (error.includes("permission") || error.includes("unauthorized") || error.includes("403") || error.includes("401")) {
    return {
      strategy: "escalate",
      description: "Permission denied — need human intervention",
      timestamp: new Date().toISOString(),
    };
  }

  // Not found errors → try alternative
  if (error.includes("not found") || error.includes("404")) {
    return {
      strategy: "alternative",
      description: "Resource not found — try alternative path or method",
      modifiedAction: event.action.replace(/\/[^/]+$/, "/alternative"),
      timestamp: new Date().toISOString(),
    };
  }

  // Parse / format errors → decompose
  if (error.includes("parse") || error.includes("json") || error.includes("syntax") || error.includes("unexpected")) {
    return {
      strategy: attempt < 2 ? "retry" : "decompose",
      description: attempt < 2
        ? "Parse error — retry with cleaned input"
        : "Persistent parse error — decompose into smaller steps",
      subtasks: attempt >= 2 ? [
        "Validate input format",
        "Process step by step",
        "Verify output format",
      ] : undefined,
      timestamp: new Date().toISOString(),
    };
  }

  // Rate limit → retry with backoff
  if (error.includes("rate") || error.includes("429") || error.includes("too many")) {
    return {
      strategy: "retry",
      description: `Rate limited — retry with backoff (attempt ${attempt + 1}/${maxAttempts})`,
      timestamp: new Date().toISOString(),
    };
  }

  // Connection errors → retry
  if (error.includes("connect") || error.includes("econnrefused") || error.includes("network")) {
    return {
      strategy: attempt < maxAttempts ? "retry" : "escalate",
      description: attempt < maxAttempts
        ? "Connection issue — retry after brief delay"
        : "Persistent connection failure — escalate",
      timestamp: new Date().toISOString(),
    };
  }

  // Unknown error → if not too many attempts, retry; otherwise decompose
  if (attempt < maxAttempts) {
    return {
      strategy: "retry",
      description: `Unknown error — retry (attempt ${attempt + 1}/${maxAttempts})`,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    strategy: "decompose",
    description: "Multiple failures — decompose task into smaller pieces and try each separately",
    subtasks: [
      "Break down the task into smallest possible steps",
      "Execute each step individually",
      "Verify each step before proceeding",
    ],
    timestamp: new Date().toISOString(),
  };
}

// ─── Healing Patterns (learned from failures) ───

export function learnHealingPatterns(): HealingPattern[] {
  ensureDir();
  if (!existsSync(failuresFile())) return [];

  const lines = readFileSync(failuresFile(), "utf-8").split("\n").filter(Boolean);
  const all: FailureEvent[] = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  // Group errors by keyword
  const errorGroups: Record<string, { events: FailureEvent[]; resolved: number }> = {};
  for (const event of all) {
    const keywords = event.error.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const kw of keywords) {
      if (!errorGroups[kw]) errorGroups[kw] = { events: [], resolved: 0 };
      errorGroups[kw].events.push(event);
      if (event.resolved) errorGroups[kw].resolved++;
    }
  }

  const patterns: HealingPattern[] = [];
  for (const [keyword, group] of Object.entries(errorGroups)) {
    if (group.events.length < 2) continue;

    const successRate = group.resolved / group.events.length;
    const strategies: Record<string, number> = {};
    for (const e of group.events) {
      if (e.recovery) {
        strategies[e.recovery.strategy] = (strategies[e.recovery.strategy] || 0) + 1;
      }
    }
    const bestStrategy = Object.entries(strategies).sort((a, b) => b[1] - a[1])[0];

    if (bestStrategy) {
      const pattern: HealingPattern = {
        errorPattern: keyword,
        strategy: bestStrategy[0] as RecoveryAction["strategy"],
        recommendation: `For "${keyword}" errors, use strategy: ${bestStrategy[0]}`,
        successRate,
        timesApplied: group.events.length,
        timesWorked: group.resolved,
      };
      patterns.push(pattern);
    }
  }

  // Save learned patterns
  for (const p of patterns) {
    appendFileSync(patternsFile(), JSON.stringify(p) + "\n");
  }

  return patterns;
}

export function getHealingPatterns(): HealingPattern[] {
  ensureDir();
  if (!existsSync(patternsFile())) return [];
  const lines = readFileSync(patternsFile(), "utf-8").split("\n").filter(Boolean);
  return lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// ─── Stats ───

export function getHealingStats(): {
  totalFailures: number;
  resolved: number;
  unresolved: number;
  resolutionRate: number;
  byStrategy: Record<string, { total: number; resolved: number }>;
  commonErrors: { error: string; count: number }[];
} {
  ensureDir();
  if (!existsSync(failuresFile())) {
    return { totalFailures: 0, resolved: 0, unresolved: 0, resolutionRate: 0, byStrategy: {}, commonErrors: [] };
  }

  const lines = readFileSync(failuresFile(), "utf-8").split("\n").filter(Boolean);
  const all: FailureEvent[] = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  const resolved = all.filter(f => f.resolved).length;
  const byStrategy: Record<string, { total: number; resolved: number }> = {};
  const errorCounts: Record<string, number> = {};

  for (const f of all) {
    if (f.recovery) {
      const s = f.recovery.strategy;
      if (!byStrategy[s]) byStrategy[s] = { total: 0, resolved: 0 };
      byStrategy[s].total++;
      if (f.resolved) byStrategy[s].resolved++;
    }

    // Count error keywords
    const words = f.error.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    for (const w of words) {
      errorCounts[w] = (errorCounts[w] || 0) + 1;
    }
  }

  const commonErrors = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([error, count]) => ({ error, count }));

  return {
    totalFailures: all.length,
    resolved,
    unresolved: all.length - resolved,
    resolutionRate: all.length > 0 ? resolved / all.length : 0,
    byStrategy,
    commonErrors,
  };
}
