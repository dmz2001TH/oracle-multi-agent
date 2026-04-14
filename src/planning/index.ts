/**
 * Planning Loop — Autonomous agent decision cycle
 * Think → Plan → Act → Observe → Reflect
 * Each agent runs this loop to autonomously complete tasks.
 */

import { EventEmitter } from "events";
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const PLANS_DIR = join(homedir(), ".oracle", "plans");

export type CyclePhase = "think" | "plan" | "act" | "observe" | "reflect";

export interface CycleStep {
  phase: CyclePhase;
  timestamp: string;
  input: string;
  output: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface PlanningCycle {
  id: string;
  agentName: string;
  taskId: string;
  goalId: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed" | "stuck";
  currentPhase: CyclePhase;
  steps: CycleStep[];
  iterations: number;
  maxIterations: number;
  context: string;             // accumulated context across iterations
  finalResult?: string;
}

export interface PlanAction {
  type: "execute_command" | "send_message" | "search" | "spawn_agent" | "archive" | "custom";
  target?: string;             // agent name, command, etc.
  payload: string;             // what to do
  expectedResult?: string;     // what success looks like
}

export interface Plan {
  actions: PlanAction[];
  reasoning: string;           // why this plan
  estimatedSteps: number;
  riskLevel: "low" | "medium" | "high";
}

function ensureDir() { mkdirSync(PLANS_DIR, { recursive: true }); }
function cyclesFile() { return join(PLANS_DIR, "cycles.jsonl"); }

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function now(): string { return new Date().toISOString(); }

// ─── Cycle Management ───

export function createCycle(agentName: string, taskId: string, goalId: string, context: string, maxIterations = 10): PlanningCycle {
  ensureDir();
  const cycle: PlanningCycle = {
    id: genId("cycle"),
    agentName,
    taskId,
    goalId,
    startedAt: now(),
    status: "running",
    currentPhase: "think",
    steps: [],
    iterations: 0,
    maxIterations,
    context,
  };
  appendFileSync(cyclesFile(), JSON.stringify(cycle) + "\n");
  return cycle;
}

export function getCycle(cycleId: string): PlanningCycle | null {
  ensureDir();
  if (!existsSync(cyclesFile())) return null;
  const lines = readFileSync(cyclesFile(), "utf-8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const c = JSON.parse(line);
      if (c.id === cycleId) return c;
    } catch {}
  }
  return null;
}

export function recordStep(cycleId: string, step: CycleStep): void {
  ensureDir();
  if (!existsSync(cyclesFile())) return;
  const lines = readFileSync(cyclesFile(), "utf-8").split("\n").filter(Boolean);
  const updated = lines.map(l => {
    try {
      const c = JSON.parse(l);
      if (c.id === cycleId) {
        c.steps.push(step);
        c.currentPhase = getNextPhase(step.phase);
        c.context += `\n[${step.phase}] ${step.output.slice(0, 200)}`;
        if (step.phase === "reflect") c.iterations++;
        if (c.iterations >= c.maxIterations) {
          c.status = "stuck";
          c.completedAt = now();
        }
      }
      return JSON.stringify(c);
    } catch { return l; }
  });
  writeFileSync(cyclesFile(), updated.join("\n") + "\n");
}

export function completeCycle(cycleId: string, result: string, success: boolean): void {
  ensureDir();
  if (!existsSync(cyclesFile())) return;
  const lines = readFileSync(cyclesFile(), "utf-8").split("\n").filter(Boolean);
  const updated = lines.map(l => {
    try {
      const c = JSON.parse(l);
      if (c.id === cycleId) {
        c.status = success ? "completed" : "failed";
        c.completedAt = now();
        c.finalResult = result;
      }
      return JSON.stringify(c);
    } catch { return l; }
  });
  writeFileSync(cyclesFile(), updated.join("\n") + "\n");
}

function getNextPhase(phase: CyclePhase): CyclePhase {
  const order: CyclePhase[] = ["think", "plan", "act", "observe", "reflect"];
  const idx = order.indexOf(phase);
  return order[(idx + 1) % order.length];
}

// ─── Phase Handlers ───

/**
 * THINK phase: Analyze current situation, understand context
 */
export function thinkPhase(context: string, task: string, previousSteps: CycleStep[]): {
  analysis: string;
  questions: string[];
  insights: string[];
} {
  const recentSteps = previousSteps.slice(-5);
  const failures = recentSteps.filter(s => !s.success);

  return {
    analysis: `Current task: ${task}\nContext: ${context.slice(0, 500)}\nPrevious iterations: ${previousSteps.length}\nFailures: ${failures.length}`,
    questions: failures.length > 0
      ? ["Why did the previous attempt fail?", "What can I try differently?", "Is there a simpler approach?"]
      : ["What is the next step?", "Do I have enough information?", "What could go wrong?"],
    insights: failures.length > 0
      ? [`Previous approach failed ${failures.length} times — need alternative strategy`]
      : ["Ready to proceed with current approach"],
  };
}

/**
 * PLAN phase: Create an action plan based on thinking
 */
export function planPhase(analysis: string, task: string, availableTools: string[]): Plan {
  const lower = task.toLowerCase();

  // Determine plan based on task type
  const actions: PlanAction[] = [];

  if (lower.includes("search") || lower.includes("find") || lower.includes("ค้นหา")) {
    actions.push({ type: "search", payload: `Search for: ${task}`, expectedResult: "Search results found" });
  }

  if (lower.includes("send") || lower.includes("ส่ง") || lower.includes("message")) {
    actions.push({ type: "send_message", payload: task, expectedResult: "Message delivered" });
  }

  if (lower.includes("spawn") || lower.includes("wake") || lower.includes("สร้าง agent")) {
    actions.push({ type: "spawn_agent", payload: task, expectedResult: "Agent spawned" });
  }

  // Always include an execute step
  if (actions.length === 0) {
    actions.push({ type: "execute_command", payload: task, expectedResult: "Task completed" });
  }

  // Add verification step
  actions.push({ type: "custom", payload: "Verify result matches expectation", expectedResult: "Verification passed" });

  return {
    actions,
    reasoning: `Based on task analysis: "${task}". Using ${actions.length} steps.`,
    estimatedSteps: actions.length,
    riskLevel: actions.length > 3 ? "high" : actions.length > 1 ? "medium" : "low",
  };
}

/**
 * ACT phase: Execute the next action in the plan
 */
export function actPhase(plan: Plan, currentStep: number): PlanAction | null {
  return plan.actions[currentStep] || null;
}

/**
 * OBSERVE phase: Check if the action produced expected result
 */
export function observePhase(action: PlanAction, actualResult: string): {
  success: boolean;
  deviation: string;
  suggestion: string;
} {
  const success = actualResult.length > 0 && !actualResult.toLowerCase().includes("error");

  return {
    success,
    deviation: success ? "No deviation" : `Unexpected result: ${actualResult.slice(0, 100)}`,
    suggestion: success
      ? "Continue to next step"
      : "Consider retry with different parameters or alternative approach",
  };
}

/**
 * REFLECT phase: Learn from this iteration
 */
export function reflectPhase(
  steps: CycleStep[],
  task: string
): {
  lesson: string;
  shouldContinue: boolean;
  adjustment: string;
} {
  const recentSteps = steps.slice(-5);
  const failures = recentSteps.filter(s => !s.success);
  const consecutiveFailures = failures.length;

  if (consecutiveFailures >= 3) {
    return {
      lesson: `3+ consecutive failures — current approach is not working`,
      shouldContinue: false,
      adjustment: "Need to completely rethink the approach. Consider asking for help or trying a different strategy.",
    };
  }

  if (failures.length > 0) {
    return {
      lesson: `Some steps failed but not consistently — adjusting parameters`,
      shouldContinue: true,
      adjustment: "Retry failed steps with modified parameters based on error messages",
    };
  }

  return {
    lesson: `All recent steps succeeded — on track`,
    shouldContinue: true,
    adjustment: "Continue with current approach",
  };
}

// ─── Full Cycle Runner ───

/**
 * Run one complete planning cycle (think→plan→act→observe→reflect).
 * Returns the cycle result for the orchestrator to use.
 */
export function runOneCycle(
  agentName: string,
  taskId: string,
  goalId: string,
  task: string,
  context: string,
  previousSteps: CycleStep[] = []
): {
  cycle: PlanningCycle;
  nextAction: PlanAction | null;
  shouldContinue: boolean;
} {
  const cycle = createCycle(agentName, taskId, goalId, context);

  // THINK
  const thinkStart = Date.now();
  const thought = thinkPhase(context, task, previousSteps);
  recordStep(cycle.id, {
    phase: "think",
    timestamp: now(),
    input: task,
    output: JSON.stringify(thought),
    durationMs: Date.now() - thinkStart,
    success: true,
  });

  // PLAN
  const planStart = Date.now();
  const plan = planPhase(thought.analysis, task, ["search", "execute", "send"]);
  recordStep(cycle.id, {
    phase: "plan",
    timestamp: now(),
    input: thought.analysis,
    output: JSON.stringify(plan),
    durationMs: Date.now() - planStart,
    success: true,
  });

  // ACT (first action)
  const action = actPhase(plan, 0);

  // OBSERVE (placeholder — actual result comes from executor)
  const observeStart = Date.now();
  const observation = observePhase(action || { type: "custom", payload: "no-op" }, "pending");
  recordStep(cycle.id, {
    phase: "observe",
    timestamp: now(),
    input: action?.payload || "no action",
    output: JSON.stringify(observation),
    durationMs: Date.now() - observeStart,
    success: observation.success,
  });

  // REFLECT
  const reflectStart = Date.now();
  const reflection = reflectPhase([...previousSteps, ...cycle.steps], task);
  recordStep(cycle.id, {
    phase: "reflect",
    timestamp: now(),
    input: `Steps so far: ${cycle.steps.length}`,
    output: JSON.stringify(reflection),
    durationMs: Date.now() - reflectStart,
    success: true,
  });

  return {
    cycle,
    nextAction: action,
    shouldContinue: reflection.shouldContinue,
  };
}
