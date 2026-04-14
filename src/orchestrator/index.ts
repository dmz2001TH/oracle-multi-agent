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
import {
  createGoal, getGoal, listGoals, updateGoalStatus,
  decomposeGoal, getTasksForGoal, getReadyTasks, getBlockedTasks,
  updateTaskStatus, assignTask, getGoalProgress, formatGoalStatus,
  suggestDecomposition,
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

export interface OrchestratorConfig {
  teamName: string;
  availableAgents: { name: string; role: string; status: string }[];
  maxConcurrentTasks: number;
  autoDecompose: boolean;
  autoAssign: boolean;
  learnFromOutcomes: boolean;
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
        dependsOn: s.dependsOn?.map(di => `placeholder-${di}`) || [],
      }));

      // Decompose
      const tasks = decomposeGoal(goal.id, taskSpecs);

      // Fix placeholder dependencies with real task IDs
      this.fixDependencies(tasks);

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

      // Get ready tasks (dependencies met)
      const ready = getReadyTasks(goal.id);
      const blocked = getBlockedTasks(goal.id);
      const tasks = getTasksForGoal(goal.id);

      // Check if all tasks are done
      const completed = tasks.filter(t => t.status === "completed");
      const failed = tasks.filter(t => t.status === "failed");

      if (completed.length === tasks.length && tasks.length > 0) {
        updateGoalStatus(goal.id, "completed");
        this.emit("goal_completed", { goal });
        continue;
      }

      if (failed.length > 0 && failed.length + completed.length === tasks.length) {
        updateGoalStatus(goal.id, failed.length === tasks.length ? "failed" : "partial");
        this.emit("goal_failed", { goal, failures: failed.length });
        continue;
      }

      // Advance ready tasks
      for (const task of ready) {
        if (task.status === "pending") {
          // Assign to best agent
          const agent = this.findBestAgent(task.assignedTo || "general");
          if (agent) {
            assignTask(task.id, agent);
            tasksAdvanced++;
            this.emit("task_assigned", { task: { ...task, assignedTo: agent }, agent });
          }
        }
      }

      // Handle failed tasks (self-healing)
      for (const task of failed) {
        if (task.attempts < task.maxAttempts) {
          // Get recovery strategy
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
                // Reset to pending for retry
                updateTaskStatus(task.id, "pending" as any);
                recoveries++;
                this.emit("task_recovery", { task, strategy: "retry" });
                break;
              case "alternative":
                // Reassign to different agent
                const altAgent = this.findAlternativeAgent(task.assignedTo || "", task);
                if (altAgent) {
                  assignTask(task.id, altAgent);
                  updateTaskStatus(task.id, "pending" as any);
                  recoveries++;
                  this.emit("task_recovery", { task, strategy: "alternative", agent: altAgent });
                }
                break;
              case "decompose":
                // Break into subtasks
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
   * Execute a single task with full planning cycle.
   * This is what an agent calls to autonomously complete a task.
   */
  async executeTask(
    agentName: string,
    taskId: string,
    goalId: string,
    taskDescription: string
  ): Promise<{ success: boolean; result: string; experience?: Experience }> {
    // Get advice from past experience
    const advice = getAdvice("general", taskDescription);

    // Create planning cycle
    const { cycle, nextAction, shouldContinue } = runOneCycle(
      agentName,
      taskId,
      goalId,
      taskDescription,
      advice.recommendation
    );

    // Execute the action (this would be the actual LLM call)
    // For now, simulate execution
    const success = shouldContinue;
    const result = success
      ? `Task "${taskDescription}" completed successfully`
      : `Task "${taskDescription}" failed — ${advice.avoidList.length > 0 ? "avoid: " + advice.avoidList[0] : "no clear fix"}`;

    // Update task status
    updateTaskStatus(taskId, success ? "completed" : "failed", result);

    // Record experience
    if (this.config.learnFromOutcomes) {
      const experience = recordExperience(
        agentName,
        "general",
        taskDescription,
        nextAction?.payload || "direct execution",
        success ? "success" : "failure",
        result,
        success ? "Completed with planning cycle" : "Failed despite planning — need better approach",
        [agentName, success ? "success" : "failure"]
      );

      // Complete the planning cycle
      completeCycle(cycle.id, result, success);

      return { success, result, experience };
    }

    completeCycle(cycle.id, result, success);
    return { success, result };
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
