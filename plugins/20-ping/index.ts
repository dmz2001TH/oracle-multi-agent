import type { InvokeContext, InvokeResult } from "../../src/plugins/types.js";

export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  const start = Date.now();
  try {
    const res = await fetch("http://localhost:3456/health", { signal: AbortSignal.timeout(3000) });
    const latency = Date.now() - start;
    const data = await res.json();
    return {
      ok: true,
      output: `🏓 Pong! Status: ${res.ok ? "✅ OK" : "❌ Error"} | Latency: ${latency}ms | Version: ${(data as any).version || "?"}`,
      data: { latency, status: res.status, ...(data as any) },
    };
  } catch (e: any) {
    return { ok: false, error: `🏓 Ping failed: ${e.message}` };
  }
}
