/**
 * Tasks CLI — Chapter 4: TaskCreate/TaskList/TaskUpdate
 * Usage:
 *   oracle tasks [ls] [--team X] [--owner X] [--status X]
 *   oracle tasks create "subject" [--desc "..."] [--owner X] [--team X] [--branch X]
 *   oracle tasks update <id> --status in_progress|completed|pending
 *   oracle tasks update <id> --owner X
 *   oracle tasks claim <id>    (shorthand: set owner + in_progress)
 *   oracle tasks done <id>     (shorthand: set completed)
 *   oracle tasks rm <id>
 */

import { maw } from "../sdk.js";
import type { CreateTaskInput, UpdateTaskInput } from "../lib/schemas.js";

export async function cmdTasksList(args: string[]) {
  const teamIdx = args.indexOf("--team");
  const ownerIdx = args.indexOf("--owner");
  const statusIdx = args.indexOf("--status");

  const team = teamIdx !== -1 ? args[teamIdx + 1] : undefined;
  const owner = ownerIdx !== -1 ? args[ownerIdx + 1] : undefined;
  const status = statusIdx !== -1 ? args[statusIdx + 1] : undefined;

  const tasks = await maw.tasks(team);
  let filtered = tasks;
  if (owner) filtered = filtered.filter(t => t.owner === owner);
  if (status) filtered = filtered.filter(t => t.status === status);

  if (!filtered.length) {
    console.log("\x1b[90mno tasks found\x1b[0m");
    return;
  }

  console.log(`\n\x1b[36mTASKS\x1b[0m (${filtered.length}):\n`);
  for (const t of filtered) {
    const icon = t.status === "completed" ? "✅" : t.status === "in_progress" ? "🔄" : "⬜";
    const ownerStr = t.owner ? ` \x1b[90m@${t.owner}\x1b[0m` : "";
    const branch = t.branch ? ` \x1b[33m[${t.branch}]\x1b[0m` : "";
    const blocked = t.blockedBy?.length ? ` \x1b[31m🔒 blocked by ${t.blockedBy.join(",")}\x1b[0m` : "";
    console.log(`  ${icon} #${t.id} ${t.subject}${ownerStr}${branch}${blocked}`);
  }
  console.log();
}

export async function cmdTasksCreate(args: string[]) {
  const subject = args[0];
  if (!subject) {
    console.error("usage: oracle tasks create \"subject\" [--desc \"...\"] [--owner X] [--team X] [--branch X]");
    process.exit(1);
  }

  const descIdx = args.indexOf("--desc");
  const ownerIdx = args.indexOf("--owner");
  const teamIdx = args.indexOf("--team");
  const branchIdx = args.indexOf("--branch");

  const input: CreateTaskInput = { subject };
  if (descIdx !== -1) input.description = args[descIdx + 1];
  if (ownerIdx !== -1) input.owner = args[ownerIdx + 1];
  if (teamIdx !== -1) input.team = args[teamIdx + 1];
  if (branchIdx !== -1) input.branch = args[branchIdx + 1];

  try {
    const task = await maw.createTask(input);
    console.log(`\x1b[32m✓\x1b[0m Task #${task.id} created: ${task.subject}`);
  } catch (e: any) {
    console.error(`\x1b[31merror\x1b[0m: ${e.message}`);
  }
}

export async function cmdTasksUpdate(id: string, args: string[]) {
  if (!id) {
    console.error("usage: oracle tasks update <id> [--status X] [--owner X] [--subject X] [--branch X]");
    process.exit(1);
  }

  const input: UpdateTaskInput = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--status") input.status = args[++i] as any;
    else if (args[i] === "--owner") input.owner = args[++i];
    else if (args[i] === "--subject") input.subject = args[++i];
    else if (args[i] === "--branch") input.branch = args[++i];
    else if (args[i] === "--desc") input.description = args[++i];
  }

  try {
    const task = await maw.updateTask(id, input);
    console.log(`\x1b[32m✓\x1b[0m Task #${task.id} updated: ${task.status} — ${task.subject}`);
  } catch (e: any) {
    console.error(`\x1b[31merror\x1b[0m: ${e.message}`);
  }
}

export async function cmdTasksClaim(id: string) {
  if (!id) {
    console.error("usage: oracle tasks claim <id>");
    process.exit(1);
  }
  try {
    const task = await maw.updateTask(id, { status: "in_progress" });
    console.log(`\x1b[32m✓\x1b[0m Task #${task.id} claimed: ${task.subject}`);
  } catch (e: any) {
    console.error(`\x1b[31merror\x1b[0m: ${e.message}`);
  }
}

export async function cmdTasksDone(id: string) {
  if (!id) {
    console.error("usage: oracle tasks done <id>");
    process.exit(1);
  }
  try {
    const task = await maw.updateTask(id, { status: "completed" });
    console.log(`\x1b[32m✓\x1b[0m Task #${task.id} completed: ${task.subject}`);
  } catch (e: any) {
    console.error(`\x1b[31merror\x1b[0m: ${e.message}`);
  }
}

export async function cmdTasksRm(id: string) {
  if (!id) {
    console.error("usage: oracle tasks rm <id>");
    process.exit(1);
  }
  try {
    await maw.deleteTask(id);
    console.log(`\x1b[32m✓\x1b[0m Task #${id} deleted`);
  } catch (e: any) {
    console.error(`\x1b[31merror\x1b[0m: ${e.message}`);
  }
}
