import { Hono } from "hono";
import { calculateCost, logCost, generateReport, formatCostReport } from "../cost-model/index.js";
export const costModelApi = new Hono();

costModelApi.post("/api/cost/calculate", async (c) => {
  const b = await c.req.json();
  return c.json({ ok: true, cost: calculateCost(b.model, b.inputTokens, b.outputTokens) });
});
costModelApi.post("/api/cost/log", async (c) => {
  const b = await c.req.json();
  return c.json({ ok: true, entry: logCost(b.agent, b.tier, b.model, b.inputTokens, b.outputTokens, b.task) });
});
costModelApi.post("/api/cost/report", async (c) => {
  const b = await c.req.json();
  const report = generateReport(b.entries || [], b.from, b.to);
  return c.json({ ok: true, report, formatted: formatCostReport(report) });
});
