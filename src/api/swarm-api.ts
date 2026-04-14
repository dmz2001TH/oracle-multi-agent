import { Hono } from "hono";
import { createSwarmTask, fanOutResearch, createReviewTrio, mergeResults, SwarmExecutor } from "../swarm/index.js";
export const swarmApi = new Hono();

swarmApi.post("/api/swarm/create", async (c) => {
  const b = await c.req.json();
  return c.json({ ok: true, task: createSwarmTask(b.topic, b.prompts, b.roles) });
});
swarmApi.post("/api/swarm/fan-out", async (c) => {
  const b = await c.req.json();
  return c.json({ ok: true, task: fanOutResearch(b.topic, b.angles) });
});
swarmApi.post("/api/swarm/review-trio", async (c) => {
  const b = await c.req.json();
  return c.json({ ok: true, task: createReviewTrio(b.code, b.description) });
});
