/**
 * Chat Log API — Chapter 6: Overview & Monitoring
 *
 * Conversation history per oracle. Human↔Oracle messages.
 *
 * Endpoints:
 *   POST   /api/chat/:oracle          — log a message
 *   GET    /api/chat/:oracle          — get chat history
 *   GET    /api/chat                  — all oracles' recent chats
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ChatMessage } from "../lib/schemas.js";

export const chatLogApi = new Hono();

const CHAT_DIR = join(homedir(), ".oracle", "chat");

function ensureDir() { mkdirSync(CHAT_DIR, { recursive: true }); }

function oracleDir(oracle: string): string { return join(CHAT_DIR, oracle); }

function nextId(oracle: string): string {
  const dir = oracleDir(oracle);
  if (!existsSync(dir)) return "1";
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  const maxNum = files.reduce((max, f) => {
    const n = parseInt(f.replace(".json", ""), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return String(maxNum + 1);
}

// Log a message
chatLogApi.post("/api/chat/:oracle", async (c) => {
  const oracle = c.req.param("oracle");
  const input = await c.req.json();

  if (!input.content) {
    return c.json({ error: "content is required" }, 400);
  }

  const dir = oracleDir(oracle);
  mkdirSync(dir, { recursive: true });

  const msg: ChatMessage = {
    id: nextId(oracle),
    oracle,
    role: input.role || "human",
    content: input.content,
    ts: new Date().toISOString(),
  };

  writeFileSync(join(dir, `${msg.id}.json`), JSON.stringify(msg, null, 2));

  return c.json(msg, 201);
});

// Get chat history for an oracle
chatLogApi.get("/api/chat/:oracle", (c) => {
  const oracle = c.req.param("oracle");
  const dir = oracleDir(oracle);

  if (!existsSync(dir)) {
    return c.json({ messages: [], total: 0 });
  }

  const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort();
  const allMessages: ChatMessage[] = files
    .map(f => {
      try { return JSON.parse(readFileSync(join(dir, f), "utf-8")); } catch { return null; }
    })
    .filter(Boolean) as ChatMessage[];

  // Sort by timestamp ascending
  allMessages.sort((a, b) => a.ts.localeCompare(b.ts));

  // Limit to last N
  const limit = Math.min(200, +(c.req.query("limit") || "50"));
  const messages = allMessages.slice(-limit);

  return c.json({ messages, total: allMessages.length });
});

// Get all oracles' recent chats
chatLogApi.get("/api/chat", (c) => {
  ensureDir();
  if (!existsSync(CHAT_DIR)) return c.json({ chats: [] });

  const oracles = readdirSync(CHAT_DIR).filter(d => {
    try { return existsSync(join(CHAT_DIR, d)); } catch { return false; }
  });

  const chats = oracles.map(oracle => {
    const dir = oracleDir(oracle);
    const files = readdirSync(dir).filter(f => f.endsWith(".json"));
    const lastFile = files.sort().pop();
    let lastMessage: ChatMessage | null = null;
    if (lastFile) {
      try { lastMessage = JSON.parse(readFileSync(join(dir, lastFile), "utf-8")); } catch {}
    }
    return {
      oracle,
      messageCount: files.length,
      lastMessage,
    };
  });

  return c.json({ chats });
});
