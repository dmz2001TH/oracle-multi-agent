/**
 * Oracle Multi-Agent Server — Hono + WebSocket
 */

import { Hono } from "hono";
import { MawEngine } from "./engine/index.js";
import type { WSData } from "./types.js";
import { loadConfig } from "./config.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { setupTriggerListener } from "./trigger-listener.js";

export const views = new Hono();

views.onError((err, c) => c.json({ error: err.message }, 500));

export async function startServer(port = +(process.env.ORACLE_PORT || loadConfig().port || 3456)) {
  const engine = new MawEngine();

  // Hook workflow triggers into feed events
  // setupTriggerListener(engine.feedListeners);

  const config = loadConfig();
  const hasPeers = (config.peers?.length ?? 0) > 0 || (config.namedPeers?.length ?? 0) > 0;
  const hostname = hasPeers ? "0.0.0.0" : "127.0.0.1";

  if (hasPeers && !config.federationToken) {
    console.warn(`\x1b[31m⚠ WARNING: peers configured but no federationToken set!\x1b[0m`);
    console.warn(`\x1b[31m  Add "federationToken" (min 16 chars) to oracle.config.json\x1b[0m`);
  }

  console.log(`Oracle Multi-Agent serve → http://localhost:${port} [${hostname}]`);

  // Note: Full WebSocket support requires @hono/node-server ws adapter
  // This is a basic HTTP server for now — WS will be added in Batch 2
  const { serve } = await import("@hono/node-server");
  serve({ fetch: views.fetch, port, hostname: hostname as string });

  return { engine, port };
}
