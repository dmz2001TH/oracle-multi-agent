import { Hono } from "hono";
import { loadConfig } from "../config.js";

export const avengersApi = new Hono();

function getAvengersUrl(): string | null { return (loadConfig() as any).avengers || null; }

avengersApi.get("/api/avengers/status", async (c) => {
  const base = getAvengersUrl();
  if (!base) return c.json({ error: "avengers not configured" }, 503);
  try { const res = await fetch(`${base}/all`, { signal: AbortSignal.timeout(5000) }); return c.json({ accounts: await res.json(), source: base }); }
  catch (e: any) { return c.json({ error: `avengers unreachable: ${e.message}` }, 502); }
});

avengersApi.get("/api/avengers/best", async (c) => {
  const base = getAvengersUrl();
  if (!base) return c.json({ error: "avengers not configured" }, 503);
  try { const res = await fetch(`${base}/best`, { signal: AbortSignal.timeout(5000) }); return c.json(await res.json()); }
  catch (e: any) { return c.json({ error: `avengers unreachable: ${e.message}` }, 502); }
});

avengersApi.get("/api/avengers/health", async (c) => {
  const base = getAvengersUrl();
  if (!base) return c.json({ configured: false });
  try { const start = Date.now(); const res = await fetch(`${base}/all`, { signal: AbortSignal.timeout(3000) }); return c.json({ configured: true, reachable: res.ok, latency: Date.now() - start }); }
  catch { return c.json({ configured: true, reachable: false }); }
});
