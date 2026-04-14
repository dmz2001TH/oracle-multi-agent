import { Hono } from "hono";
import { registerAgent, budFrom, findAgent, getAncestry, getDescendants, killAgent, listAllAgents, listAlive, getStats, formatTree } from "../lineage/index.js";
export const lineageApi = new Hono();

lineageApi.post("/api/lineage/register", async (c) => {
  const b = await c.req.json();
  return c.json({ ok: true, agent: registerAgent(b.name, b.role, b.tags) });
});

lineageApi.post("/api/lineage/:parentId/bud", async (c) => {
  const b = await c.req.json();
  const child = budFrom(c.req.param("parentId"), b.name, b.role);
  return child ? c.json({ ok: true, child }) : c.json({ ok: false, error: "Parent not found" }, 404);
});

lineageApi.get("/api/lineage/:id", (c) => {
  const agent = findAgent(c.req.param("id"));
  return agent ? c.json({ ok: true, agent }) : c.json({ ok: false }, 404);
});

lineageApi.get("/api/lineage/:id/ancestry", (c) => c.json({ ok: true, chain: getAncestry(c.req.param("id")) }));
lineageApi.get("/api/lineage/:id/descendants", (c) => c.json({ ok: true, descendants: getDescendants(c.req.param("id")) }));
lineageApi.get("/api/lineage/:id/tree", (c) => c.json({ ok: true, tree: formatTree(c.req.param("id")) }));
lineageApi.post("/api/lineage/:id/kill", (c) => c.json({ ok: true, killed: killAgent(c.req.param("id")) }));
lineageApi.get("/api/lineage", (c) => c.json({ ok: true, agents: listAllAgents(), alive: listAlive(), stats: getStats() }));
