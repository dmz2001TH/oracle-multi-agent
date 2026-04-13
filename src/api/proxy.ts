import { Hono } from "hono";
import { loadConfig } from "../config.js";
import { curlFetch } from "../curl-fetch.js";

export const proxyApi = new Hono();

proxyApi.post("/api/proxy", async (c) => {
  const { peer, method, path, body } = await c.req.json();
  if (!peer || !method || !path) return c.json({ error: "missing fields" }, 400);
  const config = loadConfig();
  const namedPeers = config.namedPeers || [];
  const match = namedPeers.find(p => p.name === peer);
  const peerUrl = match?.url || (peer.startsWith("http") ? peer : null);
  if (!peerUrl) return c.json({ error: "unknown peer" }, 404);
  try {
    const res = await curlFetch(`${peerUrl}${path}`, { method, body, timeout: 10000 });
    return c.json({ status: res.status, data: res.data, from: peerUrl });
  } catch (e: any) { return c.json({ error: e.message }, 502); }
});
