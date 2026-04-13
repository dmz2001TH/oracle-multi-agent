import type { InvokeContext, InvokeResult } from "../../src/plugins/types.js";
import { manager } from "../../src/api/agent-bridge.js";

export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  try {
    if (ctx.source === "cli") {
      const args = Array.isArray(ctx.args) ? ctx.args : [];
      if (args.length === 0) {
        const running = manager.getRunningAgents();
        return { ok: true, output: running.length > 0
          ? `⚡ ${running.length} agents running:\n${running.map(a => `🟢 ${a.name} (${a.role})`).join("\n")}`
          : "⚡ No agents running\nUsage: /wake <name> [role]"
        };
      }
      const name = args[0];
      const role = args[1] || "general";
      const agent = await manager.spawnAgent(name, role);
      return { ok: true, output: `⚡ Woke up ${name} (role: ${role}, id: ${agent.id.slice(0, 8)})` };
    }
    if (ctx.source === "api") {
      const body = ctx.args as Record<string, unknown>;
      const name = (body.name as string) || `Agent${Date.now().toString(36)}`;
      const role = (body.role as string) || "general";
      const agent = await manager.spawnAgent(name, role);
      return { ok: true, data: { id: agent.id, name: agent.name, role: agent.role } };
    }
    return { ok: false, error: "Unsupported source" };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
