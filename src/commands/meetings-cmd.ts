/**
 * Meetings CLI — Chapter 6: Overview & Monitoring
 *
 * Usage:
 *   oracle meeting create "topic" [--participants dev,qa,admin]
 *   oracle meeting ls
 *   oracle meeting show <id>
 *   oracle meeting note <id> "note" [--author X]
 *   oracle meeting done <id>
 */

import { maw } from "../sdk.js";
import type { Meeting } from "../lib/schemas.js";

export async function cmdMeetingCreate(args: string[]) {
  const topicParts: string[] = [];
  let i = 0;
  while (i < args.length && !args[i].startsWith("--")) {
    topicParts.push(args[i]);
    i++;
  }

  if (!topicParts.length) {
    console.error("usage: oracle meeting create \"topic\" [--participants dev,qa,admin] [--dry-run]");
    process.exit(1);
  }

  const topic = topicParts.join(" ");
  let participants: string[] = [];
  let dryRun = false;
  const flags = args.slice(i);
  for (let j = 0; j < flags.length; j++) {
    if (flags[j] === "--participants" && flags[j + 1]) {
      participants = flags[++j].split(",").map(s => s.trim());
    } else if (flags[j] === "--dry-run" || flags[j] === "--dry") {
      dryRun = true;
    }
  }

  try {
    const query = dryRun ? "?dry=true" : "";
    const res = await maw.fetch<any>(`/api/meetings${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, participants }),
    });

    if (dryRun) {
      console.log(`\x1b[36m── DRY RUN ──\x1b[0m`);
      console.log(`  topic: ${topic}`);
      console.log(`  participants: ${participants.join(", ") || "none"}`);
      console.log(`  status: scheduled`);
      console.log(`\x1b[90m  (use without --dry-run to create)\x1b[0m\n`);
      return;
    }

    console.log(`\x1b[32m✓\x1b[0m Meeting #${res.id}: "${topic}"`);
    if (participants.length) console.log(`  participants: ${participants.join(", ")}`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdMeetingList() {
  try {
    const res = await maw.fetch<{ meetings: Meeting[] }>("/api/meetings");
    if (!res.meetings.length) {
      console.log("\x1b[90mno meetings\x1b[0m");
      return;
    }

    console.log(`\n\x1b[36mMEETINGS\x1b[0m (${res.meetings.length}):\n`);
    for (const m of res.meetings) {
      const icon = m.status === "completed" ? "✅" : m.status === "in_progress" ? "🔵" : "📅";
      const time = new Date(m.ts).toLocaleString();
      console.log(`  ${icon} #${m.id} [${m.status}] ${m.topic}`);
      console.log(`     ${time} | participants: ${m.participants.join(", ") || "none"}`);
    }
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdMeetingShow(args: string[]) {
  const id = args[0];
  if (!id) {
    console.error("usage: oracle meeting show <id>");
    process.exit(1);
  }

  try {
    const m = await maw.fetch<Meeting>(`/api/meetings/${id}`);
    const time = new Date(m.ts).toLocaleString();
    console.log(`\n\x1b[36mMeeting #${m.id}\x1b[0m: ${m.topic}`);
    console.log(`  status: ${m.status} | time: ${time}`);
    console.log(`  participants: ${m.participants.join(", ") || "none"}`);
    if (m.notes) {
      console.log(`\n  \x1b[33mNotes:\x1b[0m`);
      m.notes.split("\n").filter(Boolean).forEach(n => console.log(`    ${n}`));
    }
    console.log();
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdMeetingNote(args: string[]) {
  const id = args[0];
  if (!id) {
    console.error("usage: oracle meeting note <id> \"note\" [--author X]");
    process.exit(1);
  }

  const rest = args.slice(1);
  const noteParts: string[] = [];
  let i = 0;
  while (i < rest.length && !rest[i].startsWith("--")) {
    noteParts.push(rest[i]);
    i++;
  }

  if (!noteParts.length) {
    console.error("error: note text required");
    process.exit(1);
  }

  const note = noteParts.join(" ");
  let author: string | undefined;
  const flags = rest.slice(i);
  for (let j = 0; j < flags.length; j++) {
    if (flags[j] === "--author" && flags[j + 1]) author = flags[++j];
  }

  try {
    await maw.fetch(`/api/meetings/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, author }),
    });
    console.log(`\x1b[32m✓\x1b[0m Note added to meeting #${id}`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

export async function cmdMeetingDone(args: string[]) {
  const id = args[0];
  if (!id) {
    console.error("usage: oracle meeting done <id>");
    process.exit(1);
  }

  try {
    await maw.fetch(`/api/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    console.log(`\x1b[32m✓\x1b[0m Meeting #${id} completed`);
  } catch (err: any) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
