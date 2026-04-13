/**
 * Wakeup API — Chapter 9: ScheduleWakeup
 *
 * POST /api/wake/schedule — { delaySeconds, prompt, reason }
 * GET  /api/wake/pending   — list pending wakeups
 */

import { Hono } from "hono";
import { scheduleWakeup, listPendingWakeups } from "../commands/wakeup.js";

export const wakeupApi = new Hono();

wakeupApi.post("/api/wake/schedule", async (c) => {
  const input = await c.req.json();

  if (!input.delaySeconds || !input.prompt) {
    return c.json({ error: "delaySeconds and prompt are required" }, 400);
  }

  const entry = scheduleWakeup(
    Number(input.delaySeconds),
    String(input.prompt),
    String(input.reason ?? ""),
  );

  return c.json(entry, 201);
});

wakeupApi.get("/api/wake/pending", (c) => {
  const entries = listPendingWakeups();
  return c.json({ wakeups: entries, total: entries.length });
});
