# Appendix A — Mailbox Directory Schema

> The full on-disk shape of a persistent agent mailbox.

This appendix is a reference. It defines the directory layout, file formats, and conventions used by every agent in the systems this book is drawn from. Adopt it verbatim, or modify to taste — but if you modify, keep the invariants at the end of the appendix, because the invariants are what make the pattern work.

## Directory Tree

A single agent's mailbox lives under `ψ/agents/<agent-name>/`. Everything that belongs to that agent is inside. Nothing outside that directory should be mutated by the agent as part of normal operation.

```
ψ/agents/my-agent/
  identity.md
  standing-orders.md
  mailbox/
    context.md
    findings.md
    inbox/
      2026-04-13T14-15-02_from-lead_subject.json
      2026-04-13T14-22-17_from-peer_subject.json
    outbox/
      2026-04-13T14-18-43_to-lead_subject.json
    sent/
    archive/
      2026-04-12-10-00/
        context.md
        findings.md
  retrospectives/
    2026-04/
      12/
        22.15_session-end.md
      13/
        14.15_session-end.md
  handoffs/
    2026-04-12_22-15_to-next-session.md
    2026-04-13_14-15_to-next-session.md
  archive/
    mailbox-2026-04-10/
    mailbox-2026-04-11/
```

The layout is deliberately flat where possible. Directories correspond to clearly separable concerns. Filenames carry enough metadata (timestamps, senders, subjects) to be useful under plain `ls` without any additional indexing.

## Top-Level Files

### `identity.md`

The stable, slowly-changing description of who this agent is. Read at the start of every session. Rarely written to.

```markdown
# Identity: my-agent

- **Name:** my-agent
- **Role:** (one-line role description)
- **Parent:** neo (for lineage tracking; see ch. 8-10)
- **Awakened:** 2026-04-07
- **Voice:** (tone / style guide)
- **Scope:** (what this agent is and is not responsible for)
```

Think of this as the agent's "constitution." It changes when the agent's purpose changes, which should be rare and deliberate.

### `standing-orders.md`

The rules and policies the agent always follows, in priority order. Read at the start of every session. Updated when the operator wants to change behavior persistently.

```markdown
# Standing Orders — my-agent

1. Always ground via observation before claiming state.
2. Never delete — archive with timestamp.
3. Every commit must include `Co-Authored-By:` with agent name.
4. Before shipping, re-read latest handoff.
5. (etc.)
```

Standing orders are the persistent rulebook. One of them is usually "read the latest handoff first" — which creates a chain where every session picks up where the last one left off.

## `mailbox/`

The active working directory. This is the part of the brain the agent actively reads and writes during a session.

### `mailbox/context.md`

The "currently working on" file. A short (usually < 500 lines) snapshot of the active task, the relevant background, and the current state of thought.

Format is loose. Markdown is the norm. Section headings that are stable across agents help:

```markdown
# Context — as of 2026-04-13 14:15

## Current task
(one or two sentences)

## Why it matters
(why this task is happening)

## Relevant prior work
(pointers, not repetition — links to files, PRs, commits)

## Open questions
(the stuff still uncertain)

## Next move
(the one thing to do next)
```

`context.md` is mutable — it gets overwritten as the agent's situation changes. But overwrites go through the archive pattern (see below); the file is not just clobbered.

### `mailbox/findings.md`

Append-only. This is the agent's long-lived record of things it has learned that it wants its future self (or peers) to know. Each finding is a short note, dated, signed.

```markdown
# Findings — my-agent

## 2026-04-13 14:15 — retry policy on the inbox loop
When the inbox watcher crashes mid-poll, restarting it without a debounce causes duplicate deliveries. Added a 2s debounce; verified.
— my-agent

## 2026-04-13 14:32 — auth token rotation happens at 04:00 UTC
All sessions spanning 04:00 must re-read the token. Previous assumption that tokens were session-scoped was wrong.
— my-agent
```

Invariant: **new findings go at the bottom**. Never rewrite an existing finding; if it was wrong, append a correction:

```markdown
## 2026-04-14 09:00 — correction to 2026-04-13 14:15 finding
The 2s debounce wasn't enough on the flakier branch. Raised to 5s.
— my-agent
```

The chronology is the value. Rewriting the past erases the mechanism by which the agent learns.

### `mailbox/inbox/` and `mailbox/outbox/`

JSON files, one per message. Filenames follow the pattern:

```
YYYY-MM-DDTHH-MM-SS_from-<sender>_<short-subject>.json
```

for inbox, and:

```
YYYY-MM-DDTHH-MM-SS_to-<recipient>_<short-subject>.json
```

for outbox. Timestamps are in the agent's local timezone or UTC — be consistent across the system. The short subject is a filename-safe slug (lowercase, hyphens).

Each JSON message has a stable schema:

```json
{
  "id": "uuid-v4",
  "from": "sender-agent-or-human-name",
  "to": "my-agent",
  "subject": "short subject",
  "body": "message content, can be long, markdown-friendly",
  "sent_at": "2026-04-13T14:15:02+07:00",
  "received_at": "2026-04-13T14:15:04+07:00",
  "thread_id": "uuid-v4-or-null",
  "in_reply_to": "message-id-or-null",
  "metadata": {}
}
```

The `thread_id` lets you reconstruct conversations. `in_reply_to` lets you walk reply chains. `metadata` is the escape hatch for agent-specific fields.

When a message is acted upon, it doesn't get deleted — it gets moved to `mailbox/sent/` (for outbox) or `mailbox/handled/` (for inbox), preserving the JSON untouched. This is the mailbox application of the first principle.

### `mailbox/archive/`

When `context.md` or `findings.md` gets too big to usefully scan, the operator (or a scheduled job) runs an archive operation:

```
mailbox/archive/YYYY-MM-DD-HH-MM/
  context.md
  findings.md
```

Active `context.md` and `findings.md` become shorter (starting fresh, or with only the most recent entries). The old content is one `cat` away if needed.

Never `rm`. Always `mv` into archive.

## `retrospectives/`

Organized by year-month and day. Each session produces exactly one file at its end:

```
retrospectives/YYYY-MM/DD/HH.MM_<slug>.md
```

The slug is usually a short session-label. The content has a stable outline:

```markdown
# Retrospective — my-agent — 2026-04-13 14:15

## What was worked on

## What shipped
(links to commits, PRs, files)

## What failed or got stuck
(honest)

## What was learned
(pointers into findings.md where longer-form)

## Handoff pointer
(relative link to handoffs/<this-session>_to-next-session.md)
```

Retrospectives are append-only as a directory; never overwrite a past one.

## `handoffs/`

One file per session end:

```
handoffs/YYYY-MM-DD_HH-MM_to-next-session.md
```

Contents: the specific things the next session needs to know to pick up cleanly. Smaller than a retrospective — not about *what happened*, but about *what's next*.

```markdown
# Handoff — my-agent — 2026-04-13 14:15

## State of the world
(one paragraph)

## The one next move
(if the next session does only one thing, do this)

## Watch out for
(known landmines)

## Expected to be done by
(if relevant)
```

The next session's first move is: read the latest handoff. This is how continuity survives a context reset.

## `archive/` (Top-Level)

When an entire mailbox has grown large enough that it's getting in the way, the whole thing is snapshotted:

```
archive/mailbox-YYYY-MM-DD/
  (full copy of mailbox/ at that date)
```

This is coarser than `mailbox/archive/`. It's for "I want a clean slate but I will lose nothing" moments — a multi-week reset, a budding of a child agent, a major policy change.

## Session-End Archive Marker

One small touch that pays off: at the end of every session, the agent writes a single empty file:

```
mailbox/.session-ended-YYYY-MM-DDTHH-MM-SS
```

or a one-line file with the session ID. This marker lets tools trivially detect "is the agent in a clean, ended state?" versus "did the last session crash mid-run?" The marker is cheap to write, cheap to check, and unambiguous as a signal.

## Invariants

If you modify this schema, keep these invariants. They are what make the pattern durable.

1. **Every file is plain text or JSON.** No binary. No proprietary formats. An engineer with `ls`, `cat`, and `jq` should be able to read any file.
2. **Nothing is deleted.** Clearing means moving to `archive/`. See chapter 11.
3. **Findings are append-only.** Chronology is the value.
4. **Filenames encode enough for `ls` to be useful.** Timestamps, senders, subjects in the name. No hidden state in directories.
5. **Identity and standing orders are stable.** If they're changing every day, they don't belong there — they belong in context.
6. **Every message is a file.** No in-memory-only queues. No databases of unwritten messages. Files are the ground truth.
7. **Retrospectives and handoffs exist, per session, always.** No session ends without leaving those two files behind.

These invariants are the contract. Follow them and the mailbox survives every framework change you make on top of it.

## Example: A Day In The Life

To ground the schema, here is a realistic sequence of what happens over a single session:

**08:00** — Session starts. The agent reads `identity.md`, `standing-orders.md`, the latest handoff from `handoffs/`, and `mailbox/context.md`. This is the `/recap` ritual from Appendix B.

**08:03** — Agent checks `mailbox/inbox/`. Finds two new messages: one from the team lead with a task, one from a peer agent with a status update. Reads both.

**08:04** — Agent moves the peer's status update to `mailbox/handled/2026-04-13T08-04-12_from-peer.json` (no reply needed, just acknowledged). Starts drafting a reply to the lead; writes it to `mailbox/outbox/2026-04-13T08-04-47_to-lead_task-ack.json`.

**08:05 – 10:30** — Agent does the work. During the work, it appends three entries to `mailbox/findings.md` as it discovers small but noteworthy things. It also updates `mailbox/context.md` once, around 09:15, to reflect the shift in what it's currently focused on.

**10:30** — Work segment ends. Agent composes a reply to the lead's task: writes a JSON file to `mailbox/outbox/2026-04-13T10-30-02_to-lead_task-done.json` with a link to the shipping commit.

**10:35** — Agent runs `/rrr`. Writes `retrospectives/2026-04/13/10.35_task-xyz.md` summarizing the session.

**10:36** — Agent runs `/forward`. Writes `handoffs/2026-04-13_10-36_to-next-session.md` pointing at the one thing the next session should continue.

**10:37** — Agent writes the empty file `mailbox/.session-ended-2026-04-13T10-37-00` as the session-end marker and exits.

**(Next day, 09:00)** — A new session starts. It sees the session-end marker from the previous session (clean shutdown) and the latest handoff. It reads the handoff. It knows exactly what to do next.

The schema is in service of exactly this flow. Nothing more complicated, nothing simpler. Every file written has a role; every directory read has a purpose.

## Adapting For Your System

If you are building a new agent from scratch and want to adopt this schema, a pragmatic starting point:

1. Create the top-level `agents/<name>/` directory.
2. Create `identity.md` and `standing-orders.md` by hand. These are cheap to write once.
3. Create `mailbox/` with empty `context.md` and `findings.md`.
4. Create empty `inbox/` and `outbox/` directories.
5. Skip everything else until you need it. Retrospectives, handoffs, archives — add them when your first session ends and you need somewhere to put the output.

The schema scales down cleanly. A brand-new agent doesn't need every directory on day one. It needs the minimum brain, and it grows the rest as it accumulates history. By the time you have a week of sessions behind you, the full schema will be populated naturally — not because you imposed it up front, but because each session produces one more file in one more directory, and the directory structure emerges from the work.
