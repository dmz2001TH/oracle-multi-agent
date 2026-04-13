import { Hono } from "hono";
import { loadConfig } from "../config.js";

export const oracleApi = new Hono();

const ORACLE_URL = process.env.ORACLE_URL || loadConfig().oracleUrl;

oracleApi.get("/api/oracle/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "q required" }, 400);
  try {
    const params = new URLSearchParams({ q, mode: c.req.query("mode") || "hybrid", limit: c.req.query("limit") || "10" });
    const res = await fetch(`${ORACLE_URL}/api/search?${params}`);
    return c.json(await res.json());
  } catch (e: any) { return c.json({ error: `Oracle unreachable: ${e.message}` }, 502); }
});

oracleApi.get("/api/oracle/stats", async (c) => {
  try { const res = await fetch(`${ORACLE_URL}/api/stats`); return c.json(await res.json()); }
  catch (e: any) { return c.json({ error: `Oracle unreachable: ${e.message}` }, 502); }
});

oracleApi.get("/api/oracle/traces", async (c) => {
  try { const res = await fetch(`${ORACLE_URL}/api/traces?limit=${c.req.query("limit") || "10"}`); return c.json(await res.json()); }
  catch (e: any) { return c.json({ error: `Oracle unreachable: ${e.message}` }, 502); }
});
