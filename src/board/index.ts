/**
 * Task Board — Kanban-style task tracking with logs and timeline
 *
 * Inspired by maw's task system:
 *   - TaskCreate / TaskList / TaskUpdate / TaskGet
 *   - Task log entries (start, commit, blocker, done)
 *   - Project grouping
 *   - Kanban view (pending | running | completed | failed)
 */

import { EventEmitter } from "events";
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DATA_DIR = process.env.ORACLE_DATA_DIR || join(homedir(), ".oracle");
const BOARD_DIR = join(DATA_DIR, "board");

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "blocked";

export interface TaskLog {
  id: string;
  taskId: string;
  message: string;
  type: "start" | "progress" | "commit" | "blocker" | "done" | "comment";
  agent: string;
  timestamp: number;
  metadata?: Record<string, any>; // e.g. { commitHash: "abc123" }
}

export interface BoardTask {
  id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  owner: string;
  priority: "low" | "normal" | "high" | "critical";
  project?: string;
  blockedBy: string[];
  logs: TaskLog[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  goalId?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  taskIds: string[];
  status: "active" | "completed" | "archived";
  createdAt: number;
  completedAt?: number;
}

// ═══════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════

const tasks: Map<string, BoardTask> = new Map();
const projects: Map<string, Project> = new Map();
const boardBus = new EventEmitter();

let idCounter = 0;
function nextId(prefix: string = "task"): string {
  return `${prefix}-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

function ensureDir(): void {
  if (!existsSync(BOARD_DIR)) mkdirSync(BOARD_DIR, { recursive: true });
}

function persist(): void {
  ensureDir();
  const taskLines = [...tasks.values()].map(t => JSON.stringify(t));
  writeFileSync(join(BOARD_DIR, "tasks.jsonl"), taskLines.join("\n") + "\n");
  const projLines = [...projects.values()].map(p => JSON.stringify(p));
  writeFileSync(join(BOARD_DIR, "projects.jsonl"), projLines.join("\n") + "\n");
}

function load(): void {
  ensureDir();
  const taskFile = join(BOARD_DIR, "tasks.jsonl");
  if (existsSync(taskFile)) {
    readFileSync(taskFile, "utf-8").split("\n").filter(Boolean).forEach(l => {
      try { const t = JSON.parse(l); tasks.set(t.id, t); } catch {}
    });
  }
  const projFile = join(BOARD_DIR, "projects.jsonl");
  if (existsSync(projFile)) {
    readFileSync(projFile, "utf-8").split("\n").filter(Boolean).forEach(l => {
      try { const p = JSON.parse(l); projects.set(p.id, p); } catch {}
    });
  }
}

// Load on module init
load();

// ═══════════════════════════════════════════════════════════
// Task CRUD
// ═══════════════════════════════════════════════════════════

export function createTask(params: {
  subject: string;
  description?: string;
  owner?: string;
  priority?: BoardTask["priority"];
  project?: string;
  blockedBy?: string[];
  goalId?: string;
}): BoardTask {
  const task: BoardTask = {
    id: nextId("task"),
    subject: params.subject,
    description: params.description || "",
    status: params.owner ? "pending" : "pending",
    owner: params.owner || "",
    priority: params.priority || "normal",
    project: params.project,
    blockedBy: params.blockedBy || [],
    logs: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    goalId: params.goalId,
  };
  tasks.set(task.id, task);
  boardBus.emit("task:created", task);
  persist();
  return task;
}

export function getTask(taskId: string): BoardTask | undefined {
  return tasks.get(taskId);
}

export function listTasks(filter?: {
  status?: TaskStatus;
  owner?: string;
  project?: string;
  goalId?: string;
}): BoardTask[] {
  let result = [...tasks.values()];
  if (filter?.status) result = result.filter(t => t.status === filter.status);
  if (filter?.owner) result = result.filter(t => t.owner === filter.owner);
  if (filter?.project) result = result.filter(t => t.project === filter.project);
  if (filter?.goalId) result = result.filter(t => t.goalId === filter.goalId);
  return result.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function updateTask(taskId: string, update: {
  status?: TaskStatus;
  owner?: string;
  subject?: string;
  description?: string;
  priority?: BoardTask["priority"];
}): BoardTask | undefined {
  const task = tasks.get(taskId);
  if (!task) return undefined;

  if (update.status) {
    task.status = update.status;
    if (update.status === "completed") task.completedAt = Date.now();
  }
  if (update.owner !== undefined) task.owner = update.owner;
  if (update.subject) task.subject = update.subject;
  if (update.description !== undefined) task.description = update.description;
  if (update.priority) task.priority = update.priority;
  task.updatedAt = Date.now();

  tasks.set(taskId, task);
  boardBus.emit("task:updated", task);
  persist();
  return task;
}

/**
 * Claim a task — set owner + in_progress in one call
 */
export function claimTask(taskId: string, agentName: string): BoardTask | undefined {
  const task = tasks.get(taskId);
  if (!task) return undefined;

  // Check blockedBy
  if (task.blockedBy.length > 0) {
    for (const depId of task.blockedBy) {
      const dep = tasks.get(depId);
      if (!dep || dep.status !== "completed") {
        return undefined; // blocked
      }
    }
  }

  task.owner = agentName;
  task.status = "in_progress";
  task.updatedAt = Date.now();
  tasks.set(taskId, task);

  addLog(taskId, {
    agent: agentName,
    type: "start",
    message: `${agentName} claimed task`,
  });

  boardBus.emit("task:claimed", task);
  return task;
}

// ═══════════════════════════════════════════════════════════
// Task Logs — the audit trail
// ═══════════════════════════════════════════════════════════

export function addLog(taskId: string, params: {
  agent: string;
  type: TaskLog["type"];
  message: string;
  metadata?: Record<string, any>;
}): TaskLog | undefined {
  const task = tasks.get(taskId);
  if (!task) return undefined;

  const log: TaskLog = {
    id: nextId("log"),
    taskId,
    message: params.message,
    type: params.type,
    agent: params.agent,
    timestamp: Date.now(),
    metadata: params.metadata,
  };
  task.logs.push(log);
  task.updatedAt = Date.now();
  tasks.set(taskId, task);
  boardBus.emit("task:log", { task, log });
  persist();
  return log;
}

export function getTaskTimeline(taskId: string): TaskLog[] {
  const task = tasks.get(taskId);
  return task ? task.logs : [];
}

// ═══════════════════════════════════════════════════════════
// Kanban View
// ═══════════════════════════════════════════════════════════

export function getKanban(): {
  pending: BoardTask[];
  in_progress: BoardTask[];
  completed: BoardTask[];
  failed: BoardTask[];
  blocked: BoardTask[];
} {
  const all = [...tasks.values()];
  return {
    pending: all.filter(t => t.status === "pending"),
    in_progress: all.filter(t => t.status === "in_progress"),
    completed: all.filter(t => t.status === "completed"),
    failed: all.filter(t => t.status === "failed"),
    blocked: all.filter(t => t.status === "blocked"),
  };
}

/**
 * Format kanban board as text (for terminal/dashboard)
 */
export function formatKanban(): string {
  const kb = getKanban();
  const lines: string[] = [];

  lines.push("📋 Task Board — Kanban View");
  lines.push("═".repeat(50));

  const formatTask = (t: BoardTask): string => {
    const logCount = t.logs.length;
    const blocker = t.logs.find(l => l.type === "blocker" && !t.completedAt);
    const status = blocker ? "⚠️" : "";
    return `  #${t.id.slice(-8)} [${t.status}] ${t.owner || "unassigned"} ${t.subject} (${logCount} logs) ${status}`;
  };

  if (kb.pending.length > 0) {
    lines.push(`\n📥 PENDING (${kb.pending.length})`);
    kb.pending.forEach(t => lines.push(formatTask(t)));
  }
  if (kb.in_progress.length > 0) {
    lines.push(`\n🔄 IN PROGRESS (${kb.in_progress.length})`);
    kb.in_progress.forEach(t => lines.push(formatTask(t)));
  }
  if (kb.blocked.length > 0) {
    lines.push(`\n🚫 BLOCKED (${kb.blocked.length})`);
    kb.blocked.forEach(t => lines.push(formatTask(t)));
  }
  if (kb.completed.length > 0) {
    lines.push(`\n✅ COMPLETED (${kb.completed.length})`);
    kb.completed.slice(0, 10).forEach(t => lines.push(formatTask(t)));
    if (kb.completed.length > 10) lines.push(`  ... +${kb.completed.length - 10} more`);
  }
  if (kb.failed.length > 0) {
    lines.push(`\n❌ FAILED (${kb.failed.length})`);
    kb.failed.forEach(t => lines.push(formatTask(t)));
  }

  const total = kb.pending.length + kb.in_progress.length + kb.blocked.length + kb.completed.length + kb.failed.length;
  const pct = total > 0 ? Math.round((kb.completed.length / total) * 100) : 0;
  lines.push(`\n📊 Progress: ${kb.completed.length}/${total} (${pct}%)`);

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════
// Projects — group tasks
// ═══════════════════════════════════════════════════════════

export function createProject(name: string, description: string = ""): Project {
  const project: Project = {
    id: nextId("proj"),
    name,
    description,
    taskIds: [],
    status: "active",
    createdAt: Date.now(),
  };
  projects.set(project.id, project);
  persist();
  return project;
}

export function addTaskToProject(projectId: string, taskId: string): boolean {
  const project = projects.get(projectId);
  if (!project) return false;
  if (!project.taskIds.includes(taskId)) {
    project.taskIds.push(taskId);
    const task = tasks.get(taskId);
    if (task) {
      task.project = projectId;
      tasks.set(taskId, task);
    }
    persist();
  }
  return true;
}

export function listProjects(): Project[] {
  return [...projects.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function getProject(projectId: string): Project | undefined {
  return projects.get(projectId);
}

export function getProjectProgress(projectId: string): {
  total: number;
  completed: number;
  failed: number;
  percent: number;
} {
  const project = projects.get(projectId);
  if (!project) return { total: 0, completed: 0, failed: 0, percent: 0 };
  const projTasks = project.taskIds.map(id => tasks.get(id)).filter(Boolean) as BoardTask[];
  const completed = projTasks.filter(t => t.status === "completed").length;
  const failed = projTasks.filter(t => t.status === "failed").length;
  return {
    total: projTasks.length,
    completed,
    failed,
    percent: projTasks.length > 0 ? Math.round((completed / projTasks.length) * 100) : 0,
  };
}

/**
 * Format project tree view
 */
export function formatProject(projectId: string): string {
  const project = projects.get(projectId);
  if (!project) return "Project not found";
  const progress = getProjectProgress(projectId);
  const lines: string[] = [];
  lines.push(`${project.name}: ${project.description}`);
  for (const taskId of project.taskIds) {
    const task = tasks.get(taskId);
    if (!task) continue;
    const icon = task.status === "completed" ? "✅" : task.status === "failed" ? "❌" : task.status === "in_progress" ? "🔄" : "📥";
    lines.push(`  ${icon} #${task.id.slice(-8)} [${task.status}] ${task.subject}`);
  }
  lines.push(`Progress: ${progress.completed}/${progress.total} (${progress.percent}%)`);
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════
// Stats
// ═══════════════════════════════════════════════════════════

export function getBoardStats(): {
  tasks: { total: number; byStatus: Record<string, number> };
  projects: { total: number; active: number };
  logs: number;
} {
  const all = [...tasks.values()];
  const byStatus: Record<string, number> = {};
  let totalLogs = 0;
  for (const t of all) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    totalLogs += t.logs.length;
  }
  const allProjects = [...projects.values()];
  return {
    tasks: { total: all.length, byStatus },
    projects: { total: allProjects.length, active: allProjects.filter(p => p.status === "active").length },
    logs: totalLogs,
  };
}

// ═══════════════════════════════════════════════════════════
// Event Bus
// ═══════════════════════════════════════════════════════════

export function onBoardEvent(event: string, handler: (...args: any[]) => void): () => void {
  boardBus.on(event, handler);
  return () => boardBus.off(event, handler);
}
