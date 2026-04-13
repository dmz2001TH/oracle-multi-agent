# Appendix B — Ritual Command Reference

> Every session ritual discussed in this book, as a practical command reference.

A "ritual command" is a short, memorable verb that encodes a ritual — a multi-step process that writes to the external brain in a disciplined way. Rituals are what turn the principles into actual, repeatable behavior. This appendix gives you the reference card.

Every command described here maps to an actual slash-command or script in the reference implementation. You don't need the reference implementation to use the ideas — each command is framework-agnostic. What follows is: purpose, when to call, what it reads, what it writes.

## `/rrr` — Retrospective

**Purpose:** End a session in a way that makes the next session's first five minutes easy.

**When to call:** At the end of every session. Also when context is about to be compacted and you want the key insights preserved before they get summarized away.

**What it reads:**
- Current session's git log (what shipped)
- Current session's tool-call history (what was done)
- `mailbox/context.md` (what was being worked on)
- Latest `handoffs/*` file (what the previous session promised)

**What it writes:**
- New file: `retrospectives/YYYY-MM/DD/HH.MM_<slug>.md`
- Appends relevant learnings to `mailbox/findings.md`
- Optionally updates `mailbox/context.md` to reflect new state

**Shape of the output:**
A markdown document with the standard retrospective outline: what was worked on, what shipped, what failed, what was learned, pointer to handoff. Explicit and honest. The ritual is worth nothing if the retrospective reads like a marketing document; it must be candid.

**Rule of thumb:** If you haven't run `/rrr`, you haven't ended the session — you've just stopped typing.

## `/forward` — Handoff

**Purpose:** Write the next session's "read this first" file.

**When to call:** At the end of a session, typically right after `/rrr`. Also mid-session if you're about to hand off to another agent or another human.

**What it reads:**
- `mailbox/context.md`
- Latest retrospective
- Current task state (whatever's actively open)

**What it writes:**
- New file: `handoffs/YYYY-MM-DD_HH-MM_to-next-session.md`

**Shape of the output:**
Short. Four sections at most: state of the world, the one next move, landmines to watch, deadline (if any). The goal is that the next session can act within minutes of loading — no spelunking required.

**Rule of thumb:** If your handoff is longer than a page, you're writing a retrospective in the wrong file. Retrospectives look backward; handoffs point forward. Keep them distinct.

## `/recap` — Session Orientation

**Purpose:** Start a session by loading the minimum context needed to act.

**When to call:** At the start of every session. Especially when resuming a project after days or weeks away.

**What it reads:**
- `identity.md`
- `standing-orders.md`
- Latest `handoffs/*` file
- Latest `retrospectives/*` file (skimmed, not fully)
- `mailbox/context.md`
- New messages in `mailbox/inbox/`
- Recent git log (`git log --oneline -20`)

**What it writes:**
- Nothing, typically. `/recap` is a read ritual.
- Optionally, `mailbox/context.md` gets updated with the "as of now" state.

**Shape of the output:**
A one-screen summary for the human operator, or a loaded context for the agent: here is who you are, what your standing orders are, what the last session did, what's waiting in inbox, what the next move is.

**Rule of thumb:** Never start a session with "what should I do today?" without running `/recap` first. The answer is almost always in the mailbox already.

## `/dig` — Excavate History

**Purpose:** Answer a historical question by reading the external brain, not by asking the current agent.

**When to call:** When a question like "what did we decide about X three weeks ago?" comes up. When trying to find the commit that introduced a regression. When reconstructing context for a stakeholder.

**What it reads:**
- All of `findings.md` (grep-friendly)
- All of `retrospectives/`
- All of `handoffs/`
- Session logs in the archive
- Git log, optionally with `-p` for deep diffs

**What it writes:**
- Typically nothing; `/dig` is a read ritual.
- Sometimes writes a new finding summarizing what was excavated, so the next dig is cheaper.

**Shape of the output:**
A focused answer to the specific question, with pointers to the evidence. Never a paraphrase of the agent's memory — always backed by a file or commit.

**Rule of thumb:** If you're answering from memory, you're violating patterns-over-intentions. Dig the trace, then answer.

## `/inbox` — Process New Messages

**Purpose:** Read any new messages from other agents or humans and respond to the ones that need a response.

**When to call:** Start of session (after `/recap`). Also whenever you want to check for new activity — but resist the urge to poll. Messages that need immediate response should use a different escalation path; the inbox is for async.

**What it reads:**
- `mailbox/inbox/` (all files newer than last `/inbox` run)

**What it writes:**
- Moves handled messages to `mailbox/handled/` (archival, not deletion)
- Writes replies to `mailbox/outbox/`
- Optionally appends to `findings.md` if a message contained something worth remembering
- Optionally updates `mailbox/context.md`

**Shape of the output:**
For each unread message: a one-line acknowledgement of what it was, and a one-line record of action taken (replied, noted, filed, deferred).

**Rule of thumb:** Inbox zero is not the goal. *Everything handled intentionally* is the goal. A message deferred with a note is handled; a message ignored is not.

## `/mailbox` — Inspect Your Own State

**Purpose:** Show the current state of the agent's mailbox, for the operator or the agent itself.

**When to call:** Anytime you're unsure what the agent is "carrying" — what context, what standing orders, what pending work.

**What it reads:**
- `identity.md`
- `standing-orders.md`
- `mailbox/context.md`
- `mailbox/findings.md` (recent entries)
- `mailbox/inbox/` (count of unread)
- Recent `retrospectives/` and `handoffs/`

**What it writes:**
- Typically nothing — this is a read ritual.

**Shape of the output:**
A summary page. Who am I, what am I told to always do, what am I currently doing, what have I recently learned, what's waiting in my inbox, where was I last.

**Rule of thumb:** `/mailbox` is the answer to "what would I load into a fresh session?" It is the working set of the agent, summarized.

## Composing The Rituals

The rituals are designed to compose. A typical session shape:

**Start.**
1. `/recap` — load context.
2. `/inbox` — process any new messages.
3. Act — do the actual work.

**Mid-session, when unsure:**
- `/dig <question>` — excavate specific history.
- `/mailbox` — remind yourself what you're holding.

**End.**
1. `/rrr` — write the retrospective.
2. `/forward` — write the handoff for the next session.

This rhythm is the daily loop. It takes discipline the first week. It becomes reflex by the second. By the third, skipping it feels like leaving the house without locking the door.

## Writing Your Own Rituals

A ritual that follows the shape of the ones above has three requirements:

1. **It reads from known files in the external brain.** No guessing.
2. **It writes to known files in the external brain.** No ephemeral state.
3. **It has a clear before/after state.** Running the ritual changes something specific; you can check whether it ran.

If a ritual you're designing doesn't meet all three, it's not a ritual — it's a vibe. Vibes don't persist across sessions. Rituals do.

## Failure Modes To Avoid

**Skipping `/forward` when a session "felt incomplete."** A half-done session still needs a handoff, maybe more so than a complete one. Write "left mid-refactor, middle is broken, don't rebuild — resume at file X line Y." That's the handoff. Not writing it because "the work isn't done" is the failure mode.

**Letting retrospectives become PR descriptions.** A retrospective is for the future self, not for the team's dashboard. It should include the embarrassing parts. PR descriptions don't have to; retrospectives do.

**Running `/recap` and ignoring what it says.** The ritual is only useful if its output shapes the next actions. If you run `/recap` and then ask "what should I do?" as if you hadn't just read the handoff, you've degraded the ritual into theater.

**Polling `/inbox` obsessively.** The inbox is async. Check it at session start and maybe once mid-session. Treating it like a synchronous chat breaks the async contract and wastes attention.

**Treating `/dig` as a last resort.** It should be a first resort. The instinct to ask "I wonder what we decided about X" and then answer from memory is the instinct to violate patterns-over-intentions. `/dig` is there to short-circuit that instinct.

## The Rituals Are The Principles In Action

The principles from Part IV are abstract. The rituals are how they live in a day. `/rrr` enforces nothing-is-deleted (the retro is written, not the old one overwritten). `/dig` enforces patterns-over-intentions (you read the trace). `/recap` enforces external-brain (you load from disk, not from memory). Every time you run a ritual, a principle is being honored in concrete form.

When rituals and principles agree, the system runs. When they disagree, fix the ritual until it reflects the principle. The rituals are just the principles with names and footprints.
