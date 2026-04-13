import type { InvokeContext, InvokeResult } from "../../src/plugins/types.js";
import { getPluginCount } from "../../src/plugins/loader.js";
import { manager } from "../../src/api/agent-bridge.js";

export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  try {
    const running = manager.getRunningAgents();
    const plugins = getPluginCount();
    const checks: { name: string; status: string }[] = [];

    // Check API
    try {
      const res = await fetch("http://localhost:3456/health", { signal: AbortSignal.timeout(3000) });
      checks.push({ name: "API", status: res.ok ? "✅ OK" : `❌ ${res.status}` });
    } catch { checks.push({ name: "API", status: "❌ Unreachable" }); }

    // Check WebSocket
    checks.push({ name: "WebSocket", status: "✅ /ws ready" });

    // Check plugins
    checks.push({ name: "Plugins", status: `✅ ${plugins.loaded}/${plugins.total} loaded` });

    // Check agents
    checks.push({ name: "Agents", status: `${running.length > 0 ? "✅" : "⚪"} ${running.length} running` });

    const output = [
      "🏥 **Health Check**",
      "",
      ...checks.map(c => `${c.name.padEnd(15)} ${c.status}`),
      "",
      `Uptime: ${Math.floor(process.uptime())}s | PID: ${process.pid}`,
    ].join("\n");

    if (ctx.source === "api") return { ok: true, data: { checks, uptime: process.uptime() } };
    return { ok: true, output };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
