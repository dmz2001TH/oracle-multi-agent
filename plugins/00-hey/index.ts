import type { InvokeContext, InvokeResult } from "../../src/plugins/types.js";
import { manager } from "../../src/api/agent-bridge.js";

export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  try {
    let agentName: string, message: string;
    if (ctx.source === "cli") {
      const args = Array.isArray(ctx.args) ? ctx.args : [];
      const spaceIdx = args.join(" ").indexOf(" ");
      if (spaceIdx === -1) return { ok: false, error: 'Usage: /hey <agent> "message"' };
      const joined = args.join(" ");
      agentName = joined.substring(0, joined.indexOf(" ")).trim();
      message = joined.substring(joined.indexOf(" ") + 1).trim();
    } else {
      const body = ctx.args as Record<string, unknown>;
      agentName = (body.agent as string) || "";
      message = (body.message as string) || "";
    }
    if (!agentName || !message) return { ok: false, error: "Missing agent name or message" };
    const running = manager.getRunningAgents();
    const agent = running.find(a => a.name === agentName || a.id.startsWith(agentName));
    if (!agent) return { ok: false, error: `Agent not found: ${agentName}. Active: ${running.map(a => a.name).join(", ")}` };
    manager.chatWithAgent(agent.id, message).catch(() => {});
    return { ok: true, output: `💬 Sent to ${agent.name}: "${message}"` };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
