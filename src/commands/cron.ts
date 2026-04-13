/**
 * Cron CLI — Chapter 9: The Cron Loop
 *
 * Usage:
 *   oracle cron add "0/5 * * * *" "prompt here" [--name X] [--backlog "initial content"]
 *   oracle cron ls
 *   oracle cron get id
 *   oracle cron rm id
 *   oracle cron run id
 */

import { maw } from "../sdk.js";
import type { CronJob } from "../lib/schemas.js";

export async function cmdCronAdd(args: string[]) {
  const schedule = args[0];
  if (!schedule) {
    console.error("usage: oracle cron add \"*/5 * * * *\" \"prompt here\" [--name X] [--backlog \"content\"]");
    process.exit(1);
  }

  // Collect prompt — everything between schedule and first --flag
  const rest = args.slice(1);
  const promptParts: string[] = [];
  let i = 0;
  while (i < rest.length && !rest[i].startsWith("--")) {
    promptParts.push(rest[i]);
    i++;
  }

  if (promptParts.length === 0) {
    console.error("usage: oracle cron add \"*/5 * * * *\" \"prompt here\" [--name X]");
    process.exit(1);
  }

  const prompt = promptParts.join(" ");

  // Parse flags
  const flagArgs = rest.slice(i);
  let name: string | undefined;
  let backlog: string | undefined;
  for (let j = 0; j < flagArgs.length; j++) {
    if (flagArgs[j] === "--name" && flagArgs[j + 1]) name = flagArgs[++j];
    else if (flagArgs[j] === "--backlog" && flagArgs[j + 1]) backlog = flagArgs[++j];
  }

  try {
    const job = await maw.fetch<CronJob>("/api/cron", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule, prompt, name, backlog }),
    });
    console.log(`\x1b[32m✓\x1b[0m Cron job #${job.id} "${job.name}" created (${job.schedule})`);
  } catch (e: any) {
    console.error(`\x1b[31merror\x1b[0m: ${e.message}`);
  }
}

export async function cmdCronList() {
  try {
    const res = await maw.fetch<{ jobs: CronJob[] }>("/api/cron");
    const jobs = res.jobs ?? [];

    if (!jobs.length) {
      console.log("\x1b[90mno cron jobs\x1b[0m");
      return;
    }

    console.log(`\n\x1b[36mCRON JOBS\x1b[0m (${jobs.length}):\n`);
    for (const j of jobs) {
      const icon = j.enabled ? "⏰" : "⏸️";
      const lastRun = j.lastRun ? ` last: ${j.lastRun.slice(0, 16)}` : " never run";
      console.log(`  ${icon} #${j.id} "${j.name}" — ${j.schedule} (${j.firings} firings)${lastRun}`);
      console.log(`     \x1b[90m${j.prompt.slice(0, 80)}${j.prompt.length > 80 ? "..." : ""}\x1b[0m`);
    }
    console.log();
  } catch (e: any) {
    console.error(`\x1b[31merror\x1b[0m: ${e.message}`);
  }
}

export async function cmdCronGet(id: string) {
  if (!id) {
    console.error("usage: oracle cron get <id>");
    process.exit(1);
  }
  try {
    const job = await maw.fetch<CronJob & { backlog: string }>(`/api/cron/${id}`);
    console.log(`\n\x1b[36mCRON JOB #${job.id}\x1b[0m`);
    console.log(`  name:     ${job.name}`);
    console.log(`  schedule: ${job.schedule}`);
    console.log(`  enabled:  ${job.enabled}`);
    console.log(`  firings:  ${job.firings}`);
    console.log(`  lastRun:  ${job.lastRun || "never"}`);
    console.log(`  prompt:   ${job.prompt}`);
    console.log(`\n  \x1b[90m--- backlog ---\x1b[0m`);
    console.log(`  ${job.backlog?.split("\n").join("\n  ") || "(empty)"}`);
    console.log();
  } catch (e: any) {
    console.error(`\x1b[31merror\x1b[0m: ${e.message}`);
  }
}

export async function cmdCronRm(id: string) {
  if (!id) {
    console.error("usage: oracle cron rm <id>");
    process.exit(1);
  }
  try {
    await maw.fetch<{ ok: boolean }>(`/api/cron/${id}`, { method: "DELETE" });
    console.log(`\x1b[32m✓\x1b[0m Cron job #${id} deleted`);
  } catch (e: any) {
    console.error(`\x1b[31merror\x1b[0m: ${e.message}`);
  }
}

export async function cmdCronRun(id: string) {
  if (!id) {
    console.error("usage: oracle cron run <id>");
    process.exit(1);
  }
  try {
    const res = await maw.fetch<{ ok: boolean; firing: number }>(`/api/cron/${id}/run`, {
      method: "POST",
    });
    console.log(`\x1b[32m✓\x1b[0m Cron job #${id} triggered (firing #${res.firing})`);
  } catch (e: any) {
    console.error(`\x1b[31merror\x1b[0m: ${e.message}`);
  }
}
