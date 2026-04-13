/**
 * Think CLI — Chapter 6: Overview & Monitoring
 *
 * Usage:
 *   oracle think propose <oracle> "title" [--type improvement|bug|feature|refactor] [--priority low|medium|high] [--desc "details"]
 *   oracle think ls [--oracle X] [--status proposed|accepted|rejected]
 *   oracle think accept <id>
 *   oracle think reject <id>
 *   oracle think rm <id>
 */

import { maw } from "../sdk.js";
import type { ThinkProposal } from "../lib/schemas.js";

export async function cmdThinkPropose(args: string[]) {
  const oracle = args[0];
  if (!oracle) {
    console.error("usage: oracle think propose <oracle> \"title\" [--type improvement|bug|feature] [--priority low|medium|high]");
    process.exit(1);
  }

  const rest = args.slice(1);
  const titleParts: string[] = [];
  let i = 0;
  while (i < rest.length && !rest[i].startsWith("--")) {
    titleParts.push(rest[i]);
    i++;
  }

  if (!titleParts.length) {
    console.error("error: title is required");
    process.exit(1);
  }

  const title = titleParts.join(" ");
  const flags = rest.slice(i);
  let type = "improvement", priority = "medium", description = "";

  for (let j = 0; j < flags.length; j++) {
    if (flags[j] === "--type" && flags[j + 1]) type = flags[++j];
    else if (flags[j] === "--priority" && flags[j + 1]) priority = flags[++j];
    else if (flags[j] === "--desc" && flags[j + 1]) description = flags[++j];
  }

  try {
    const proposal = await maw.fetch<ThinkProposal>("/api/think", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oracle, type, title, description, priority }),
    });
    console.log(`\x1b[32m✓\x1b[0m Proposal #${proposal.id}: "${title}" (${type}, ${priority})`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdThinkList(args: string[]) {
  const params = new URLSearchParams();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--oracle" && args[i + 1]) params.set("oracle", args[++i]);
    else if (args[i] === "--status" && args[i + 1]) params.set("status", args[++i]);
  }

  try {
    const q = params.toString() ? `?${params}` : "";
    const res = await maw.fetch<{ proposals: ThinkProposal[]; total: number }>(`/api/think${q}`);

    if (!res.proposals.length) {
      console.log("\x1b[90mno proposals\x1b[0m");
      return;
    }

    console.log(`\n\x1b[36mTHINK PROPOSALS\x1b[0m (${res.total}):\n`);
    for (const p of res.proposals) {
      const icon = p.status === "accepted" ? "✅" : p.status === "rejected" ? "❌" : "💡";
      const pri = p.priority === "high" ? "\x1b[31mhigh\x1b[0m" : p.priority === "medium" ? "\x1b[33mmed\x1b[0m" : "low";
      console.log(`  ${icon} #${p.id} [${p.type}] ${p.title}`);
      console.log(`     oracle: ${p.oracle} | priority: ${pri} | status: ${p.status}`);
      if (p.description) console.log(`     ${p.description.slice(0, 80)}`);
    }
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdThinkUpdate(args: string[], status: "accepted" | "rejected") {
  const id = args[0];
  if (!id) {
    console.error(`usage: oracle think ${status} <id>`);
    process.exit(1);
  }

  try {
    await maw.fetch(`/api/think/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    console.log(`\x1b[32m✓\x1b[0m Proposal #${id} → ${status}`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdThinkDelete(args: string[]) {
  const id = args[0];
  if (!id) {
    console.error("usage: oracle think rm <id>");
    process.exit(1);
  }

  try {
    await maw.fetch(`/api/think/${id}`, { method: "DELETE" });
    console.log(`\x1b[32m✓\x1b[0m Proposal #${id} deleted`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
