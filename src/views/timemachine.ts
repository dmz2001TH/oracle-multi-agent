import { Hono } from "hono";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../paths.js";

export const timemachineView = new Hono();

timemachineView.get("/", (c) => {
  const filePath = join(PROJECT_ROOT, "office/timemachine.html");
  if (!existsSync(filePath)) {
    return c.text("office/timemachine.html not found", 404);
  }
  const html = readFileSync(filePath, "utf-8");
  return c.html(html);
});
