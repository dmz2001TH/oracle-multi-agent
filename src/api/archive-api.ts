import { Hono } from "hono";
import { archiveSession, listArchives, getArchive, restoreArchive, getArchiveStats } from "../archive/index.js";
export const archiveApi = new Hono();

archiveApi.post("/api/archive/:agent", async (c) => {
  const b = await c.req.json();
  return c.json({ ok: true, entry: archiveSession(c.req.param("agent"), b.role || "general", b.reason || "manual", b.metadata) });
});
archiveApi.get("/api/archive/:agent", (c) => c.json({ ok: true, archives: listArchives(c.req.param("agent")) }));
archiveApi.get("/api/archive/:agent/:id", (c) => c.json({ ok: true, archive: getArchive(c.req.param("agent"), c.req.param("id")) }));
archiveApi.post("/api/archive/:agent/:id/restore", async (c) => {
  const b = await c.req.json();
  return c.json({ ok: true, restored: restoreArchive(c.req.param("agent"), c.req.param("id"), b.targetDir) });
});
archiveApi.get("/api/archive-stats", (c) => c.json({ ok: true, stats: getArchiveStats() }));
