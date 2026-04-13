/**
 * Project API — Chapter 4: Task & Project
 *
 * Endpoints:
 *   POST   /api/projects              — create project
 *   GET    /api/projects              — list projects
 *   GET    /api/projects/:name        — get project (with task tree)
 *   PATCH  /api/projects/:name        — update project
 *   DELETE /api/projects/:name        — delete project
 *   POST   /api/projects/:name/tasks  — add task to project
 *   DELETE /api/projects/:name/tasks/:taskId — remove task
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { Project, Task } from "../lib/schemas.js";
import { validateBody, schemas } from "../lib/validate.js";

export const projectsApi = new Hono();

const PROJECTS_DIR = join(homedir(), ".oracle", "projects");
const TASKS_DIR = join(homedir(), ".oracle", "tasks");

function ensureDir() { mkdirSync(PROJECTS_DIR, { recursive: true }); }

function projectPath(name: string): string { return join(PROJECTS_DIR, `${name}.json`); }

function loadProject(name: string): Project | null {
  try { return JSON.parse(readFileSync(projectPath(name), "utf-8")); } catch { return null; }
}

function saveProject(project: Project): void {
  ensureDir();
  writeFileSync(projectPath(project.name), JSON.stringify(project, null, 2));
}

function loadTask(id: string): Task | null {
  try { return JSON.parse(readFileSync(join(TASKS_DIR, `${id}.json`), "utf-8")); } catch { return null; }
}

// Create project (validated)
projectsApi.post("/api/projects", async (c) => {
  const input = await c.req.json();
  const check = validateBody(input, schemas.createProject);
  if (check.error) return c.json({ error: check.error }, 400);

  if (loadProject(input.name)) {
    return c.json({ error: `project "${input.name}" already exists` }, 409);
  }

  const now = new Date().toISOString();
  const project: Project = {
    name: input.name,
    description: input.description,
    tasks: input.tasks || [],
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  saveProject(project);
  return c.json(project, 201);
});

// List projects
projectsApi.get("/api/projects", (c) => {
  ensureDir();
  if (!existsSync(PROJECTS_DIR)) {
    return c.json({ projects: [] });
  }

  const files = readdirSync(PROJECTS_DIR).filter(f => f.endsWith(".json"));
  const projects: Project[] = files
    .map(f => {
      try { return JSON.parse(readFileSync(join(PROJECTS_DIR, f), "utf-8")); } catch { return null; }
    })
    .filter(Boolean) as Project[];

  return c.json({ projects, total: projects.length });
});

// Get project with task tree
projectsApi.get("/api/projects/:name", (c) => {
  const project = loadProject(c.req.param("name"));
  if (!project) return c.json({ error: "project not found" }, 404);

  // Build task tree with details
  const taskDetails = project.tasks.map(id => loadTask(id)).filter(Boolean) as Task[];

  // Compute progress
  const completed = taskDetails.filter(t => t.status === "completed").length;
  const progress = taskDetails.length > 0 ? Math.round((completed / taskDetails.length) * 100) : 0;

  return c.json({ ...project, taskDetails, progress, completed, total: taskDetails.length });
});

// Update project
projectsApi.patch("/api/projects/:name", async (c) => {
  const project = loadProject(c.req.param("name"));
  if (!project) return c.json({ error: "project not found" }, 404);

  const input = await c.req.json();
  if (input.description !== undefined) project.description = input.description;
  if (input.status !== undefined) project.status = input.status;
  project.updatedAt = new Date().toISOString();

  saveProject(project);
  return c.json(project);
});

// Delete project
projectsApi.delete("/api/projects/:name", (c) => {
  const name = c.req.param("name");
  if (!loadProject(name)) return c.json({ error: "project not found" }, 404);

  try { unlinkSync(projectPath(name)); } catch {}
  return c.json({ ok: true });
});

// Add task to project
projectsApi.post("/api/projects/:name/tasks", async (c) => {
  const project = loadProject(c.req.param("name"));
  if (!project) return c.json({ error: "project not found" }, 404);

  const { taskId } = await c.req.json();
  if (!taskId) return c.json({ error: "taskId is required" }, 400);

  if (!project.tasks.includes(taskId)) {
    project.tasks.push(taskId);
    project.updatedAt = new Date().toISOString();
    saveProject(project);
  }

  return c.json(project);
});

// Remove task from project
projectsApi.delete("/api/projects/:name/tasks/:taskId", (c) => {
  const project = loadProject(c.req.param("name"));
  if (!project) return c.json({ error: "project not found" }, 404);

  const taskId = c.req.param("taskId");
  project.tasks = project.tasks.filter(id => id !== taskId);
  project.updatedAt = new Date().toISOString();
  saveProject(project);

  return c.json(project);
});

// Auto-organize: scan unassigned tasks and group by owner/team
projectsApi.post("/api/projects/:name/auto-organize", (c) => {
  const project = loadProject(c.req.param("name"));
  if (!project) return c.json({ error: "project not found" }, 404);

  ensureDir();
  const tasksDir = TASKS_DIR;
  if (!existsSync(tasksDir)) return c.json({ project, added: 0, message: "no tasks found" });

  const files = readdirSync(tasksDir).filter(f => f.endsWith(".json"));
  const allTasks: Task[] = files
    .map(f => { try { return JSON.parse(readFileSync(join(tasksDir, f), "utf-8")); } catch { return null; } })
    .filter(Boolean) as Task[];

  // Find tasks that match this project (by team or unassigned, pending status)
  const existingIds = new Set(project.tasks);
  let added = 0;

  for (const task of allTasks) {
    if (existingIds.has(task.id)) continue;
    // Auto-match: tasks with same team as project name, or unassigned pending tasks
    if (task.status === "pending" && (!task.team || task.team === project.name)) {
      project.tasks.push(task.id);
      existingIds.add(task.id);
      added++;
    }
  }

  if (added > 0) {
    project.updatedAt = new Date().toISOString();
    saveProject(project);
  }

  return c.json({ project, added, message: added > 0 ? `organized ${added} tasks into "${project.name}"` : "no new tasks to organize" });
});
