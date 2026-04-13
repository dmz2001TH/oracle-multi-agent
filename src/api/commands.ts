/**
 * Commands API — REST endpoints for CLI commands
 */

import { Hono } from "hono";
import { executeCommand, listCommands } from "../commands/index.js";

export const commandsApi = new Hono();

// GET /api/commands — list all commands
commandsApi.get("/api/commands", (c) => {
  return c.json({ ok: true, commands: listCommands() });
});

// POST /api/commands/execute — execute a command
commandsApi.post("/api/commands/execute", async (c) => {
  try {
    const body = await c.req.json();
    const { input, sessionId, userId } = body;

    if (!input || typeof input !== "string") {
      return c.json({ ok: false, error: "Missing 'input' field" }, 400);
    }

    const result = executeCommand(input, { sessionId, userId });
    return c.json({ ok: result.status === "ok", ...result });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// POST /api/commands/:name — execute a specific command by name
commandsApi.post("/api/commands/:name", async (c) => {
  try {
    const name = c.req.param("name");
    const body = await c.req.json().catch(() => ({}));
    const args = body.args || body.input || "";
    const input = `/${name} ${args}`.trim();

    const result = executeCommand(input, {
      sessionId: body.sessionId,
      userId: body.userId,
    });
    return c.json({ ok: result.status === "ok", ...result });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});
