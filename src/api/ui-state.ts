import { Hono } from "hono";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { CONFIG_DIR } from "../paths.js";

export const uiStateApi = new Hono();
const STATE_DIR = join(CONFIG_DIR, "ui-state");
mkdirSync(STATE_DIR, { recursive: true });

uiStateApi.get("/api/ui-state/:key", (c) => {
  const file = join(STATE_DIR, `${c.req.param("key")}.json`);
  if (!existsSync(file)) return c.json({});
  return c.json(JSON.parse(readFileSync(file, "utf-8")));
});

uiStateApi.post("/api/ui-state/:key", async (c) => {
  const file = join(STATE_DIR, `${c.req.param("key")}.json`);
  const body = await c.req.json();
  writeFileSync(file, JSON.stringify(body, null, 2), "utf-8");
  return c.json({ ok: true });
});
