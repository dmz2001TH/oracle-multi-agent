/**
 * Goal Engine — Goal-oriented task decomposition
 * Takes high-level goals and decomposes them into executable subtasks.
 * Tracks progress, dependencies, and completion.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const GOALS_DIR = join(homedir(), ".oracle", "goals");

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: "pending" | "decomposing" | "in_progress" | "completed" | "failed" | "partial";
  priority: "low" | "normal" | "high" | "critical";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  parentId?: string;           // parent goal if this is a subtask
  tasks: Task[];
  metadata: {
    estimatedComplexity?: "simple" | "moderate" | "complex";
    requiredRoles?: string[];
    deadline?: string;
    context?: string;
  };
}

export interface Task {
  id: string;
  goalId: string;
  title: string;
  description: string;
  assignedTo?: string;         // agent name or role
  status: "pending" | "assigned" | "in_progress" | "completed" | "failed" | "blocked";
  priority: "low" | "normal" | "high" | "critical";
  dependsOn: string[];         // task ids that must complete first
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: string;
  attempts: number;
  maxAttempts: number;
  errorLog: string[];
}

function ensureDir() { mkdirSync(GOALS_DIR, { recursive: true }); }
function goalsFile() { return join(GOALS_DIR, "goals.jsonl"); }
function tasksFile() { return join(GOALS_DIR, "tasks.jsonl"); }

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Goal CRUD ───

export function createGoal(title: string, description: string, opts: {
  priority?: Goal["priority"];
  parentId?: string;
  metadata?: Goal["metadata"];
} = {}): Goal {
  ensureDir();
  const goal: Goal = {
    id: genId("goal"),
    title,
    description,
    status: "pending",
    priority: opts.priority || "normal",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parentId: opts.parentId,
    tasks: [],
    metadata: opts.metadata || {},
  };
  appendFileSync(goalsFile(), JSON.stringify(goal) + "\n");
  return goal;
}

export function getGoal(goalId: string): Goal | null {
  ensureDir();
  if (!existsSync(goalsFile())) return null;
  const lines = readFileSync(goalsFile(), "utf-8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const g = JSON.parse(line);
      if (g.id === goalId) return g;
    } catch {}
  }
  return null;
}

export function listGoals(filter?: { status?: Goal["status"] }): Goal[] {
  ensureDir();
  if (!existsSync(goalsFile())) return [];
  const lines = readFileSync(goalsFile(), "utf-8").split("\n").filter(Boolean);
  return lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter((g): g is Goal => g !== null && (!filter?.status || g.status === filter.status));
}

export function updateGoalStatus(goalId: string, status: Goal["status"]): boolean {
  ensureDir();
  if (!existsSync(goalsFile())) return false;
  const lines = readFileSync(goalsFile(), "utf-8").split("\n").filter(Boolean);
  let found = false;
  const updated = lines.map(l => {
    try {
      const g = JSON.parse(l);
      if (g.id === goalId) {
        g.status = status;
        g.updatedAt = new Date().toISOString();
        if (status === "completed" || status === "failed") g.completedAt = new Date().toISOString();
        found = true;
      }
      return JSON.stringify(g);
    } catch { return l; }
  });
  writeFileSync(goalsFile(), updated.join("\n") + "\n");
  return found;
}

// ─── Auto-Decomposition ───

/**
 * Decompose a goal into subtasks based on complexity analysis.
 * This is the core intelligence — breaking big goals into doable pieces.
 */
export function decomposeGoal(goalId: string, decomposition: {
  title: string;
  description: string;
  assignedTo?: string;
  priority?: Task["priority"];
  dependsOn?: string[];
}[]): Task[] {
  ensureDir();
  const tasks: Task[] = [];

  for (let i = 0; i < decomposition.length; i++) {
    const spec = decomposition[i];
    const task: Task = {
      id: genId("task"),
      goalId,
      title: spec.title,
      description: spec.description,
      assignedTo: spec.assignedTo,
      status: spec.assignedTo ? "assigned" : "pending",
      priority: spec.priority || "normal",
      dependsOn: spec.dependsOn || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: 0,
      maxAttempts: 3,
      errorLog: [],
    };
    tasks.push(task);
    appendFileSync(tasksFile(), JSON.stringify(task) + "\n");
  }

  // Update goal status
  updateGoalStatus(goalId, "in_progress");

  return tasks;
}

// ─── Task CRUD ───

export function getTasksForGoal(goalId: string): Task[] {
  ensureDir();
  if (!existsSync(tasksFile())) return [];
  const lines = readFileSync(tasksFile(), "utf-8").split("\n").filter(Boolean);
  return lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter((t): t is Task => t !== null && t.goalId === goalId);
}

export function getReadyTasks(goalId: string): Task[] {
  const tasks = getTasksForGoal(goalId);
  const completedIds = new Set(tasks.filter(t => t.status === "completed").map(t => t.id));
  return tasks.filter(t =>
    t.status === "pending" &&
    t.dependsOn.every(dep => completedIds.has(dep))
  );
}

export function getBlockedTasks(goalId: string): Task[] {
  const tasks = getTasksForGoal(goalId);
  const completedIds = new Set(tasks.filter(t => t.status === "completed").map(t => t.id));
  return tasks.filter(t =>
    (t.status === "pending" || t.status === "assigned") &&
    t.dependsOn.some(dep => !completedIds.has(dep))
  );
}

export function updateTaskStatus(taskId: string, status: Task["status"], result?: string): boolean {
  ensureDir();
  if (!existsSync(tasksFile())) return false;
  const lines = readFileSync(tasksFile(), "utf-8").split("\n").filter(Boolean);
  let found = false;
  const updated = lines.map(l => {
    try {
      const t = JSON.parse(l);
      if (t.id === taskId) {
        t.status = status;
        t.updatedAt = new Date().toISOString();
        if (status === "completed" || status === "failed") t.completedAt = new Date().toISOString();
        if (result) t.result = result;
        if (status === "failed") {
          t.attempts = (t.attempts || 0) + 1;
          t.errorLog = t.errorLog || [];
          t.errorLog.push(result || "unknown error");
        }
        found = true;
      }
      return JSON.stringify(t);
    } catch { return l; }
  });
  writeFileSync(tasksFile(), updated.join("\n") + "\n");
  return found;
}

export function assignTask(taskId: string, agentName: string): boolean {
  ensureDir();
  if (!existsSync(tasksFile())) return false;
  const lines = readFileSync(tasksFile(), "utf-8").split("\n").filter(Boolean);
  let found = false;
  const updated = lines.map(l => {
    try {
      const t = JSON.parse(l);
      if (t.id === taskId) {
        t.assignedTo = agentName;
        t.status = "assigned";
        t.updatedAt = new Date().toISOString();
        found = true;
      }
      return JSON.stringify(t);
    } catch { return l; }
  });
  writeFileSync(tasksFile(), updated.join("\n") + "\n");
  return found;
}

// ─── Progress Tracking ───

export function getGoalProgress(goalId: string): {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  pending: number;
  blocked: number;
  percent: number;
} {
  const tasks = getTasksForGoal(goalId);
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const failed = tasks.filter(t => t.status === "failed").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const blocked = tasks.filter(t => t.status === "blocked").length;
  const pending = tasks.filter(t => t.status === "pending" || t.status === "assigned").length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, failed, inProgress, pending, blocked, percent };
}

export function formatGoalStatus(goalId: string): string {
  const goal = getGoal(goalId);
  if (!goal) return `Goal ${goalId} not found`;

  const progress = getGoalProgress(goalId);
  const tasks = getTasksForGoal(goalId);

  const lines = [
    `🎯 **${goal.title}** [${goal.status}]`,
    goal.description,
    "",
    `Progress: ${progress.completed}/${progress.total} (${progress.percent}%)`,
    `Failed: ${progress.failed} | Blocked: ${progress.blocked} | Pending: ${progress.pending}`,
    "",
  ];

  for (const t of tasks) {
    const icon = t.status === "completed" ? "✅" : t.status === "failed" ? "❌" : t.status === "in_progress" ? "🔄" : t.status === "blocked" ? "🚧" : "⏳";
    const dep = t.dependsOn.length > 0 ? ` (deps: ${t.dependsOn.length})` : "";
    const agent = t.assignedTo ? ` → ${t.assignedTo}` : "";
    lines.push(`${icon} ${t.title}${agent}${dep}`);
  }

  return lines.join("\n");
}

// ─── Smart Decomposition (keyword-based heuristics) ───

/**
 * Analyze a goal description and suggest decomposition.
 * Uses keyword patterns to determine task structure.
 */
export function suggestDecomposition(goalDescription: string): {
  title: string;
  description: string;
  suggestedRole: string;
  dependsOn?: number[];  // index-based dependencies
}[] {
  const lower = goalDescription.toLowerCase();
  const suggestions: { title: string; description: string; suggestedRole: string; dependsOn?: number[] }[] = [];

  // Research-heavy goal
  if (lower.includes("วิจัย") || lower.includes("research") || lower.includes("วิเคราะห์") || lower.includes("analyze")) {
    suggestions.push(
      { title: "Gather information", description: "Collect data and sources", suggestedRole: "researcher" },
      { title: "Analyze findings", description: "Analyze and identify patterns", suggestedRole: "data-analyst", dependsOn: [0] },
      { title: "Write report", description: "Compile findings into report", suggestedRole: "writer", dependsOn: [1] },
    );
  }

  // Coding goal
  if (lower.includes("เขียน") || lower.includes("implement") || lower.includes("build") || lower.includes("สร้าง") || lower.includes("develop")) {
    suggestions.push(
      { title: "Design architecture", description: "Plan the implementation approach", suggestedRole: "coder" },
      { title: "Implement core logic", description: "Write the main code", suggestedRole: "coder", dependsOn: [0] },
      { title: "Write tests", description: "Create test suite", suggestedRole: "qa-tester", dependsOn: [1] },
      { title: "Review and fix", description: "Code review and bug fixes", suggestedRole: "qa-tester", dependsOn: [2] },
    );
  }

  // Fix/debug goal
  if (lower.includes("แก้") || lower.includes("fix") || lower.includes("debug") || lower.includes("bug")) {
    suggestions.push(
      { title: "Reproduce issue", description: "Identify and reproduce the bug", suggestedRole: "qa-tester" },
      { title: "Root cause analysis", description: "Find the root cause", suggestedRole: "coder", dependsOn: [0] },
      { title: "Implement fix", description: "Apply the fix", suggestedRole: "coder", dependsOn: [1] },
      { title: "Verify fix", description: "Test that the fix works", suggestedRole: "qa-tester", dependsOn: [2] },
    );
  }

  // Deploy goal
  if (lower.includes("deploy") || lower.includes("release") || lower.includes("publish")) {
    suggestions.push(
      { title: "Pre-deploy checks", description: "Run tests and validation", suggestedRole: "qa-tester" },
      { title: "Build artifacts", description: "Create build/package", suggestedRole: "devops", dependsOn: [0] },
      { title: "Deploy to target", description: "Execute deployment", suggestedRole: "devops", dependsOn: [1] },
      { title: "Post-deploy verification", description: "Verify deployment success", suggestedRole: "qa-tester", dependsOn: [2] },
    );
  }

  // Default: if no patterns match, create a simple 3-step plan
  if (suggestions.length === 0) {
    suggestions.push(
      { title: "Understand requirements", description: "Clarify what needs to be done", suggestedRole: "general" },
      { title: "Execute task", description: goalDescription, suggestedRole: "general", dependsOn: [0] },
      { title: "Verify result", description: "Check that the task was completed correctly", suggestedRole: "qa-tester", dependsOn: [1] },
    );
  }

  return suggestions;
}
