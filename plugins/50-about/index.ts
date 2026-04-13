import type { InvokeContext, InvokeResult } from "../../src/plugins/types.js";
import { manager, store } from "../../src/api/agent-bridge.js";
import { hostname, platform, arch } from "node:os";

export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  try {
    const target = (Array.isArray(ctx.args) ? ctx.args[0] : (ctx.args as any)?.name) || "";
    const running = manager.getRunningAgents();

    if (target) {
      const agent = running.find(a => a.name === target || a.id.startsWith(target));
      if (!agent) return { ok: false, error: `Agent not found: ${target}` };
      const messages = store.getMessages(agent.id as any, 5) as any[];
      return {
        ok: true,
        output: [
          `📋 **About: ${agent.name}**`,
          `Role: ${agent.role}`,
          `ID: ${agent.id}`,
          `Status: running`,
          "",
          `Recent messages: ${messages.length}`,
          ...messages.map(m => `  [${new Date(m.timestamp || Date.now()).toLocaleTimeString()}] ${m.role}: ${(m.content || "").slice(0, 80)}`),
        ].join("\n"),
      };
    }

    // System about
    return {
      ok: true,
      output: [
        "🔮 **Oracle Multi-Agent v5.0**",
        `Host: ${hostname()} (${platform()} ${arch()})`,
        `PID: ${process.pid} | Uptime: ${Math.floor(process.uptime())}s`,
        `Agents: ${running.length} running`,
        "",
        running.map(a => `- ${a.name} (${a.role})`).join("\n") || "(no agents)",
      ].join("\n"),
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
