import { Hono } from "hono";
import type { FeedEvent } from "../lib/feed.js";
import { markRealFeedEvent } from "../engine/status.js";
import { cfgLimit } from "../config.js";

export const feedBuffer: FeedEvent[] = [];
export const feedListeners = new Set<(event: FeedEvent) => void>();

export function pushFeedEvent(event: FeedEvent) {
  feedBuffer.push(event);
  const feedMax = cfgLimit("feedMax");
  if (feedBuffer.length > feedMax) feedBuffer.splice(0, feedBuffer.length - feedMax);
  for (const fn of feedListeners) fn(event);
}

export const feedApi = new Hono();

feedApi.get("/api/feed", (c) => {
  const limit = Math.min(200, +(c.req.query("limit") || String(cfgLimit("feedDefault"))));
  const oracle = c.req.query("oracle");
  let events = feedBuffer.slice(-limit);
  if (oracle) events = events.filter(e => e.oracle === oracle);
  const activeMap = new Map<string, FeedEvent>();
  const cutoff = Date.now() - 5 * 60_000;
  for (const e of feedBuffer) { if (e.ts >= cutoff) activeMap.set(e.oracle, e); }
  return c.json({ events: events.reverse(), total: events.length, active_oracles: [...activeMap.keys()] });
});

feedApi.post("/api/feed", async (c) => {
  const b = await c.req.json();
  const event: FeedEvent = {
    timestamp: b.timestamp || new Date().toISOString(), oracle: b.oracle || "unknown",
    host: b.host || "local", event: b.event || "Notification", project: b.project || "",
    sessionId: b.sessionId || "", message: b.message || "", ts: b.ts || Date.now(),
  };
  pushFeedEvent(event); markRealFeedEvent(event.oracle);
  return c.json({ ok: true });
});
