import { Hono } from "hono";
import { loadConfig } from "../config.js";
import { curlFetch } from "../curl-fetch.js";

export const peerExecApi = new Hono();

peerExecApi.post("/api/peer/exec", async (c) => {
  const { peer, cmd, args = [] } = await c.req.json();
  if (!peer || !cmd) return c.json({ error: "missing peer or cmd" }, 400);
  const config = loadConfig();
  const namedPeers = config.namedPeers || [];
  const match = namedPeers.find(p => p.name === peer);
  const peerUrl = match?.url || (peer.startsWith("http") ? peer : null);
  if (!peerUrl) return c.json({ error: "unknown peer" }, 404);
  try {
    const res = await curlFetch(`${peerUrl}/api/peer/exec`, { method: "POST", body: JSON.stringify({ cmd, args }), timeout: 15000 });
    return c.json({ output: res.data, from: peerUrl, status: res.status });
  } catch (e: any) { return c.json({ error: e.message }, 502); }
});
