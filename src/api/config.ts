import { Hono } from "hono";
import { readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from "fs";
import { join, basename } from "path";
import { loadConfig, saveConfig, configForDisplay } from "../config.js";
import { FLEET_DIR as fleetDir } from "../paths.js";

export const configApi = new Hono();

configApi.get("/api/config-files", (c) => {
  const files: { name: string; path: string; enabled: boolean }[] = [{ name: "oracle.config.json", path: "oracle.config.json", enabled: true }];
  try { for (const f of readdirSync(fleetDir).filter(f => f.endsWith(".json") || f.endsWith(".json.disabled")).sort()) files.push({ name: f, path: `fleet/${f}`, enabled: !f.endsWith(".disabled") }); } catch {}
  return c.json({ files });
});

configApi.get("/api/config-file", (c) => {
  const filePath = c.req.query("path");
  if (!filePath) return c.json({ error: "path required" }, 400);
  if (filePath.includes("..")) return c.json({ error: "invalid path" }, 400);
  try {
    const content = readFileSync(join(process.cwd(), filePath), "utf-8");
    if (filePath === "oracle.config.json") { const display = configForDisplay(); return c.json({ config: display }); }
    return c.json({ content });
  } catch { return c.json({ error: "not found" }, 404); }
});

configApi.get("/api/config", (c) => {
  if (c.req.query("raw") === "1") return c.json(loadConfig());
  return c.json(configForDisplay());
});

configApi.post("/api/config", async (c) => {
  try {
    const data = await c.req.json();
    if (data.env && typeof data.env === "object") {
      const current = loadConfig();
      const merged: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.env as Record<string, string>)) merged[k] = /\u2022/.test(v) ? (current.env[k] || v) : v;
      data.env = merged;
    }
    saveConfig(data);
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 400); }
});

configApi.post("/api/config-file", async (c) => {
  const filePath = c.req.query("path");
  if (!filePath) return c.json({ error: "path required" }, 400);
  try {
    const { content } = await c.req.json();
    JSON.parse(content);
    if (filePath === "oracle.config.json") {
      const parsed = JSON.parse(content);
      if (parsed.env) { const current = loadConfig(); for (const [k, v] of Object.entries(parsed.env as Record<string, string>)) { if (/\u2022/.test(v)) (parsed.env as any)[k] = current.env[k] || v; } }
      saveConfig(parsed);
    } else { writeFileSync(join(process.cwd(), filePath), content + "\n", "utf-8"); }
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 400); }
});

configApi.post("/api/config-file/toggle", (c) => {
  const filePath = c.req.query("path");
  if (!filePath?.startsWith("fleet/")) return c.json({ error: "invalid path" }, 400);
  const fullPath = join(process.cwd(), filePath);
  if (!existsSync(fullPath)) return c.json({ error: "not found" }, 404);
  const isDisabled = filePath.endsWith(".disabled");
  const newPath = isDisabled ? fullPath.replace(/\.disabled$/, "") : fullPath + ".disabled";
  renameSync(fullPath, newPath);
  return c.json({ ok: true, newPath: isDisabled ? filePath.replace(/\.disabled$/, "") : filePath + ".disabled" });
});

configApi.delete("/api/config-file", (c) => {
  const filePath = c.req.query("path");
  if (!filePath?.startsWith("fleet/")) return c.json({ error: "cannot delete" }, 400);
  const fullPath = join(process.cwd(), filePath);
  if (!existsSync(fullPath)) return c.json({ error: "not found" }, 404);
  unlinkSync(fullPath);
  return c.json({ ok: true });
});

configApi.put("/api/config-file", async (c) => {
  const { name, content } = await c.req.json();
  if (!name?.endsWith(".json")) return c.json({ error: "name must end with .json" }, 400);
  const safeName = basename(name);
  const fullPath = join(fleetDir, safeName);
  if (existsSync(fullPath)) return c.json({ error: "file already exists" }, 409);
  try { JSON.parse(content); } catch { return c.json({ error: "invalid JSON" }, 400); }
  writeFileSync(fullPath, content + "\n", "utf-8");
  return c.json({ ok: true, path: `fleet/${safeName}` });
});
