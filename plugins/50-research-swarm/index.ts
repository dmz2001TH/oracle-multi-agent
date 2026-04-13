import type { InvokeContext, InvokeResult } from "../../src/plugins/types.js";
import { manager } from "../../src/api/agent-bridge.js";

const SWARM_ROLES = ["researcher", "data-analyst", "writer"];

export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  try {
    let topic: string, agentCount: number;
    if (ctx.source === "cli") {
      const args = Array.isArray(ctx.args) ? ctx.args : [];
      const joined = args.join(" ");
      const agentsIdx = joined.indexOf("--agents");
      topic = agentsIdx >= 0 ? joined.substring(0, agentsIdx).trim() : joined.trim();
      agentCount = agentsIdx >= 0 ? parseInt(joined.substring(agentsIdx + 9).trim()) || 3 : 3;
    } else {
      const body = ctx.args as Record<string, unknown>;
      topic = (body.topic as string) || "";
      agentCount = (body.agents as number) || 3;
    }
    if (!topic) return { ok: false, error: "Usage: /swarm <topic> [--agents N]" };

    const spawned: string[] = [];
    const roles = SWARM_ROLES.slice(0, agentCount);

    for (let i = 0; i < roles.length; i++) {
      const name = `swarm-${roles[i]}-${Date.now().toString(36).slice(-4)}`;
      const agent = await manager.spawnAgent(name, roles[i]);
      spawned.push(`${name} (${roles[i]})`);

      // Send research prompt
      setTimeout(() => {
        manager.chatWithAgent(agent.id, `Research topic: "${topic}"\nApproach from your role perspective (${roles[i]}). Find key insights, patterns, and actionable findings. Report back your top 3 findings.`).catch(() => {});
      }, 2000 + i * 1000);
    }

    return {
      ok: true,
      output: [
        `🐝 **Research Swarm** — Topic: "${topic}"`,
        "",
        `Spawning ${spawned.length} agents:`,
        ...spawned.map(s => `- ${s}`),
        "",
        "⏳ Agents will research in parallel and report back...",
        "Use /think --oracles to collect results",
      ].join("\n"),
      data: { topic, agents: spawned },
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
