import { Hono } from "hono";
import { listSessions, capturePane, sendKeys } from "../ssh.js";
import { findWindow } from "../find-window.js";
import { getAggregatedSessions, getPeers } from "../peers.js";
import { loadConfig } from "../config.js";
import { curlFetch } from "../curl-fetch.js";

export const sessionsApi = new Hono();

sessionsApi.get("/api/sessions", async (c) => {
  const local = await listSessions();
  if (c.req.query("local") === "true") return c.json(local.map(s => ({ ...s, source: "local" })));
  const aggregated = await getAggregatedSessions(local);
  return c.json(aggregated);
});

sessionsApi.get("/api/capture", async (c) => {
  const target = c.req.query("target");
  if (!target) return c.json({ error: "target required" }, 400);
  try { return c.json({ content: await capturePane(target) }); }
  catch (e: any) { return c.json({ content: "", error: e.message }); }
});

sessionsApi.post("/api/send", async (c) => {
  try {
    const { target, text } = await c.req.json();
    const local = await listSessions();
    const resolved = findWindow(local, target) || findWindow(local, target.replace(/-oracle$/, ""));
    if (resolved) {
      await sendKeys(resolved, text);
      return c.json({ ok: true, target: resolved, text, source: "local" });
    }
    // Try federation
    const peers = getPeers();
    for (const peerUrl of peers) {
      const res = await curlFetch(`${peerUrl}/api/sessions?local=true`, { timeout: 5000 });
      if (res.ok && Array.isArray(res.data)) {
        const peerTarget = findWindow(res.data, target);
        if (peerTarget) {
          const sendRes = await curlFetch(`${peerUrl}/api/send`, { method: "POST", body: JSON.stringify({ target: peerTarget, text }), timeout: 10000 });
          if (sendRes.ok) return c.json({ ok: true, target: peerTarget, text, source: peerUrl });
        }
      }
    }
    return c.json({ error: `target not found: ${target}` }, 404);
  } catch (err) { return c.json({ error: String(err) }, 500); }
});

sessionsApi.post("/api/select", async (c) => {
  const { target } = await c.req.json();
  if (!target) return c.json({ error: "target required" }, 400);
  const { selectWindow } = await import("../ssh.js");
  await selectWindow(target).catch(() => {});
  return c.json({ ok: true, target });
});
