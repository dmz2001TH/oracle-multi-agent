import type { InvokeContext, InvokeResult } from "../../src/plugins/types.js";
import { manager } from "../../src/api/agent-bridge.js";
import { hostname } from "node:os";

export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  const running = manager.getRunningAgents();
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  const output = [
    `📊 ${hostname()} | ${h}h ${m}m | ${mem}MB heap`,
    `🤖 ${running.length} agents: ${running.map(a => `${a.name}(${a.role})`).join(", ") || "none"}`,
  ].join("\n");

  if (ctx.source === "api") return { ok: true, data: { hostname: hostname(), uptime, memory: mem, agents: running.length } };
  return { ok: true, output };
}
