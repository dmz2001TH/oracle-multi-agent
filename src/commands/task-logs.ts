/**
 * Task Logs CLI — Chapter 4: Task Tracking
 *
 * Usage:
 *   oracle tasklog add <taskId> "message" [--type log|commit|blocker] [--author X]
 *   oracle tasklog ls <taskId>
 *   oracle tasklog all [--limit N]
 */

import { maw } from "../sdk.js";
import type { TaskLogEntry } from "../lib/schemas.js";

export async function cmdTaskLogAdd(args: string[]) {
  const taskId = args[0];
  if (!taskId) {
    console.error("usage: oracle tasklog add <taskId> \"message\" [--type log|commit|blocker] [--author X]");
    process.exit(1);
  }

  const rest = args.slice(1);
  const msgParts: string[] = [];
  let i = 0;
  while (i < rest.length && !rest[i].startsWith("--")) {
    msgParts.push(rest[i]);
    i++;
  }

  if (msgParts.length === 0) {
    console.error("usage: oracle tasklog add <taskId> \"message\"");
    process.exit(1);
  }

  const message = msgParts.join(" ");
  const flags = rest.slice(i);
  let type = "log";
  let author: string | undefined;

  for (let j = 0; j < flags.length; j++) {
    if (flags[j] === "--type" && flags[j + 1]) type = flags[++j];
    else if (flags[j] === "--author" && flags[j + 1]) author = flags[++j];
  }

  try {
    const entry = await maw.fetch<TaskLogEntry>(`/api/tasks/${taskId}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, type, author }),
    });

    const icon = type === "commit" ? "📦" : type === "blocker" ? "🚫" : "📝";
    console.log(`${icon} Task #${taskId} log added: ${message}`);
    console.log(`  type: ${type} | id: ${entry.id}`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdTaskLogList(args: string[]) {
  const taskId = args[0];
  if (!taskId) {
    console.error("usage: oracle tasklog ls <taskId>");
    process.exit(1);
  }

  try {
    const res = await maw.fetch<{ logs: TaskLogEntry[]; total: number }>(`/api/tasks/${taskId}/logs`);

    if (!res.logs.length) {
      console.log(`\x1b[90mno logs for task #${taskId}\x1b[0m`);
      return;
    }

    console.log(`\n\x1b[36mTASK LOG: #${taskId}\x1b[0m (${res.total} entries)\n`);
    for (const log of res.logs) {
      const icon = log.type === "commit" ? "📦" : log.type === "blocker" ? "🚫" : "📝";
      const time = new Date(log.ts).toLocaleString();
      console.log(`  ${icon} [${time}] ${log.message}`);
      if (log.author) console.log(`     by: ${log.author}`);
    }
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdTaskLogAll(args: string[]) {
  const limit = args.includes("--limit") ? args[args.indexOf("--limit") + 1] : "20";

  try {
    const res = await maw.fetch<{ logs: TaskLogEntry[]; total: number }>(`/api/tasks/logs/all?limit=${limit}`);

    if (!res.logs.length) {
      console.log("\x1b[90mno task logs\x1b[0m");
      return;
    }

    console.log(`\n\x1b[36mALL TASK LOGS\x1b[0m (showing ${res.logs.length}/${res.total})\n`);
    for (const log of res.logs) {
      const icon = log.type === "commit" ? "📦" : log.type === "blocker" ? "🚫" : "📝";
      const time = new Date(log.ts).toLocaleString();
      console.log(`  ${icon} #${log.taskId} [${time}] ${log.message}`);
    }
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
