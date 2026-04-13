/**
 * Tasks API — Chapter 4 pattern: TaskCreate/TaskList/TaskUpdate
 * File-backed task store with team support.
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus } from "../lib/schemas.js";
import { validateBody, schemas } from "../lib/validate.js";

export const tasksApi = new Hono();

const TASKS_DIR = join(homedir(), ".oracle", "tasks");

function ensureDir() { mkdirSync(TASKS_DIR, { recursive: true }); }

function taskPath(id: string): string { return join(TASKS_DIR, `${id}.json`); }

function nextId(): string {
  ensureDir();
  const files = readdirSync(TASKS_DIR).filter(f => f.endsWith(".json"));
  const maxNum = files.reduce((max, f) => {
    const n = parseInt(f.replace(".json", ""), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return String(maxNum + 1);
}

function loadTask(id: string): Task | null {
  try { return JSON.parse(readFileSync(taskPath(id), "utf-8")); } catch { return null; }
}

function saveTask(task: Task): void {
  ensureDir();
  writeFileSync(taskPath(task.id), JSON.stringify(task, null, 2));
}

function checkBlocked(blockedBy: string[]): boolean {
  for (const depId of blockedBy) {
    const dep = loadTask(depId);
    if (!dep || dep.status !== "completed") return true;
  }
  return false;
}

// List tasks
tasksApi.get("/api/tasks", (c) => {
  ensureDir();
  const team = c.req.query("team");
  const owner = c.req.query("owner");
  const status = c.req.query("status");

  const files = readdirSync(TASKS_DIR).filter(f => f.endsWith(".json"));
  let tasks: Task[] = files.map(f => {
    try { return JSON.parse(readFileSync(join(TASKS_DIR, f), "utf-8")); } catch { return null; }
  }).filter(Boolean) as Task[];

  if (team) tasks = tasks.filter(t => t.team === team);
  if (owner) tasks = tasks.filter(t => t.owner === owner);
  if (status) tasks = tasks.filter(t => t.status === status);

  tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return c.json({ tasks, total: tasks.length });
});

// Get single task
tasksApi.get("/api/tasks/:id", (c) => {
  const task = loadTask(c.req.param("id"));
  if (!task) return c.json({ error: "task not found" }, 404);
  return c.json(task);
});

// Create task (TaskCreate, validated)
tasksApi.post("/api/tasks", async (c) => {
  const input = await c.req.json();
  const check = validateBody(input, schemas.createTask);
  if (check.error) return c.json({ error: check.error }, 400);
  const id = nextId();
  const now = new Date().toISOString();

  if (input.blockedBy && checkBlocked(input.blockedBy)) {
    // Allow creation but warn — blockedBy is advisory at creation time
    // Runtime enforcement: agent checks before claiming
  }

  const task: Task = {
    id,
    subject: input.subject,
    description: input.description,
    owner: input.owner,
    status: "pending",
    blockedBy: input.blockedBy,
    team: input.team,
    branch: input.branch,
    createdAt: now,
    updatedAt: now,
  };

  saveTask(task);
  return c.json(task, 201);
});

// Update task (TaskUpdate, validated)
tasksApi.patch("/api/tasks/:id", async (c) => {
  const task = loadTask(c.req.param("id"));
  if (!task) return c.json({ error: "task not found" }, 404);

  const input = await c.req.json();
  const check = validateBody(input, schemas.updateTask);
  if (check.error) return c.json({ error: check.error }, 400);

  // Check blockedBy before allowing claim
  if (input.status === "in_progress" && task.blockedBy?.length) {
    if (checkBlocked(task.blockedBy)) {
      return c.json({ error: "task is blocked by incomplete dependencies", blockedBy: task.blockedBy }, 409);
    }
  }

  if (input.subject !== undefined) task.subject = input.subject;
  if (input.description !== undefined) task.description = input.description;
  if (input.owner !== undefined) task.owner = input.owner;
  if (input.status !== undefined) task.status = input.status;
  if (input.blockedBy !== undefined) task.blockedBy = input.blockedBy;
  if (input.branch !== undefined) task.branch = input.branch;
  task.updatedAt = new Date().toISOString();

  saveTask(task);
  return c.json(task);
});

// Delete task
tasksApi.delete("/api/tasks/:id", (c) => {
  const id = c.req.param("id");
  const path = taskPath(id);
  if (!existsSync(path)) return c.json({ error: "task not found" }, 404);
  unlinkSync(path);
  return c.json({ ok: true });
});
