/**
 * Projects CLI — Chapter 4: Task & Project
 *
 * Usage:
 *   oracle project create <name> [--desc "description"]
 *   oracle project ls
 *   oracle project show <name>
 *   oracle project add <name> <taskId>
 *   oracle project rm <name> <taskId>
 *   oracle project complete <name>
 *   oracle project archive <name>
 *   oracle project delete <name>
 */

import { maw } from "../sdk.js";
import type { Project, Task } from "../lib/schemas.js";

interface ProjectDetail extends Project {
  taskDetails: Task[];
  progress: number;
  completed: number;
  total: number;
}

export async function cmdProjectCreate(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("usage: oracle project create <name> [--desc \"description\"]");
    process.exit(1);
  }

  let description = "";
  const descIdx = args.indexOf("--desc");
  if (descIdx >= 0 && args[descIdx + 1]) description = args.slice(descIdx + 1).join(" ");

  try {
    const project = await maw.fetch<Project>("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    console.log(`\x1b[32m✓\x1b[0m Project "${project.name}" created`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdProjectList() {
  try {
    const res = await maw.fetch<{ projects: Project[] }>("/api/projects");
    if (!res.projects.length) {
      console.log("\x1b[90mno projects\x1b[0m");
      return;
    }
    console.log(`\n\x1b[36mPROJECTS\x1b[0m (${res.projects.length}):\n`);
    for (const p of res.projects) {
      const icon = p.status === "completed" ? "✅" : p.status === "archived" ? "📦" : "🔵";
      console.log(`  ${icon} ${p.name}${p.description ? ` — ${p.description}` : ""}`);
      console.log(`     tasks: ${p.tasks.length} | status: ${p.status}`);
    }
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdProjectShow(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("usage: oracle project show <name>");
    process.exit(1);
  }

  try {
    const p = await maw.fetch<ProjectDetail>(`/api/projects/${name}`);
    console.log(`\n\x1b[36m${p.name}\x1b[0m${p.description ? `: ${p.description}` : ""}`);
    console.log(`  status: ${p.status} | progress: ${p.progress}% (${p.completed}/${p.total})\n`);

    if (p.taskDetails.length) {
      for (const t of p.taskDetails) {
        const icon = t.status === "completed" ? "✅" : t.status === "in_progress" ? "🔵" : "⚪";
        console.log(`  ${icon} #${t.id} [${t.status}] ${t.subject}`);
        if (t.branch) console.log(`     branch: ${t.branch}`);
      }
    } else {
      console.log("  \x1b[90mno tasks\x1b[0m");
    }
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdProjectAdd(args: string[]) {
  const name = args[0];
  const taskId = args[1];
  if (!name || !taskId) {
    console.error("usage: oracle project add <name> <taskId>");
    process.exit(1);
  }

  try {
    await maw.fetch(`/api/projects/${name}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    console.log(`\x1b[32m✓\x1b[0m Task #${taskId} added to project "${name}"`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdProjectRemove(args: string[]) {
  const name = args[0];
  const taskId = args[1];
  if (!name || !taskId) {
    console.error("usage: oracle project rm <name> <taskId>");
    process.exit(1);
  }

  try {
    await maw.fetch(`/api/projects/${name}/tasks/${taskId}`, { method: "DELETE" });
    console.log(`\x1b[32m✓\x1b[0m Task #${taskId} removed from project "${name}"`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdProjectUpdate(args: string[], status: "completed" | "archived") {
  const name = args[0];
  if (!name) {
    console.error(`usage: oracle project ${status === "completed" ? "complete" : "archive"} <name>`);
    process.exit(1);
  }

  try {
    await maw.fetch(`/api/projects/${name}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    console.log(`\x1b[32m✓\x1b[0m Project "${name}" marked as ${status}`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdProjectDelete(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("usage: oracle project delete <name>");
    process.exit(1);
  }

  try {
    await maw.fetch(`/api/projects/${name}`, { method: "DELETE" });
    console.log(`\x1b[32m✓\x1b[0m Project "${name}" deleted`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
