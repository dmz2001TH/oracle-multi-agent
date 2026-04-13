/**
 * Tokens CLI — Chapter 6: Overview & Monitoring
 *
 * Usage:
 *   oracle tokens              — show all usage
 *   oracle tokens record <agent> --input N --output N --cost N
 *   oracle tokens reset
 */

import { maw } from "../sdk.js";
import type { TokenStats } from "../lib/schemas.js";

export async function cmdTokensShow() {
  try {
    const stats = await maw.fetch<TokenStats>("/api/tokens");
    if (!stats.agents.length) {
      console.log("\x1b[90mno token usage recorded\x1b[0m");
      return;
    }

    console.log(`\n\x1b[36mTOKEN USAGE\x1b[0m\n`);
    console.log(`  ${"Agent".padEnd(20)} ${"Input".padStart(10)} ${"Output".padStart(10)} ${"Cost".padStart(10)}`);
    console.log(`  ${"─".repeat(20)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(10)}`);
    for (const a of stats.agents) {
      console.log(`  ${a.agent.padEnd(20)} ${String(a.inputTokens).padStart(10)} ${String(a.outputTokens).padStart(10)} $${a.cost.toFixed(4).padStart(9)}`);
    }
    console.log(`  ${"─".repeat(20)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(10)}`);
    console.log(`  ${"TOTAL".padEnd(20)} ${String(stats.totalInput).padStart(10)} ${String(stats.totalOutput).padStart(10)} $${stats.totalCost.toFixed(4).padStart(9)}`);
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdTokensRecord(args: string[]) {
  const agent = args[0];
  if (!agent) {
    console.error("usage: oracle tokens record <agent> --input N --output N --cost N");
    process.exit(1);
  }

  let inputTokens = 0, outputTokens = 0, cost = 0;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) inputTokens = parseInt(args[++i], 10);
    else if (args[i] === "--output" && args[i + 1]) outputTokens = parseInt(args[++i], 10);
    else if (args[i] === "--cost" && args[i + 1]) cost = parseFloat(args[++i]);
  }

  try {
    await maw.fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, inputTokens, outputTokens, cost }),
    });
    console.log(`\x1b[32m✓\x1b[0m Tokens recorded for ${agent}`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdTokensReset() {
  try {
    await maw.fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    console.log("\x1b[32m✓\x1b[0m Token stats reset");
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
