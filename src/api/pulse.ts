import { Hono } from "hono";
import { loadConfig } from "../config.js";
import { tmux } from "../tmux.js";

export const pulseApi = new Hono();

pulseApi.get("/api/pulse", async (c) => {
  const config = loadConfig();
  const sessions = await tmux.listAll();
  const panes = await tmux.listPanes();
  const busy = panes.filter(p => /claude|codex/i.test(p.command));
  return c.json({ node: config.node ?? "local", sessions: sessions.length, windows: sessions.reduce((s, x) => s + x.windows.length, 0), panes: panes.length, busyAgents: busy.length, uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
});

pulseApi.get("/api/ping", (c) => c.json({ ok: true, ts: Date.now() }));
