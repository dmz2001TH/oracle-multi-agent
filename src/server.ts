/**
 * Oracle Multi-Agent Server — Hono + WebSocket
 */

import { Hono } from "hono";
import { MawEngine } from "./engine/index.js";
import { loadConfig, cfgLimit } from "./config.js";
import { setupTriggerListener } from "./trigger-listener.js";

const feedBuffer: any[] = [];
const feedListeners = new Set<(event: any) => void>();

export const views = new Hono();

views.get("/health", (c) => c.json({ ok: true, version: "5.0.0" }));
views.onError((err, c) => c.json({ error: err.message }, 500));

export function createEngine(): MawEngine {
  return new MawEngine({ feedBuffer, feedListeners });
}

export async function startServer(port = +(process.env.ORACLE_PORT || loadConfig().port || 3456)) {
  const engine = createEngine();

  setupTriggerListener(feedListeners);

  const config = loadConfig();
  const hasPeers = (config.peers?.length ?? 0) > 0 || (config.namedPeers?.length ?? 0) > 0;
  const hostname = hasPeers ? "0.0.0.0" : "127.0.0.1";

  if (hasPeers && !config.federationToken) {
    console.warn(`\x1b[31m⚠ WARNING: peers configured but no federationToken set!\x1b[0m`);
    console.warn(`\x1b[31m  Add "federationToken" (min 16 chars) to oracle.config.json\x1b[0m`);
  }

  const { serve } = await import("@hono/node-server");
  serve({ fetch: views.fetch, port, hostname: hostname as string });
  console.log(`🧠 Oracle Multi-Agent v5.0 serve → http://localhost:${port} [${hostname}]`);

  return { engine, port };
}
