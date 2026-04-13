import { Hono } from "hono";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const asksApi = new Hono();
const asksPath = join(process.cwd(), "asks.json");

asksApi.get("/api/asks", () => { try { if (!existsSync(asksPath)) return new Response("[]", { headers: { "Content-Type": "application/json" } }); return new Response(readFileSync(asksPath, "utf-8"), { headers: { "Content-Type": "application/json" } }); } catch { return new Response("[]", { headers: { "Content-Type": "application/json" } }); } });
asksApi.post("/api/asks", async (c) => { const body = await c.req.json(); writeFileSync(asksPath, JSON.stringify(body, null, 2), "utf-8"); return c.json({ ok: true }); });
