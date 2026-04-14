import { Hono } from "hono";
import { isWireGuardAvailable, getInterfaceStatus, pingPeer, getFederationStatus, generateConfig } from "../wireguard/index.js";
export const wireguardApi = new Hono();

wireguardApi.get("/api/wireguard/status", (c) => {
  const iface = c.req.query("iface") || "wg0";
  return c.json({ ok: true, available: isWireGuardAvailable(), interface: getInterfaceStatus(iface) });
});

wireguardApi.post("/api/wireguard/ping", async (c) => {
  const b = await c.req.json();
  return c.json({ ok: true, result: pingPeer(b.endpoint, b.timeout) });
});

wireguardApi.post("/api/wireguard/federation-status", async (c) => {
  const b = await c.req.json();
  return c.json({ ok: true, status: getFederationStatus(b) });
});

wireguardApi.post("/api/wireguard/generate-config", async (c) => {
  const b = await c.req.json();
  return c.json({ ok: true, config: generateConfig(b.config, b.privateKey) });
});
