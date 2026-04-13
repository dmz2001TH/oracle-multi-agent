/**
 * Loop Management CLI — Chapter 5: Loops
 *
 * Usage:
 *   oracle loop enable <id>
 *   oracle loop disable <id>
 *   oracle loop history <id>
 */

import { maw } from "../sdk.js";
import type { CronJob } from "../lib/schemas.js";

export async function cmdLoopEnable(args: string[]) {
  const id = args[0];
  if (!id) {
    console.error("usage: oracle loop enable <id>");
    process.exit(1);
  }

  try {
    await maw.fetch(`/api/cron/${id}/enable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
    console.log(`\x1b[32m✓\x1b[0m Loop #${id} enabled`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdLoopDisable(args: string[]) {
  const id = args[0];
  if (!id) {
    console.error("usage: oracle loop disable <id>");
    process.exit(1);
  }

  try {
    await maw.fetch(`/api/cron/${id}/disable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
    console.log(`\x1b[33m⏸\x1b[0m Loop #${id} disabled`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdLoopHistory(args: string[]) {
  const id = args[0];
  if (!id) {
    console.error("usage: oracle loop history <id>");
    process.exit(1);
  }

  try {
    const res = await maw.fetch<{ history: any[]; total: number }>(`/api/cron/${id}/history`);

    if (!res.history.length) {
      console.log(`\x1b[90mno firing history for loop #${id}\x1b[0m`);
      return;
    }

    console.log(`\n\x1b[36mLOOP HISTORY: #${id}\x1b[0m (${res.total} firings)\n`);
    for (const h of res.history) {
      const icon = h.success ? "✅" : "❌";
      const time = new Date(h.firedAt).toLocaleString();
      console.log(`  ${icon} [${time}] ${h.message || "(no message)"}`);
      if (h.duration) console.log(`     duration: ${h.duration}ms`);
    }
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
