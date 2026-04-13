/**
 * Meeting API — Chapter 6: Overview & Monitoring
 *
 * Wake related agents, collect input, create summary.
 *
 * Endpoints:
 *   POST   /api/meetings              — create meeting
 *   GET    /api/meetings              — list meetings
 *   GET    /api/meetings/:id          — get meeting
 *   POST   /api/meetings/:id/notes    — add notes
 *   PATCH  /api/meetings/:id          — update meeting status
 */

import { Hono } from "hono";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { Meeting } from "../lib/schemas.js";

export const meetingsApi = new Hono();

const MEETINGS_DIR = join(homedir(), ".oracle", "meetings");

function ensureDir() { mkdirSync(MEETINGS_DIR, { recursive: true }); }

function meetingPath(id: string): string { return join(MEETINGS_DIR, `${id}.json`); }

function nextId(): string {
  ensureDir();
  const files = readdirSync(MEETINGS_DIR).filter(f => f.endsWith(".json"));
  const maxNum = files.reduce((max, f) => {
    const n = parseInt(f.replace(".json", ""), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return String(maxNum + 1);
}

function loadMeeting(id: string): Meeting | null {
  try { return JSON.parse(readFileSync(meetingPath(id), "utf-8")); } catch { return null; }
}

// Create meeting
meetingsApi.post("/api/meetings", async (c) => {
  const input = await c.req.json();

  if (!input.topic) {
    return c.json({ error: "topic is required" }, 400);
  }

  const meeting: Meeting = {
    id: nextId(),
    topic: input.topic,
    participants: input.participants || [],
    status: "scheduled",
    notes: "",
    ts: new Date().toISOString(),
  };

  ensureDir();
  writeFileSync(meetingPath(meeting.id), JSON.stringify(meeting, null, 2));

  return c.json(meeting, 201);
});

// List meetings
meetingsApi.get("/api/meetings", (c) => {
  ensureDir();
  if (!existsSync(MEETINGS_DIR)) return c.json({ meetings: [] });

  const files = readdirSync(MEETINGS_DIR).filter(f => f.endsWith(".json"));
  const meetings: Meeting[] = files
    .map(f => {
      try { return JSON.parse(readFileSync(join(MEETINGS_DIR, f), "utf-8")); } catch { return null; }
    })
    .filter(Boolean) as Meeting[];

  meetings.sort((a, b) => b.ts.localeCompare(a.ts));

  return c.json({ meetings, total: meetings.length });
});

// Get single meeting
meetingsApi.get("/api/meetings/:id", (c) => {
  const meeting = loadMeeting(c.req.param("id"));
  if (!meeting) return c.json({ error: "meeting not found" }, 404);
  return c.json(meeting);
});

// Add notes
meetingsApi.post("/api/meetings/:id/notes", async (c) => {
  const meeting = loadMeeting(c.req.param("id"));
  if (!meeting) return c.json({ error: "meeting not found" }, 404);

  const { note, author } = await c.req.json();
  const timestamp = new Date().toLocaleTimeString();
  const prefix = author ? `[${author} ${timestamp}]` : `[${timestamp}]`;
  meeting.notes += `${prefix} ${note}\n`;

  writeFileSync(meetingPath(meeting.id), JSON.stringify(meeting, null, 2));

  return c.json(meeting);
});

// Update meeting status
meetingsApi.patch("/api/meetings/:id", async (c) => {
  const meeting = loadMeeting(c.req.param("id"));
  if (!meeting) return c.json({ error: "meeting not found" }, 404);

  const input = await c.req.json();
  if (input.status) meeting.status = input.status;

  writeFileSync(meetingPath(meeting.id), JSON.stringify(meeting, null, 2));

  return c.json(meeting);
});
