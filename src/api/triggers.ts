import { Hono } from "hono";
import { getTriggers, getTriggerHistory, fire } from "../triggers.js";
import type { TriggerEvent } from "../config.js";

export const triggersApi = new Hono();

triggersApi.get("/api/triggers", (c) => {
  const triggers = getTriggers();
  const history = getTriggerHistory();
  return c.json({ triggers: triggers.map((t, i) => {
    const last = history.find(h => h.index === i);
    return { index: i, on: t.on, repo: t.repo, timeout: t.timeout, action: t.action, name: t.name, lastFired: last ? { ts: last.result.ts, ok: last.result.ok, error: last.result.error } : null };
  }), total: triggers.length });
});

triggersApi.post("/api/triggers/fire", async (c) => {
  const { event, context } = await c.req.json();
  const results = await fire(event as TriggerEvent, context || {});
  return c.json({ ok: true, event, fired: results.length, results: results.map(r => ({ action: r.action, ok: r.ok, output: r.output, error: r.error })) });
});
