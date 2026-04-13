/**
 * Chat Log CLI — Chapter 6: Overview & Monitoring
 *
 * Usage:
 *   oracle chat <oracle>              — view chat history
 *   oracle chat send <oracle> "msg"   — send as human
 *   oracle chat reply <oracle> "msg"  — log oracle reply
 *   oracle chat ls                    — list all oracles with chats
 */

import { maw } from "../sdk.js";
import type { ChatMessage } from "../lib/schemas.js";

export async function cmdChatShow(oracle: string, limit: string = "20") {
  try {
    const res = await maw.fetch<{ messages: ChatMessage[]; total: number }>(`/api/chat/${oracle}?limit=${limit}`);

    if (!res.messages.length) {
      console.log(`\x1b[90mno chat history with ${oracle}\x1b[0m`);
      return;
    }

    console.log(`\n\x1b[36mCHAT: ${oracle}\x1b[0m (${res.total} messages, showing ${res.messages.length})\n`);
    for (const msg of res.messages) {
      const time = new Date(msg.ts).toLocaleTimeString();
      const prefix = msg.role === "human" ? "\x1b[32m→ human\x1b[0m" :
                     msg.role === "oracle" ? `\x1b[36m← ${oracle}\x1b[0m` :
                     "\x1b[90m  system\x1b[0m";
      console.log(`  [${time}] ${prefix}: ${msg.content}`);
    }
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdChatSend(args: string[]) {
  const oracle = args[0];
  if (!oracle) {
    console.error("usage: oracle chat send <oracle> \"message\"");
    process.exit(1);
  }

  const content = args.slice(1).join(" ");
  if (!content) {
    console.error("error: message required");
    process.exit(1);
  }

  try {
    await maw.fetch(`/api/chat/${oracle}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "human", content }),
    });
    console.log(`\x1b[32m→\x1b[0m ${oracle}: ${content}`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdChatReply(args: string[]) {
  const oracle = args[0];
  if (!oracle) {
    console.error("usage: oracle chat reply <oracle> \"message\"");
    process.exit(1);
  }

  const content = args.slice(1).join(" ");
  if (!content) {
    console.error("error: message required");
    process.exit(1);
  }

  try {
    await maw.fetch(`/api/chat/${oracle}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "oracle", content }),
    });
    console.log(`\x1b[36m←\x1b[0m ${oracle}: ${content}`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdChatList() {
  try {
    const res = await maw.fetch<{ chats: { oracle: string; messageCount: number; lastMessage: ChatMessage | null }[] }>("/api/chat");

    if (!res.chats.length) {
      console.log("\x1b[90mno chat histories\x1b[0m");
      return;
    }

    console.log(`\n\x1b[36mCHAT HISTORIES\x1b[0m (${res.chats.length} oracles):\n`);
    for (const c of res.chats) {
      const last = c.lastMessage;
      const time = last ? new Date(last.ts).toLocaleString() : "—";
      const preview = last ? last.content.slice(0, 50) : "";
      console.log(`  💬 ${c.oracle.padEnd(15)} ${c.messageCount} msgs | last: ${time}`);
      if (preview) console.log(`     ${preview}${last && last.content.length > 50 ? "..." : ""}`);
    }
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
