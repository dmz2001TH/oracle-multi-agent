import { Hono } from "hono";
import { getFederationStatus } from "../peers.js";
import { loadConfig } from "../config.js";
import { listSnapshots, loadSnapshot } from "../snapshot.js";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { FLEET_DIR } from "../paths.js";

export const federationApi = new Hono();

federationApi.get("/api/federation/status", async (c) => c.json(await getFederationStatus()));
federationApi.get("/api/snapshots", (c) => c.json(listSnapshots()));
federationApi.get("/api/snapshots/:id", (c) => { const snap = loadSnapshot(c.req.param("id")); return snap ? c.json(snap) : c.json({ error: "not found" }, 404); });

federationApi.get("/api/identity", (c) => {
  const config = loadConfig();
  return c.json({ node: config.node ?? "local", version: "5.0.0", agents: Object.keys(config.agents || {}), uptime: Math.floor(process.uptime()), clockUtc: new Date().toISOString() });
});

federationApi.get("/api/fleet", (c) => {
  try {
    const files = readdirSync(FLEET_DIR).filter(f => f.endsWith(".json") && !f.endsWith(".disabled"));
    return c.json({ fleet: files.map(f => { try { return { file: f, ...JSON.parse(readFileSync(join(FLEET_DIR, f), "utf-8")) }; } catch { return null; } }).filter(Boolean) });
  } catch { return c.json({ fleet: [] }); }
});

federationApi.get("/api/auth/status", (c) => {
  const config = loadConfig();
  const token = config.federationToken;
  return c.json({ enabled: !!token, method: token ? "HMAC-SHA256" : "none", node: config.node ?? "local" });
});
