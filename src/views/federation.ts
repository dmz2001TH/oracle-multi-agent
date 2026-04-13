import { Hono } from "hono";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../paths.js";

export const federationView = new Hono();

federationView.get("/", (c) => {
  const filePath = join(PROJECT_ROOT, "office/federation.html");
  if (!existsSync(filePath)) {
    return c.text("office/federation.html not found", 404);
  }
  const html = readFileSync(filePath, "utf-8");
  return c.html(html);
});
