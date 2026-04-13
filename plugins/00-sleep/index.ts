import type { InvokeContext, InvokeResult } from "../../src/plugins/types.js";
import { manager } from "../../src/api/agent-bridge.js";

export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  try {
    let agentName: string;
    if (ctx.source === "cli") {
      const args = Array.isArray(ctx.args) ? ctx.args : [];
      if (!args[0]) return { ok: false, error: "Usage: /sleep <agent-name>" };
      agentName = args[0];
    } else {
      agentName = (ctx.args as any)?.name || "";
      if (!agentName) return { ok: false, error: "Missing 'name' field" };
    }
    const running = manager.getRunningAgents();
    const agent = running.find(a => a.name === agentName || a.id.startsWith(agentName));
    if (!agent) return { ok: false, error: `Agent not found: ${agentName}` };
    manager.stopAgent(agent.id);
    return { ok: true, output: `💤 ${agent.name} is sleeping` };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
