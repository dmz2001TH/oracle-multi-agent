import type { InvokeContext, InvokeResult } from "../../src/plugins/types.js";
import { manager } from "../../src/api/agent-bridge.js";

export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  try {
    let name: string, role: string, parent: string | null;
    if (ctx.source === "cli") {
      const args = Array.isArray(ctx.args) ? ctx.args : [];
      if (!args[0]) return { ok: false, error: "Usage: /bud <name> --from <parent-role> | --root" };
      name = args[0];
      const fromIdx = args.indexOf("--from");
      const rootIdx = args.indexOf("--root");
      parent = fromIdx >= 0 ? args[fromIdx + 1] : null;
      role = parent || (rootIdx >= 0 ? "general" : "general");
    } else {
      const body = ctx.args as Record<string, unknown>;
      name = (body.name as string) || "";
      role = (body.role as string) || "general";
      parent = (body.parent as string) || null;
    }
    if (!name) return { ok: false, error: "Missing name" };
    const agent = await manager.spawnAgent(name, role);
    return { ok: true, output: `🌱 Budded ${name} (role: ${role}${parent ? `, from: ${parent}` : ", root"}) — id: ${agent.id.slice(0, 8)}` };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
