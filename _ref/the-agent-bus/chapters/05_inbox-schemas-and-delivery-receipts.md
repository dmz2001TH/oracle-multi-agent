# Chapter 5: Inbox Schemas and Delivery Receipts

> "The schema is the contract. The contract is hardest to change once the agents start depending on it."

---

## 5.1 Why the Schema Gets a Chapter

If Chapter 4 was about the cheapest possible transport, this chapter is about the cheapest possible *protocol* on top of it. The transport is a JSON array. The protocol is whatever shape you put into each object.

It is tempting to wave this off. "Just throw the message text in; we'll figure out the rest later." I have done that. Every time I have done it, I have paid for it the second time the system grew — when a second agent type joined the team, when a new UI layer wanted to render messages, when someone asked "who sent that?" and the text didn't say. A schema is the price you pay once, up front, to avoid paying it many times, later, under pressure.

This chapter walks through the schema Claude Code settled on for its multi-agent inboxes. It is not the only reasonable schema. It is an existence proof of one that has survived a hundred hours of real multi-agent work with eight agents talking past each other. We will go field by field and explain what each one is for, what happens when you leave it out, and what breaks if you get the semantics wrong.

The generic takeaway: the schema is the contract between sender and receiver. Design it before you have eight agents depending on it. Small, honest fields now save you from a JSON refactor during a release.

---

## 5.2 The Minimum Viable Envelope

Here is the full shape as it actually lives on disk, with made-up content and real structure:

```json
{
  "from": "team-lead",
  "text": "Start on task #6 when you're ready.",
  "summary": "assign task #6",
  "timestamp": "2026-04-13T07:30:16.328Z",
  "color": "cyan",
  "read": true
}
```

Six fields. Two of them (`color`, `summary`) are UI affordances, not protocol. Four of them (`from`, `text`, `timestamp`, `read`) are load-bearing. We will take them one at a time, starting with the one that surprised me most.

Before the tour, one meta-observation. None of these fields are *nested*. No inner objects. No references to messages in other files. No thread-id that means you have to cross-index against something else to understand this message. Every message is self-describing. That is a choice, and it is a choice worth imitating — it is why `cat inbox.json` is a debugging tool rather than the beginning of a treasure hunt.

---

## 5.3 `read` — The Quiet Linchpin

`read` is the flag that looks trivial and turns out to be the whole reason polling works. The rule is:

- The sender writes the message with `read: false`.
- The receiver's poll loop hands the message to the agent *and then sets `read: true` in the file*.
- Next poll tick, the receiver skips any message with `read: true`.

If you skip the flag, every poll redelivers every message forever. I did that once, for about fifteen minutes, and watched a simple two-agent loop pin the CPU as the runtime kept re-injecting the same greeting into the conversation. You cannot skip the flag.

What `read` is not: an acknowledgment back to the sender. The sender does not see the receiver set `read: true`. If the sender cares whether the message was processed, it has to ask in a later round-trip. `read` is a delivery receipt *to the runtime*, not an end-to-end acknowledgment.

Subtle bit: `read` must be written back after the handler has done its work, not before. If you set `read: true` first and the handler crashes, the message is lost. If you set `read: true` after and the handler crashes, the message gets redelivered on restart — at-least-once semantics, which most handlers can tolerate. Claude Code writes `read` after delivery into the conversation context; if the process dies mid-turn, you may see the same message twice. That trade is usually correct.

The deeper pattern: `read` is an idempotence token. If you wanted exactly-once, you would need a broker that tracked delivery per-message across the whole system. With file-based IPC, you do not get exactly-once. You get at-least-once plus a convention that handlers should be safe to run twice. Most agent handlers are — responding to the same message twice produces two similar responses, not a corrupt state — so the convention holds.

If I were designing a second version of this schema, I might split `read` into `delivered_at` (a timestamp of when the runtime pushed it into the conversation) and `handled` (a separate flag for whether the agent actually acted on it). They are two different things, and conflating them under one `read: true` costs you the ability to distinguish "the agent saw this and ignored it" from "the runtime showed this and we don't know what the agent did." For most purposes the conflation is fine. It is the kind of detail that only starts to matter at scale.

---

## 5.4 `from` — The Return Address

`from` names the sender. It is how the receiver knows who to reply to. It is how the UI knows who is on screen. It is how a retrospective three weeks later can tell that the long message was from `bus-p2` rather than the human operator.

Two things about `from` that are not obvious.

**It is a name, not a UUID.** The name space is the team namespace. Inside `book-expansion`, `team-lead` unambiguously refers to the lead agent. Across teams, the same name might refer to a different agent. The schema does not encode the team — the team is implicit in *which directory the file lives in*. That is a deliberate scoping choice: it keeps messages small and keeps the notion of "who is this from" tied to the context you already have.

**It is stable across messages.** An agent does not get a new `from` for each message. If `bus-p2` sends ten messages, all ten have `"from": "bus-p2"`. This sounds obvious and is still worth stating because some transports (anything that assigns session IDs per connection) do not have this property. Stable addressing is what makes a history readable.

One edge case: what if the message comes from outside the team? A human typing into a debug console; a scheduled task firing from cron; the runtime itself injecting a system notice. In Claude Code those arrive with conventional names — `user` for a human, `system` for the runtime — that are not valid team-member names but are understood by the UI. This is a small compromise in purity (the name space leaks two reserved words) for a large gain in clarity (a human message never looks like it came from an agent).

If you are designing your own schema, pick a convention early. Either all senders are agents with team-relative names, or you reserve a small handful of well-known names for non-agent origins. Do not leave it ambiguous. I have watched a team log pretend a cron-injected status update was from an agent, and then watched that agent get blamed for a decision it did not make.

---

## 5.5 `text` and `summary` — The Two-Line UI

`text` is the body. `summary` is the one-line preview.

The model here is email. `text` can be long. `summary` must be short enough to render in a single terminal line without wrapping. Five to ten words. Both are produced by the sender — neither is auto-generated — because the sender has the context to write a good summary and the runtime does not.

When there is no `summary`, the UI falls back to showing the first line of `text`. That is usable but often misleading. Agents tend to open messages with "Working on this now —" or "Here's what I found:" neither of which tells you what the message is about. The `summary` is a small discipline that makes a long multi-agent log skimmable.

In practice, I treat `summary` like a git commit subject line. It is the answer to "what is this, in the smallest number of words that would not be actively misleading." If you cannot write one, the message is probably two messages.

One thing the schema does *not* have and perhaps should: a `topic` or `thread_id` field. If you have twenty messages in an inbox and three concurrent conversations interleaved, you cannot easily group them. The current schema handles this by convention — senders embed task IDs in `text` — which works for small teams and falls apart at thirty messages. Chapter 10 returns to this when we discuss federation-scale messaging. For a small team, the flat list is fine.

---

## 5.6 `timestamp` — Monotonic Enough

`timestamp` is ISO 8601 with UTC (`Z` suffix). The sender stamps it at `SendMessage` time, not at file-write time. Same clock, in practice, but the distinction matters if a delivery retries.

The schema does not attempt to guarantee monotonicity across senders. If two agents send within the same millisecond, they may end up with the same timestamp in different files, and if the receiver merges multiple inboxes, it has no way to break the tie. In a system where agents think for seconds and type for seconds more, "same millisecond" is rare. It has happened to me exactly once, when two agents happened to finish long computations at the same clock-tick and both fired a notification. The UI rendered them in the order the poll loop read them — which is deterministic per receiver — and nothing downstream cared.

What I would *not* do: use timestamps as IDs. Timestamps are for humans and for sorting. When you need a unique identifier for a message, add an explicit `id` field. Claude Code does not add one because messages are scoped by `(inbox, index)` for free — the file path names the receiver, and the array index names the position — but if you ever want to refer to a message from outside the inbox, you will regret not having an `id`.

Absolute dates in UTC are boring and correct. Relative dates ("5 minutes ago") render well but do not survive being re-read an hour later. Local timezone stamps look friendly and produce bugs whenever two machines in different timezones participate. UTC with `Z`: dull, portable, right.

---

## 5.7 `color` — The Non-Field Field

`color` is a UI hint. It tells the client which color to tint the message when it renders. It is a string like `"cyan"` or `"amber"` — it maps to whatever the receiver's terminal supports.

I am writing about `color` not because it is load-bearing but because it is instructive. It is the one field in the schema that is pure presentation. You can delete every `color` field from every message in every inbox and the system still works identically; only the rendering changes.

The temptation is to leave presentation out of the data and put it in the receiver's rendering logic. "The receiver knows what each sender is; it can pick a color." In theory, yes. In practice, what happens is: a new sender joins, the receiver's color table does not know about it, every message from that sender renders as default gray, and it takes an hour for someone to wire up the new mapping. Shipping the color with the message lets the sender decide its own identity. The receiver still has the final call — it can ignore `color` and render everything white if it wants — but the default path works without configuration.

There is a generic principle here. A little bit of presentation in the envelope is often worth the impurity, because it makes the system resilient to participants joining and leaving. It is why email has `From` display names alongside addresses, why IRC had colored nicks, and why chat apps attach avatar URLs to messages. Strict separation of data and presentation is right in database design and wrong in transports where the participants may not know each other in advance.

---

## 5.8 Idle Notifications vs Content Messages

So far we have talked about the schema as if every message has a body. It does not. Claude Code's runtime emits *idle notifications* into agent inboxes — messages whose `text` is short and formal, intended to be a system-level nudge rather than content:

```json
{
  "from": "system",
  "text": "Your team has been idle for 30 minutes.",
  "summary": "idle check",
  "timestamp": "2026-04-13T12:00:00.000Z",
  "read": false
}
```

The schema does not have a `type` field that distinguishes "idle nudge" from "actual content from a teammate." The convention is `from: "system"` plus short stereotyped text. The receiver has to pattern-match.

Is this good? Honestly, no. It is what happens when a schema grows organically. When I designed the first version there were only agent-to-agent messages. When idle notifications were added later, the path of least resistance was to reuse the envelope. A cleaner schema would have a `kind: "content" | "notification" | "system"` field or a separate inbox for system messages.

The lesson is worth saying plainly. **Every schema grows new kinds of messages.** Reserve a `type` or `kind` field on day one even if the only value is `"message"`. The cost is one extra field in every envelope. The savings — when someone wants to add structured system events, plan-approval requests, delivery receipts, file-reference payloads — are measured in "we did not have to rewrite the parser on every receiver."

If I were starting this book's schema over, the first change I would make is:

```json
{
  "kind": "message",
  "from": "team-lead",
  "text": "...",
  ...
}
```

And then `kind: "notification"`, `kind: "shutdown_request"`, `kind: "plan_approval_request"` would all be first-class.

---

## 5.9 Auto-Generated Fields vs User-Supplied

The runtime, not the sender, is responsible for three fields:

- `timestamp` — sender supplies a time when it calls `SendMessage`, but the runtime can overwrite it to enforce monotonicity or to correct clock skew. In Claude Code, the sender's clock is the one that sticks.
- `read` — the sender always writes `read: false`. The receiver's poll loop flips it to `true` after delivery. Senders *should not set `read`*. Any sender that writes `read: true` is bypassing the delivery receipt and will cause messages to be skipped.
- `color` — the sender is free to set this, but the runtime provides a default based on the sender's role. You can override; you can ignore.

Everything else — `from`, `text`, `summary` — is user-supplied.

Being explicit about which fields are runtime-owned versus user-owned prevents a whole class of bug. If a sender accidentally sets `read: true`, the message gets silently dropped. If a sender accidentally sets an old `timestamp`, the UI sorts it into the wrong place in the log. In a schema without clear ownership, these bugs are hard to track down because the field is there — it just has the wrong value, set by the wrong party.

The generic principle: **for every field, name the owner.** Sender, receiver, or runtime. Write it down somewhere the participants will find it. A comment in the schema file is fine. A README is better. The worst case is folklore — "I think the runtime sets `read`?" — because when the folklore is wrong, the bug is silent.

---

## 5.10 Versioning and Adding Fields

The schema will change. The first version did not have `summary`. The second did. An agent written against version 1 that receives a version-2 message will either ignore `summary` (fine) or crash on an unknown field (not fine, but avoidable with a permissive parser).

Two patterns that have served me well:

**Additive changes are free; removals are expensive.** You can add a new optional field to every envelope and old receivers will ignore it. You cannot rename `text` to `body` without every receiver updating in lockstep. Treat field names like public API — pick them carefully, and then never change them.

**Include a version marker early.** A `schema: 1` field in every envelope costs you four bytes and buys you the ability to branch on schema version when you eventually need to. Most systems skip this on day one and regret it on day ninety, because adding a version marker retroactively requires assuming "no version field means version 0" — which works, but awkwardly.

Claude Code's schema does not have a version marker and does not yet need one. If there were ever a breaking change, the migration would be "write a new inbox-path convention for v2 and leave v1 alone." That is a fine escape hatch, but "support two inbox paths in every receiver" is more work than "branch on `schema`." I would add a version marker if I were starting over.

---

## 5.11 What I'd Add Back If I Were Starting Over

If I took this schema to a second project, this is what would change:

- Add `id`: a UUID per message, so messages are addressable across inboxes.
- Add `kind`: `"message" | "notification" | "request" | "response"`, so new categories do not require pattern-matching on `from`.
- Add `schema`: an integer, for future migrations.
- Add `in_reply_to`: optional `id` of a prior message, so threads are explicit instead of inferred from text.
- Split `read` into `delivered_at` and `handled`, so at-least-once versus at-most-once decisions can be made per handler.

I would not change: `from`, `text`, `summary`, `timestamp`, `color`. Those have earned their place.

None of this is urgent. The schema we have works. Most of these additions are prophylactic — they are cheap to add early and annoying to add late, so the right time is the second greenfield use rather than a refactor of the first system. If you are reading this and building your own multi-agent bus, this is my advice from the other side of the mistake: the fields that will bite you are the ones you think are optional today.

---

## 5.12 What the Schema Buys You, Collectively

The schema is a handful of fields. Each one seemed trivial when we added it. Together they buy you:

- **A legible inbox.** You can `cat inbox.json | jq` and read a multi-agent conversation without a rendering layer.
- **Safe polling.** `read` lets the receiver be idempotent; the same message is not delivered twice (under normal operation) and is not lost after delivery.
- **Identifiable senders.** `from` means any receiver, any time, can answer "who said this."
- **Replayable history.** With timestamps and no in-place mutation of old messages, you can re-read yesterday's log and understand it.
- **A UI that does not have to be smart.** `summary` and `color` let a minimal renderer do a respectable job.

The generic takeaway is the one I started with: design the schema before you have eight agents depending on it. A quiet hour with the team's imagined future, a printed list of fields, a paragraph per field about ownership and semantics — that is maybe the highest-leverage work you will do on the bus.

---

## Takeaways

- A small, flat envelope — `from`, `text`, `summary`, `timestamp`, `read`, `color` — is enough to run a multi-agent bus for real.
- `read` is the delivery receipt from receiver to runtime; without it, polling redelivers forever. Flip it after the handler runs, accept at-least-once semantics, and make handlers idempotent.
- Name the owner of every field (sender, receiver, runtime) and write it down. Ambiguous ownership is a silent-bug factory.
- Pay the schema tax up front. Add `kind`, `id`, `schema` version fields on day one even if only one value exists today — retrofitting them later is always more expensive than adding them now.
- A little presentation (`color`, `summary`) in the envelope is worth the impurity; it makes the system resilient to participants the receiver did not know about.
- The schema is the contract. The contract outlives the transport that carries it.

---

## Next Chapter

Chapter 6 moves past the inbox. An inbox carries this session's traffic; it does not carry an agent's long-term knowledge. When a team dissolves, its inboxes dissolve with it — and any agent whose memory was only in the inbox forgets everything. The next chapter is about the filesystem patterns that survive team lifecycles: standing orders, findings logs, and the rituals that turn per-session state into per-agent memory.
