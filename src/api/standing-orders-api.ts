import { Hono } from "hono";
import { addOrder, getOrders, getOrdersAsPrompt, deactivateOrder, triggerOrder, getOrderStats, listAgentsWithOrders } from "../standing-orders/index.js";
export const standingOrdersApi = new Hono();

standingOrdersApi.post("/api/standing-orders/:agent", async (c) => {
  const b = await c.req.json();
  return c.json({ ok: true, order: addOrder(c.req.param("agent"), b.order, { priority: b.priority, category: b.category, expiresAt: b.expiresAt, trigger: b.trigger }) });
});
standingOrdersApi.get("/api/standing-orders/:agent", (c) => c.json({ ok: true, orders: getOrders(c.req.param("agent")) }));
standingOrdersApi.get("/api/standing-orders/:agent/prompt", (c) => c.json({ ok: true, prompt: getOrdersAsPrompt(c.req.param("agent")) }));
standingOrdersApi.get("/api/standing-orders/:agent/stats", (c) => c.json({ ok: true, stats: getOrderStats(c.req.param("agent")) }));
standingOrdersApi.post("/api/standing-orders/:agent/:orderId/deactivate", (c) => c.json({ ok: true, deactivated: deactivateOrder(c.req.param("agent"), c.req.param("orderId")) }));
standingOrdersApi.post("/api/standing-orders/:agent/:orderId/trigger", (c) => c.json({ ok: true, triggered: triggerOrder(c.req.param("agent"), c.req.param("orderId")) }));
standingOrdersApi.get("/api/standing-orders", (c) => c.json({ ok: true, agents: listAgentsWithOrders() }));
