import { Hono } from "hono";
import { scanWorktrees, cleanupWorktree } from "../worktrees.js";

export const worktreesApi = new Hono();

worktreesApi.get("/api/worktrees", async (c) => c.json({ worktrees: await scanWorktrees() }));
worktreesApi.post("/api/worktrees/cleanup", async (c) => {
  const { path } = await c.req.json();
  if (!path) return c.json({ error: "path required" }, 400);
  return c.json({ log: await cleanupWorktree(path) });
});
