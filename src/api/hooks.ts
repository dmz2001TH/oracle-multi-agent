/**
 * Hooks API — Guide Ch7: Rule Enforcement
 *
 * Endpoints:
 *   GET    /api/hooks             — list built-in rules + external config
 *   POST   /api/hooks/test        — test a hook against sample data
 *   POST   /api/hooks/config      — set external hook script
 *   DELETE /api/hooks/config/:event — remove external hook
 */

import { Hono } from "hono";
import { runHooks, getHookConfig, setHook, removeHook, listBuiltInRules } from "../hooks.js";
import type { HookContext, HookEvent } from "../hooks.js";

export const hooksApi = new Hono();

// List hooks
hooksApi.get("/api/hooks", async (c) => {
  const config = await getHookConfig();
  const builtIn = listBuiltInRules();

  return c.json({
    builtIn: builtIn.map(name => ({
      name,
      description: getHookDescription(name),
    })),
    external: config.hooks || {},
    totalBuiltIn: builtIn.length,
    totalExternal: Object.keys(config.hooks || {}).length,
  });
});

// Test hook with sample data
hooksApi.post("/api/hooks/test", async (c) => {
  const { event, from, to, data } = await c.req.json();

  if (!event) return c.json({ error: "event is required" }, 400);

  const ctx: HookContext = {
    event: event as HookEvent,
    from: from || "test-user",
    to: to || "system",
    data: data || {},
    ts: new Date().toISOString(),
  };

  const results = await runHooks(ctx);

  return c.json({
    event: ctx.event,
    results,
    triggered: results.length,
  });
});

// Set external hook
hooksApi.post("/api/hooks/config", async (c) => {
  const { event, script } = await c.req.json();

  if (!event || !script) return c.json({ error: "event and script are required" }, 400);

  await setHook(event, script);
  return c.json({ ok: true, event, script });
});

// Remove external hook
hooksApi.delete("/api/hooks/config/:event", async (c) => {
  const event = c.req.param("event");
  const removed = await removeHook(event);
  if (!removed) return c.json({ error: "hook not found" }, 404);
  return c.json({ ok: true, event });
});

// ─── Helpers ────────────────────────────────────────────────────

function getHookDescription(name: string): string {
  const descriptions: Record<string, string> = {
    "task-claim-require-log": "Warns when a task is claimed without a log entry",
    "cc-bob-on-complete": "Notifies team lead when a task is completed",
    "auto-tag-meeting": "Auto-tags meetings based on topic keywords",
    "no-duplicate-think": "Checks for duplicate think proposals",
  };
  return descriptions[name] || "Custom hook rule";
}
