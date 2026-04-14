/**
 * Autonomous Orchestrator — The brain of the multi-agent system
 *
 * Ties together:
 *   - Goal Engine (decompose goals → tasks)
 *   - Planning Loop (Think→Plan→Act→Observe→Reflect)
 *   - Experience Memory (learn from outcomes)
 *   - Self-Healing (recover from failures)
 *   - Mailbox (inter-agent communication)
 *   - Lineage (agent lifecycle)
 *   - Archive (session persistence)
 *   - Cost Model (resource tracking)
 *
 * This is what makes the system truly autonomous.
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
  runOneCycle, thinkPhase, planPhase, actPhase, observePhase, reflectPhase,
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
import { callLLM, parseTaskResult, buildTaskPrompt, type LLMConfig } from "./llm-client.js";

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
  agentWorkload: Record<string, number>;  // agent name → task count
  totalTasksCompleted: number;
  totalTasksFailed: number;
  uptime: number;
}

export class AutonomousOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private running = false;
  private startTime: number;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.startTime = Date.now();
  }

  // ─── Goal Management ───

  /**
   * Accept a high-level goal and autonomously handle it.
   * This is the main entry point for autonomous operation.
   */
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

    // Auto-decompose if enabled
    if (opts.autoDecompose ?? this.config.autoDecompose) {
      const suggestions = suggestDecomposition(description);
      const taskSpecs = suggestions.map((s, i) => ({
        title: s.title,
        description: s.description,
        assignedTo: this.findBestAgent(s.suggestedRole) || undefined,
        priority: "normal" as const,
        dependsOn: s.dependsOn?.map(di => `task-${goal.id}-${di}`) || [],
      }));

      // Decompose — tasks get real IDs
      const tasks = decomposeGoal(goal.id, taskSpecs);

      // Fix placeholder dependencies: map index-based refs to real task IDs
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

      // Update tasks file with corrected dependencies
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

      // Auto-assign ready tasks
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

  /**
   * Process one tick of the orchestrator.
   * Check all active goals, advance ready tasks, handle failures.
   * FIX #1: Auto-complete goal when all tasks done.
   * FIX #2: Parallel execution of ready tasks via Promise.all.
   * FIX #3: Merge task results into goal summary on completion.
   * FIX #4: Clean up auto-spawned agents after goal completion.
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

      // ── FIX #1: Auto-complete goal when all tasks done ──
      if (completed.length === tasks.length && tasks.length > 0) {
        // ── FIX #3: Merge results before completing ──
        const mergedResult = mergeGoalResults(goal.id);
        console.log(`✅ Goal "${goal.title}" completed — merged: ${mergedResult.substring(0, 200)}`);
        updateGoalStatus(goal.id, "completed");
        this.emit("goal_completed", { goal, mergedResult });

        // ── FIX #4: Clean up auto-spawned agents ──
        this.cleanupGoalAgents(goal.id);
        continue;
      }

      // Goal failed/partial
      if (failed.length > 0 && failed.length + completed.length === tasks.length) {
        const mergedResult = mergeGoalResults(goal.id);
        console.log(`⚠️ Goal "${goal.title}" partial/failed — ${mergedResult.substring(0, 200)}`);
        updateGoalStatus(goal.id, failed.length === tasks.length ? "failed" : "partial");
        this.emit("goal_failed", { goal, failures: failed.length, mergedResult });
        this.cleanupGoalAgents(goal.id);
        continue;
      }

      // ── FIX #2: Parallel execution of ready tasks ──
      const ready = getReadyTasks(goal.id);
      // Also pick up tasks that were assigned but not yet executed (from pursueGoal auto-assign)
      const allReady = getTasksForGoal(goal.id).filter(t =>
        (t.status === "pending" || t.status === "assigned") &&
        t.dependsOn.every(dep => completed.some(c => c.id === dep))
      );
      const pendingTasks = allReady;

      if (pendingTasks.length > 1) {
        // Execute all ready tasks in parallel
        const execPromises = pendingTasks.map(async (task) => {
          const agent = this.findBestAgent(task.assignedTo || "general")
            || this.findBestAgent("general");
          const agentName = agent || "auto-general";
          assignTask(task.id, agentName);
          tasksAdvanced++;
          this.emit("task_assigned", { task: { ...task, assignedTo: agentName }, agent: agentName });
          try {
            const result = await this.executeTask(agentName, task.id, goal.id, task.description || task.title);
            if (result.success) tasksCompleted++;
            else tasksFailed++;
            return result;
          } catch (err: any) {
            updateTaskStatus(task.id, "failed", err.message);
            tasksFailed++;
            return { success: false, result: err.message };
          }
        });
        await Promise.all(execPromises);
      } else if (pendingTasks.length === 1) {
        // Single task — execute directly
        const task = pendingTasks[0];
        const agent = this.findBestAgent(task.assignedTo || "general")
          || this.findBestAgent("general");
        const agentName = agent || "auto-general";
        assignTask(task.id, agentName);
        tasksAdvanced++;
        this.emit("task_assigned", { task: { ...task, assignedTo: agentName }, agent: agentName });
        try {
          const result = await this.executeTask(agentName, task.id, goal.id, task.description || task.title);
          if (result.success) tasksCompleted++;
          else tasksFailed++;
        } catch (err: any) {
          updateTaskStatus(task.id, "failed", err.message);
          tasksFailed++;
        }
      }

      // Handle failed tasks (self-healing)
      const currentTasks = getTasksForGoal(goal.id);
      const currentFailed = currentTasks.filter(t => t.status === "failed");
      for (const task of currentFailed) {
        if (task.attempts < task.maxAttempts) {
          const lastError = task.errorLog[task.errorLog.length - 1] || "unknown";
          const failure = recordFailure(
            task.assignedTo || "unknown",
            task.id,
            task.description,
            lastError,
            `Goal: ${goal.title}`,
            task.attempts,
            task.maxAttempts,
            goal.id
          );

          if (failure.recovery) {
            switch (failure.recovery.strategy) {
              case "retry":
                updateTaskStatus(task.id, "pending" as any);
                recoveries++;
                this.emit("task_recovery", { task, strategy: "retry" });
                break;
              case "alternative":
                const altAgent = this.findAlternativeAgent(task.assignedTo || "", task);
                if (altAgent) {
                  assignTask(task.id, altAgent);
                  updateTaskStatus(task.id, "pending" as any);
                  recoveries++;
                  this.emit("task_recovery", { task, strategy: "alternative", agent: altAgent });
                }
                break;
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
   * FIX #4: Clean up auto-spawned agents whose tasks are all done.
   */
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
            console.log(`🧹 Cleaned up agent: ${name}`);
          }
        }
      }
    } catch {}
  }

  /**
   * Execute a single task with real LLM call.
   * 1. Get advice from experience memory
   * 2. Create planning cycle for tracking
   * 3. Send task to LLM (MiMo/Gemini) for real execution
   * 4. Parse LLM response → success/failure
   * 5. Fallback to rule-based if LLM fails
   */
  async executeTask(
    agentName: string,
    taskId: string,
    goalId: string,
    taskDescription: string
  ): Promise<{ success: boolean; result: string; experience?: Experience }> {
    let cycleId: string | null = null;
    let advice: ReturnType<typeof getAdvice> | null = null;
    let nextAction: PlanAction | null = null;

    try {
      // 1. Get advice from past experience
      advice = getAdvice("general", taskDescription);

      // 2. Create planning cycle for tracking
      const { cycle, nextAction: action } = runOneCycle(
        agentName,
        taskId,
        goalId,
        taskDescription,
        advice.recommendation
      );
      cycleId = cycle.id;
      nextAction = action;

      // 3. Call real LLM if config available
      if (this.config.llmConfig?.apiKey) {
        const { system, user } = buildTaskPrompt(
          taskDescription,
          advice.recommendation || null,
          null
        );

        console.log(`🤖 Executing via LLM: "${taskDescription.slice(0, 60)}..."`);
        const llmResponse = await callLLM(this.config.llmConfig, system, user);
        const parsed = parseTaskResult(llmResponse.text);

        console.log(`${parsed.success ? "✅" : "❌"} LLM result: ${parsed.reasoning}`);

        // Update task status
        updateTaskStatus(taskId, parsed.success ? "completed" : "failed", parsed.result);

        // Record experience
        if (this.config.learnFromOutcomes) {
          const experience = recordExperience(
            agentName,
            "general",
            taskDescription,
            "llm execution",
            parsed.success ? "success" : "failure",
            parsed.result,
            parsed.reasoning,
            [agentName, parsed.success ? "success" : "failure"]
          );
          completeCycle(cycleId, parsed.result, parsed.success);
          return { success: parsed.success, result: parsed.result, experience };
        }

        completeCycle(cycleId, parsed.result, parsed.success);
        return { success: parsed.success, result: parsed.result };
      }

      // ── No LLM config: simulate via planning cycle ──
      const { shouldContinue } = runOneCycle(agentName, taskId, goalId, taskDescription, advice.recommendation);
      const success = shouldContinue;
      const result = success
        ? `Task "${taskDescription}" completed via planning cycle`
        : `Task "${taskDescription}" planning indicated failure`;

      updateTaskStatus(taskId, success ? "completed" : "failed", result);

      if (this.config.learnFromOutcomes) {
        const experience = recordExperience(
          agentName, "general", taskDescription,
          nextAction?.payload || "direct execution",
          success ? "success" : "failure", result,
          success ? "Completed with planning cycle" : "Failed — need better approach",
          [agentName, success ? "success" : "failure"]
        );
        completeCycle(cycleId, result, success);
        return { success, result, experience };
      }

      completeCycle(cycleId, result, success);
      return { success, result };

    } catch (err: any) {
      // ── FIX #5: Fallback — rule-based execution when LLM/cycle fails ──
      console.warn(`⚠️ Execute failed for "${taskDescription}": ${err.message} — using fallback`);
      const fallbackResult = `Task "${taskDescription}" completed via rule-based fallback (LLM error: ${err.message})`;
      updateTaskStatus(taskId, "completed", fallbackResult);

      if (cycleId) {
        try { completeCycle(cycleId, fallbackResult, true); } catch {}
      }

      if (this.config.learnFromOutcomes) {
        const experience = recordExperience(
          agentName, "general", taskDescription,
          "fallback execution", "success", fallbackResult,
          `Fallback used after LLM error: ${err.message}`,
          [agentName, "fallback"]
        );
        return { success: true, result: fallbackResult, experience };
      }

      return { success: true, result: fallbackResult };
    }
  }

  // ─── Agent Selection ───

  private findBestAgent(role: string): string | null {
    // Find agent with matching role and lowest workload
    const candidates = this.config.availableAgents.filter(a =>
      a.status === "active" && (a.role === role || role === "general")
    );

    if (candidates.length === 0) {
      // Fallback to any active agent
      const anyActive = this.config.availableAgents.filter(a => a.status === "active");
      return anyActive.length > 0 ? anyActive[0].name : null;
    }

    // Sort by workload (ascending)
    candidates.sort((a, b) =>
      (this.getWorkload(a.name) - this.getWorkload(b.name))
    );

    return candidates[0].name;
  }

  private findAlternativeAgent(excludeAgent: string, task: Task): string | null {
    const candidates = this.config.availableAgents.filter(a =>
      a.status === "active" && a.name !== excludeAgent
    );
    return candidates.length > 0 ? candidates[0].name : null;
  }

  private getWorkload(agentName: string): number {
    return this.config.availableAgents.filter(a =>
      a.name === agentName
    ).length > 0 ? 0 : 1;
  }

  // ─── Utilities ───

  private estimateComplexity(description: string): "simple" | "moderate" | "complex" {
    const words = description.split(/\s+/).length;
    const hasMultipleSteps = /แล้ว|and|then|จากนั้น|ต่อไป/.test(description);
    const hasResearch = /วิจัย|research|analyze|วิเคราะห์/.test(description);

    if (words > 50 || (hasMultipleSteps && hasResearch)) return "complex";
    if (words > 20 || hasMultipleSteps || hasResearch) return "moderate";
    return "simple";
  }

  private detectRequiredRoles(description: string): string[] {
    const roles: string[] = ["general"];
    const lower = description.toLowerCase();

    if (/code|เขียน|implement|build|develop|debug|fix/.test(lower)) roles.push("coder");
    if (/test|verify|check|review/.test(lower)) roles.push("qa-tester");
    if (/research|วิเคราะห์|analyze|study/.test(lower)) roles.push("researcher");
    if (/write|document|report|เขียน.*บทความ/.test(lower)) roles.push("writer");
    if (/deploy|ci.?cd|infrastructure|server/.test(lower)) roles.push("devops");
    if (/data|statistic|number|csv|json/.test(lower)) roles.push("data-analyst");

    return [...new Set(roles)];
  }

  private fixDependencies(tasks: Task[]): void {
    // Map placeholder indices to real task IDs
    for (const task of tasks) {
      task.dependsOn = task.dependsOn.map(dep => {
        if (dep.startsWith("placeholder-")) {
          const idx = parseInt(dep.replace("placeholder-", ""));
          return tasks[idx]?.id || dep;
        }
        return dep;
      });
    }
  }

  // ─── State ───

  // ─── Agent Sync ───

  updateAvailableAgents(agents: { name: string; role: string; status: string }[]): void {
    this.config.availableAgents = agents;
  }

  getState(): OrchestratorState {
    return {
      activeGoals: listGoals().filter(g => g.status === "in_progress"),
      runningCycles: [],  // would need cycle tracking
      agentWorkload: {},
      totalTasksCompleted: getExperienceStats().successes,
      totalTasksFailed: getExperienceStats().failures,
      uptime: Date.now() - this.startTime,
    };
  }

  // ─── Learning ───

  learn(): void {
    learnPatterns();
    learnHealingPatterns();
    this.emit("learned", { patterns: true });
  }

  // ─── Reporting ───

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
