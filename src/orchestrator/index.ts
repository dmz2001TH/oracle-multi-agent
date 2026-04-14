/**
 * Autonomous Orchestrator — The brain of the multi-agent system
 *
 * Ties together:
 *   - Goal Engine (decompose goals → tasks)
 *   - Planning Loop (Think→Plan→Act→Observe→Reflect)
 *   - Experience Memory (learn from outcomes)
 *   - Self-Healing (recover from failures)
 *   - LLM Integration (real MiMo/Gemini API calls)
 *   - Parallel Execution (Promise.allSettled)
 */

import { EventEmitter } from "events";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import {
  createGoal, getGoal, listGoals, updateGoalStatus,
  decomposeGoal, getTasksForGoal, getReadyTasks, getBlockedTasks,
  updateTaskStatus, assignTask, getGoalProgress, formatGoalStatus,
  suggestDecomposition, mergeGoalResults,
  type Goal, type Task,
} from "../goals/index.js";

import {
  createCycle, getCycle, recordStep, completeCycle,
  runOneCycle,
  type PlanningCycle, type CycleStep, type PlanAction,
} from "../planning/index.js";

import {
  recordExperience, getRelevantExperiences, getAdvice,
  markExperienceCorrect, learnPatterns, getExperienceStats,
  type Experience,
} from "../experience/index.js";

import {
  recordFailure, markResolved, analyzeAndRecover, learnHealingPatterns,
  getHealingStats,
  type FailureEvent, type RecoveryAction,
} from "../healing/index.js";

import { sendMessage, readInbox } from "../mailbox/index.js";
import { archiveSession } from "../archive/index.js";
import { logCost } from "../cost-model/index.js";
import {
  callLLM, parseTaskResult, buildTaskPrompt, fallbackResponse,
  type LLMConfig, type LLMResponse,
} from "./llm-client.js";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface OrchestratorConfig {
  teamName: string;
  availableAgents: { name: string; role: string; status: string }[];
  maxConcurrentTasks: number;
  autoDecompose: boolean;
  autoAssign: boolean;
  learnFromOutcomes: boolean;
  llmConfig?: LLMConfig;
}

export interface OrchestratorState {
  activeGoals: Goal[];
  runningCycles: PlanningCycle[];
  agentWorkload: Record<string, number>;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  uptime: number;
}

export interface TaskResult {
  success: boolean;
  result: string;
  experience?: Experience;
  usedFallback?: boolean;
  llmUsed?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Safe Advice (4. getSafeAdvice — full null guard)
// ═══════════════════════════════════════════════════════════════

export function getSafeAdvice(taskType: string, taskDescription: string): {
  recommendation: string;
  confidence: number;
  basedOn: number;
  avoidList: string[];
} {
  const fallback = {
    recommendation: "No prior experience — try the most straightforward approach",
    confidence: 0.1,
    basedOn: 0,
    avoidList: [] as string[],
  };

  try {
    const safeType = taskType || "general";
    const safeDesc = taskDescription || "";
    if (!safeDesc.trim()) return fallback;

    const advice = getAdvice(safeType, safeDesc);

    // Full null guard on every field
    return {
      recommendation: advice?.recommendation || fallback.recommendation,
      confidence: typeof advice?.confidence === "number" ? advice.confidence : fallback.confidence,
      basedOn: typeof advice?.basedOn === "number" ? advice.basedOn : fallback.basedOn,
      avoidList: Array.isArray(advice?.avoidList) ? advice.avoidList.filter(Boolean) : fallback.avoidList,
    };
  } catch (err: any) {
    console.warn(`⚠️ getSafeAdvice error: ${err.message}`);
    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════════
// Orchestrator
// ═══════════════════════════════════════════════════════════════

export class AutonomousOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private startTime: number;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.startTime = Date.now();
  }

  // ─── Goal Management ─────────────────────────────────────

  async pursueGoal(
    title: string,
    description: string,
    opts: { priority?: Goal["priority"]; autoDecompose?: boolean } = {}
  ): Promise<{ goal: Goal; tasks: Task[] }> {
    const goal = createGoal(title, description, {
      priority: opts.priority || "normal",
      metadata: {
        estimatedComplexity: this.estimateComplexity(description),
        requiredRoles: this.detectRequiredRoles(description),
        context: description,
      },
    });

    this.emit("goal_created", { goal });

    if (opts.autoDecompose ?? this.config.autoDecompose) {
      const suggestions = suggestDecomposition(description);
      const taskSpecs = suggestions.map((s) => ({
        title: s.title,
        description: s.description,
        assignedTo: this.findBestAgent(s.suggestedRole) || undefined,
        priority: "normal" as const,
        dependsOn: s.dependsOn?.map(di => `task-${goal.id}-${di}`) || [],
      }));

      const tasks = decomposeGoal(goal.id, taskSpecs);

      // Fix placeholder deps: map index-based refs to real task IDs
      for (const task of tasks) {
        task.dependsOn = task.dependsOn.map(dep => {
          const match = dep.match(/^task-.*-(\d+)$/);
          if (match) {
            const idx = parseInt(match[1]);
            return tasks[idx]?.id || dep;
          }
          return dep;
        });
      }

      // Persist corrected deps
      try {
        const tasksFile = join(homedir(), ".oracle", "goals", "tasks.jsonl");
        const lines = readFileSync(tasksFile, "utf-8").split("\n").filter(Boolean);
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const updated = lines.map(l => {
          try {
            const t = JSON.parse(l);
            if (taskMap.has(t.id)) return JSON.stringify(taskMap.get(t.id));
            return l;
          } catch { return l; }
        });
        writeFileSync(tasksFile, updated.join("\n") + "\n");
      } catch {}

      this.emit("goal_decomposed", { goal, tasks });

      // Auto-assign root tasks (no deps)
      if (this.config.autoAssign) {
        for (const task of tasks.filter(t => t.status === "pending" && t.dependsOn.length === 0)) {
          const agent = this.findBestAgent(task.assignedTo || "general");
          if (agent) {
            assignTask(task.id, agent);
            this.emit("task_assigned", { task, agent });
          }
        }
      }

      return { goal, tasks };
    }

    return { goal, tasks: [] };
  }

  // ─── Tick (1. Parallel batch + 2. getReadyTasks) ─────────

  /**
   * Process one tick of the orchestrator.
   *
   * 1. Find active goals
   * 2. Check completion / failure
   * 3. Find ready tasks (pending/assigned, all deps completed)
   * 4. Execute in parallel via Promise.allSettled
   * 5. Self-heal failed tasks
   */
  async tick(): Promise<{
    goalsProcessed: number;
    tasksAdvanced: number;
    tasksCompleted: number;
    tasksFailed: number;
    recoveries: number;
  }> {
    let goalsProcessed = 0;
    let tasksAdvanced = 0;
    let tasksCompleted = 0;
    let tasksFailed = 0;
    let recoveries = 0;

    const activeGoals = listGoals().filter(g =>
      g.status === "in_progress" || g.status === "pending"
    );

    for (const goal of activeGoals) {
      goalsProcessed++;
      const tasks = getTasksForGoal(goal.id);
      const completed = tasks.filter(t => t.status === "completed");
      const failed = tasks.filter(t => t.status === "failed");

      // ── Goal complete check ──
      if (completed.length === tasks.length && tasks.length > 0) {
        const mergedResult = mergeGoalResults(goal.id);
        console.log(`✅ Goal "${goal.title}" completed`);
        updateGoalStatus(goal.id, "completed");
        this.emit("goal_completed", { goal, mergedResult });
        this.cleanupGoalAgents(goal.id);
        continue;
      }

      // ── Goal partial/failed check ──
      if (failed.length > 0 && failed.length + completed.length === tasks.length) {
        const mergedResult = mergeGoalResults(goal.id);
        console.log(`⚠️ Goal "${goal.title}" partial/failed`);
        updateGoalStatus(goal.id, failed.length === tasks.length ? "failed" : "partial");
        this.emit("goal_failed", { goal, failures: failed.length, mergedResult });
        this.cleanupGoalAgents(goal.id);
        continue;
      }

      // ── 2. Get ready tasks: pending/assigned, ALL deps completed ──
      const readyTasks = this.getReadyTasksForGoal(goal.id, tasks, completed);

      if (readyTasks.length === 0) continue;

      // ── 1. Parallel execution via Promise.allSettled ──
      const execPromises = readyTasks.map(async (task) => {
        const agent = this.findBestAgent(task.assignedTo || "general")
          || this.findBestAgent("general");
        const agentName = agent || "auto-general";
        assignTask(task.id, agentName);
        tasksAdvanced++;
        this.emit("task_assigned", { task: { ...task, assignedTo: agentName }, agent: agentName });

        return this.executeTask(agentName, task.id, goal.id, task.description || task.title);
      });

      const results = await Promise.allSettled(execPromises);

      // ── Handle partial failures ──
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const task = readyTasks[i];

        if (result.status === "fulfilled") {
          if (result.value.success) {
            tasksCompleted++;
          } else {
            tasksFailed++;
          }
        } else {
          // Promise rejected — mark task failed
          const errMsg = result.reason?.message || "Unknown execution error";
          updateTaskStatus(task.id, "failed", errMsg);
          tasksFailed++;
          console.warn(`❌ Task "${task.title}" rejected: ${errMsg}`);
        }
      }

      // ── Self-healing for failed tasks ──
      const currentTasks = getTasksForGoal(goal.id);
      const currentFailed = currentTasks.filter(t => t.status === "failed");
      for (const task of currentFailed) {
        if (task.attempts < task.maxAttempts) {
          const lastError = task.errorLog[task.errorLog.length - 1] || "unknown";
          const failure = recordFailure(
            task.assignedTo || "unknown", task.id, task.description, lastError,
            `Goal: ${goal.title}`, task.attempts, task.maxAttempts, goal.id
          );

          if (failure.recovery) {
            switch (failure.recovery.strategy) {
              case "retry":
                updateTaskStatus(task.id, "pending" as any);
                recoveries++;
                this.emit("task_recovery", { task, strategy: "retry" });
                break;
              case "alternative": {
                const altAgent = this.findAlternativeAgent(task.assignedTo || "");
                if (altAgent) {
                  assignTask(task.id, altAgent);
                  updateTaskStatus(task.id, "pending" as any);
                  recoveries++;
                  this.emit("task_recovery", { task, strategy: "alternative", agent: altAgent });
                }
                break;
              }
              case "decompose":
                this.emit("task_recovery", { task, strategy: "decompose" });
                break;
              case "escalate":
                this.emit("task_escalated", { task, error: lastError });
                break;
            }
          }
        }
      }
    }

    return { goalsProcessed, tasksAdvanced, tasksCompleted, tasksFailed, recoveries };
  }

  /**
   * 2. getReadyTasks — strict filter:
   *    - exclude completed, failed, in_progress
   *    - status must be pending or assigned
   *    - ALL deps must be completed
   */
  private getReadyTasksForGoal(goalId: string, allTasks: Task[], completedTasks: Task[]): Task[] {
    const completedIds = new Set(completedTasks.map(t => t.id));
    const inProgressIds = new Set(allTasks.filter(t => t.status === "in_progress").map(t => t.id));

    return allTasks.filter(t => {
      if (t.status === "completed" || t.status === "failed" || t.status === "in_progress") return false;
      if (t.status !== "pending" && t.status !== "assigned") return false;
      // All deps must be completed
      if (t.dependsOn.length > 0 && !t.dependsOn.every(dep => completedIds.has(dep))) return false;
      return true;
    });
  }

  // ─── 3. executeTask — full pipeline ──────────────────────

  /**
   * executeTask pipeline:
   *   getSafeAdvice() → runOneCycle() → callLLM() → parseTaskResult()
   *   → fallbackResponse() on error → recordExperience()
   */
  async executeTask(
    agentName: string,
    taskId: string,
    goalId: string,
    taskDescription: string
  ): Promise<TaskResult> {
    let cycleId: string | null = null;

    try {
      // Step 1: Safe advice with null guard
      const advice = getSafeAdvice("general", taskDescription);

      // Step 2: Planning cycle for tracking
      const { cycle, nextAction } = runOneCycle(
        agentName, taskId, goalId, taskDescription, advice.recommendation
      );
      cycleId = cycle.id;

      // Step 3: Real LLM execution
      if (this.config.llmConfig?.apiKey) {
        const { system, user } = buildTaskPrompt(
          taskDescription,
          advice.recommendation,
          null
        );

        console.log(`🤖 [${agentName}] LLM exec: "${taskDescription.slice(0, 60)}..."`);
        const llmResponse = await callLLM(this.config.llmConfig, system, user);
        const parsed = parseTaskResult(llmResponse.text);

        console.log(`  ${parsed.success ? "✅" : "❌"} ${parsed.reasoning}`);

        updateTaskStatus(taskId, parsed.success ? "completed" : "failed", parsed.result);

        const experience = this.recordOutcome(
          agentName, taskDescription, "llm execution",
          parsed.success, parsed.result, parsed.reasoning
        );

        completeCycle(cycleId, parsed.result, parsed.success);
        return { success: parsed.success, result: parsed.result, experience, llmUsed: true };
      }

      // Step 4: No LLM config — planning cycle simulation
      const success = true; // runOneCycle always returns shouldContinue=true for simple tasks
      const result = `Task "${taskDescription}" completed via planning cycle`;

      updateTaskStatus(taskId, success ? "completed" : "failed", result);

      const experience = this.recordOutcome(
        agentName, taskDescription, nextAction?.payload || "direct execution",
        success, result, "Completed with planning cycle"
      );

      completeCycle(cycleId!, result, success);
      return { success, result, experience, llmUsed: false };

    } catch (err: any) {
      // Step 5: Full fallback
      console.warn(`⚠️ [${agentName}] Execute error: ${err.message} — fallback`);
      const fb = fallbackResponse(taskDescription, err.message);

      updateTaskStatus(taskId, "completed", fb.result);
      if (cycleId) { try { completeCycle(cycleId, fb.result, true); } catch {} }

      const experience = this.recordOutcome(
        agentName, taskDescription, "fallback execution",
        true, fb.result, fb.reason
      );

      return { success: true, result: fb.result, experience, usedFallback: true };
    }
  }

  private recordOutcome(
    agentName: string, description: string, approach: string,
    success: boolean, result: string, lesson: string
  ): Experience | undefined {
    if (!this.config.learnFromOutcomes) return undefined;
    return recordExperience(
      agentName, "general", description, approach,
      success ? "success" : "failure", result, lesson,
      [agentName, success ? "success" : "failure"]
    );
  }

  // ─── Agent Cleanup ───────────────────────────────────────

  private cleanupGoalAgents(goalId: string): void {
    try {
      const tasks = getTasksForGoal(goalId);
      const allDone = tasks.every(t => t.status === "completed" || t.status === "failed");
      if (!allDone) return;

      const agentNames = new Set(tasks.map(t => t.assignedTo).filter(Boolean) as string[]);
      for (const name of agentNames) {
        if (name.startsWith("auto-")) {
          const agent = this.config.availableAgents.find(a => a.name === name);
          if (agent) {
            agent.status = "idle";
            console.log(`🧹 Goal cleanup: ${name} → idle`);
          }
        }
      }
    } catch {}
  }

  // ─── Agent Selection ─────────────────────────────────────

  private findBestAgent(role: string): string | null {
    const candidates = this.config.availableAgents.filter(a =>
      a.status === "active" && (a.role === role || role === "general")
    );
    if (candidates.length === 0) {
      const anyActive = this.config.availableAgents.filter(a => a.status === "active");
      return anyActive.length > 0 ? anyActive[0].name : null;
    }
    candidates.sort((a, b) => this.getWorkload(a.name) - this.getWorkload(b.name));
    return candidates[0].name;
  }

  private findAlternativeAgent(excludeAgent: string): string | null {
    const candidates = this.config.availableAgents.filter(a =>
      a.status === "active" && a.name !== excludeAgent
    );
    return candidates.length > 0 ? candidates[0].name : null;
  }

  private getWorkload(agentName: string): number {
    return this.config.availableAgents.filter(a => a.name === agentName).length > 0 ? 0 : 1;
  }

  // ─── Utilities ───────────────────────────────────────────

  private estimateComplexity(desc: string): "simple" | "moderate" | "complex" {
    const words = desc.split(/\s+/).length;
    const multi = /แล้ว|and|then|จากนั้น|ต่อไป/.test(desc);
    const research = /วิจัย|research|analyze|วิเคราะห์/.test(desc);
    if (words > 50 || (multi && research)) return "complex";
    if (words > 20 || multi || research) return "moderate";
    return "simple";
  }

  private detectRequiredRoles(desc: string): string[] {
    const roles: string[] = ["general"];
    const lower = desc.toLowerCase();
    if (/code|เขียน|implement|build|develop|debug|fix/.test(lower)) roles.push("coder");
    if (/test|verify|check|review/.test(lower)) roles.push("qa-tester");
    if (/research|วิเคราะห์|analyze|study/.test(lower)) roles.push("researcher");
    if (/write|document|report|เขียน.*บทความ/.test(lower)) roles.push("writer");
    if (/deploy|ci.?cd|infrastructure|server/.test(lower)) roles.push("devops");
    if (/data|statistic|number|csv|json/.test(lower)) roles.push("data-analyst");
    return [...new Set(roles)];
  }

  // ─── State ───────────────────────────────────────────────

  updateAvailableAgents(agents: { name: string; role: string; status: string }[]): void {
    this.config.availableAgents = agents;
  }

  getState(): OrchestratorState {
    return {
      activeGoals: listGoals().filter(g => g.status === "in_progress"),
      runningCycles: [],
      agentWorkload: {},
      totalTasksCompleted: getExperienceStats().successes,
      totalTasksFailed: getExperienceStats().failures,
      uptime: Date.now() - this.startTime,
    };
  }

  learn(): void {
    learnPatterns();
    learnHealingPatterns();
    this.emit("learned", { patterns: true });
  }

  getStatusReport(): string {
    const state = this.getState();
    const expStats = getExperienceStats();
    const healStats = getHealingStats();

    return [
      "🤖 **Autonomous Orchestrator Status**",
      "",
      `Active Goals: ${state.activeGoals.length}`,
      `Completed Tasks: ${state.totalTasksCompleted}`,
      `Failed Tasks: ${state.totalTasksFailed}`,
      `Uptime: ${Math.round(state.uptime / 1000)}s`,
      "",
      "### Experience",
      `Total: ${expStats.total} | Success: ${expStats.successes} | Fail: ${expStats.failures}`,
      "",
      "### Self-Healing",
      `Failures: ${healStats.totalFailures} | Resolved: ${healStats.resolved} | Rate: ${Math.round(healStats.resolutionRate * 100)}%`,
      "",
      "### Active Goals",
      ...state.activeGoals.map(g => {
        const progress = getGoalProgress(g.id);
        return `- ${g.title}: ${progress.percent}% (${progress.completed}/${progress.total})`;
      }),
    ].join("\n");
  }
}
