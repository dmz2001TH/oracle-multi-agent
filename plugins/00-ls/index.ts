import type { InvokeContext, InvokeResult } from "../../src/plugins/types.js";
import { manager, store } from "../../src/api/agent-bridge.js";

export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  try {
    const running = manager.getRunningAgents();
    const registered = store.listAgents() as any[];
    const idle = registered.filter(a => !running.some(r => r.id === a.id));
    const lines = [
      `📋 Agents (running: ${running.length}, total: ${registered.length})`,
      "",
      ...running.map(a => `🟢 ${a.name.padEnd(20)} ${a.role.padEnd(15)} ${a.id.slice(0, 8)}`),
      idle.length > 0 ? "\n(idle)" : "",
      ...idle.map(a => `🔴 ${(a.name || a.id.slice(0, 8)).padEnd(20)} ${(a.role || "?").padEnd(15)} idle`),
    ].filter(Boolean);
    if (ctx.source === "api") {
      return { ok: true, data: { running: running.length, total: registered.length, agents: [...running, ...idle] } };
    }
    return { ok: true, output: lines.join("\n") };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
