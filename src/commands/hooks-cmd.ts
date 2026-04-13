/**
 * Hooks CLI — Guide Ch7: Rule Enforcement
 *
 * Usage:
 *   oracle hooks ls                          — list all hooks
 *   oracle hooks test <event> [--from X] [--data '{...}']  — test hook
 *   oracle hooks set <event> <script>        — set external hook
 *   oracle hooks rm <event>                  — remove external hook
 */

import { maw } from "../sdk.js";

export async function routeHooks(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "hooks" && cmd !== "hook") return false;
  const sub = args[1]?.toLowerCase();
  if (!sub || sub === "ls" || sub === "list") await cmdHooksList();
  else if (sub === "test") await cmdHooksTest(args.slice(2));
  else if (sub === "set") await cmdHooksSet(args.slice(2));
  else if (sub === "rm" || sub === "remove") await cmdHooksRm(args.slice(2));
  else { console.error(`unknown hooks subcommand: ${sub}`); process.exit(1); }
  return true;
}

async function cmdHooksList() {
  try {
    const res = await maw.fetch<{
      builtIn: { name: string; description: string }[];
      external: Record<string, string>;
      totalBuiltIn: number;
      totalExternal: number;
    }>("/api/hooks");

    console.log(`\n\x1b[36mHOOKS\x1b[0m (${res.totalBuiltIn} built-in, ${res.totalExternal} external)\n`);

    if (res.builtIn.length) {
      console.log("  \x1b[33mBuilt-in Rules:\x1b[0m");
      for (const rule of res.builtIn) {
        console.log(`    🔧 ${rule.name}`);
        console.log(`       ${rule.description}`);
      }
    }

    if (Object.keys(res.external).length) {
      console.log("\n  \x1b[33mExternal Hooks:\x1b[0m");
      for (const [event, script] of Object.entries(res.external)) {
        console.log(`    📎 ${event} → ${script}`);
      }
    }

    if (!res.builtIn.length && !res.totalExternal) {
      console.log("  \x1b[90mno hooks configured\x1b[0m");
    }
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdHooksTest(args: string[]) {
  const event = args[0];
  if (!event) {
    console.error("usage: oracle hooks test <event> [--from X] [--data '{\"key\":\"val\"}']");
    process.exit(1);
  }

  let from = "test-user";
  let data: Record<string, any> = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) from = args[++i];
    else if (args[i] === "--data" && args[i + 1]) {
      try { data = JSON.parse(args[++i]); } catch { console.error("invalid JSON in --data"); process.exit(1); }
    }
  }

  try {
    const res = await maw.fetch<{
      event: string;
      results: { handled: boolean; action?: string; message?: string }[];
      triggered: number;
    }>("/api/hooks/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, from, data }),
    });

    console.log(`\n\x1b[36mHOOK TEST: ${res.event}\x1b[0m`);
    console.log(`  triggered: ${res.triggered} rule(s)\n`);

    if (res.results.length) {
      for (const r of res.results) {
        const icon = r.action === "warn" ? "⚠️" : r.action === "notify" ? "📣" : r.action === "tag" ? "🏷️" : "🔧";
        console.log(`  ${icon} [${r.action}] ${r.message}`);
      }
    } else {
      console.log("  \x1b[90mno rules triggered\x1b[0m");
    }
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdHooksSet(args: string[]) {
  const event = args[0];
  const script = args[1];
  if (!event || !script) {
    console.error("usage: oracle hooks set <event> <script-path>");
    process.exit(1);
  }

  try {
    await maw.fetch("/api/hooks/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, script }),
    });
    console.log(`\x1b[32m✓\x1b[0m Hook set: ${event} → ${script}`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdHooksRm(args: string[]) {
  const event = args[0];
  if (!event) {
    console.error("usage: oracle hooks rm <event>");
    process.exit(1);
  }

  try {
    await maw.fetch(`/api/hooks/config/${event}`, { method: "DELETE" });
    console.log(`\x1b[32m✓\x1b[0m Hook removed: ${event}`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
