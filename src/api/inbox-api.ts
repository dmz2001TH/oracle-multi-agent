/**
 * Inbox API — Chapter 3: persistent, file-backed message bus
 * Messages survive session death. Read via /inbox at next session start.
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { InboxMessage } from "../lib/schemas.js";

export const inboxApi = new Hono();

const INBOX_DIR = join(homedir(), ".oracle", "inbox");

function ensureDir() { mkdirSync(INBOX_DIR, { recursive: true }); }

// List inbox messages
inboxApi.get("/api/inbox", (c) => {
  ensureDir();
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const unreadOnly = c.req.query("unread") === "true";

  const files = readdirSync(INBOX_DIR).filter(f => f.endsWith(".json"));
  let messages: InboxMessage[] = files.map(f => {
    try { return JSON.parse(readFileSync(join(INBOX_DIR, f), "utf-8")); } catch { return null; }
  }).filter(Boolean) as InboxMessage[];

  if (unreadOnly) messages = messages.filter(m => !m.read);
  messages.sort((a, b) => b.ts.localeCompare(a.ts));
  messages = messages.slice(0, limit);

  return c.json({ messages, total: messages.length });
});

// Write to inbox
inboxApi.post("/api/inbox", async (c) => {
  ensureDir();
  const body = await c.req.json();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const msg: InboxMessage = {
    id,
    from: body.from || "unknown",
    to: body.to || "inbox",
    subject: body.subject,
    body: body.body || "",
    ts: new Date().toISOString(),
    read: false,
    tags: body.tags || [],
  };

  writeFileSync(join(INBOX_DIR, `${id}.json`), JSON.stringify(msg, null, 2));
  return c.json(msg, 201);
});

// Mark as read
inboxApi.patch("/api/inbox/:id", (c) => {
  const path = join(INBOX_DIR, `${c.req.param("id")}.json`);
  if (!existsSync(path)) return c.json({ error: "not found" }, 404);

  const msg: InboxMessage = JSON.parse(readFileSync(path, "utf-8"));
  msg.read = true;
  writeFileSync(path, JSON.stringify(msg, null, 2));
  return c.json(msg);
});
