# Chapter 4: JSON Append + Polling: The Zero-Dependency IPC

> "The shortest path between two agents is a file they both know the name of."

---

## 4.1 The Smallest Bus That Works

The first time I needed two AI agents to talk to each other, I reached for the thing every engineer reaches for: a message broker. Redis pub/sub. A socket. Something that made the problem look like a problem the industry had already solved.

I did not need any of it.

Two agents, living in separate processes on the same machine, need exactly three things to communicate:

1. A shared name they both know.
2. A way for the sender to add a message.
3. A way for the receiver to find out there is a message.

A file on disk provides (1). `fs.appendFileSync` — or its equivalent in any language — provides (2). A polling loop on `fs.stat` or a kernel notification from `fs.watch` provides (3). That is the whole system. There is no daemon. There is no broker. There is no configuration file that tells the broker where the queues are. The filesystem is the broker.

This chapter is about that minimum. The goal is not to convince you that a JSON file is the right long-term transport — it often isn't — but to show you that the distance between "nothing" and "a working inbox" is much shorter than you think. Once you have built the zero-dependency version, every fancier transport you reach for later will feel like a deliberate trade, not a default.

Claude Code ships this pattern in production. When you spawn a multi-agent team with `TeamCreate`, the runtime creates a directory under `~/.claude/teams/<team>/inboxes/` and drops one JSON file per agent into it. Agents send each other messages by appending to those files. The runtime reads them back and delivers them into each agent's conversation. It is — I am not exaggerating — JSON append plus polling. We will spend most of this chapter pulling that system apart.

---

## 4.2 What Counts as a Bus

Before the file, a definition. In this book a *bus* is any mechanism with these properties:

- **Addressing.** The sender picks a recipient by name, not by instance.
- **Durability across the send.** The message survives long enough for the recipient to read it, even if the recipient is not awake at send time.
- **Decoupling.** The sender does not block on the recipient's availability.

Notice what is not in the list. No guaranteed delivery. No ordering across senders. No acknowledgment. No schema enforcement. Those are things you can build on top of a bus. They are not what makes something a bus.

A file in a well-known directory has all three bus properties. The filename is the address. The filesystem keeps bytes around until something deletes them. The sender writes and walks away; the receiver reads whenever it next checks.

What a file does not have: a way to wake the recipient. The recipient has to look. This is polling, and polling has a bad reputation that is mostly earned in distributed systems where a round-trip is tens of milliseconds and there are ten thousand clients. In a multi-agent system running on your laptop, with eight agents and a one-second tick, polling costs nothing you can measure. We will come back to this.

---

## 4.3 The File Is the Inbox

Here is the live directory from the team that wrote this book:

```
~/.claude/teams/book-expansion/
├── config.json
└── inboxes/
    ├── bus-p1.json
    ├── bus-p2.json
    ├── bus-p3.json
    ├── bus-p4.json
    ├── mem-p1.json
    ├── mem-p2.json
    ├── mem-p3.json
    └── mem-p4.json
```

Eight agents, eight files. Each file is named after the agent. Each file is a JSON array of messages. To send a message to `bus-p3`, you append an object to `bus-p3.json`. To read your inbox, you read your own file.

That is it. Everything else in this chapter is elaboration.

Below is an actual message from that directory, lightly reformatted for width. It is the briefing `team-lead` sent to `bus-p2` at the start of this assignment:

```json
[
  {
    "from": "team-lead",
    "text": "You are BUS-P2 on team \"book-expansion\". You write Part II of \"The Agent Bus\"...\n\nYour chapters:\n- `04_json-append-plus-polling.md` ...",
    "timestamp": "2026-04-13T07:30:16.328Z",
    "read": true
  }
]
```

Four fields: `from`, `text`, `timestamp`, `read`. One of them (`read`) is managed by the receiving runtime, not the sender. We will spend all of Chapter 5 on the schema. For now, notice the shape. A JSON array at the top level. Each element an object. The object has a sender, a body, a time. The object is flat — no nesting, no references, no pointers into some other store. Everything you need to understand this message is in this message.

The whole inbox for a freshly-spawned agent starts as `[]`. An empty array. The first send appends the first element.

---

## 4.4 Writing: Append Semantics Done Honestly

The naive implementation of "append to a JSON array in a file" has a trap. The trap is that JSON is not actually append-friendly. A JSON array ends with `]`. You cannot just tack bytes onto the end of the file — you have to rewrite the closing bracket. The actual write sequence is:

1. Read the file as a string.
2. Parse it as JSON.
3. Push the new message onto the array.
4. Stringify.
5. Write the whole thing back.

```typescript
function deliver(inbox: string, message: Message) {
  const raw = fs.readFileSync(inbox, "utf-8");
  const arr = raw.trim() === "" ? [] : JSON.parse(raw);
  arr.push(message);
  fs.writeFileSync(inbox, JSON.stringify(arr, null, 2));
}
```

Four lines of real work. One line of defensive handling for an empty file.

I call this "append" because that is what the sender thinks it is doing. Under the hood it is a full rewrite. For a mailbox with ten messages of a few kilobytes each, the rewrite is sub-millisecond. For a mailbox that has grown to ten megabytes, it is still under a hundred milliseconds. At small-team scale — which is what this book is about — the difference does not matter.

There are two honest failure modes:

**Concurrent writes.** If two senders read-modify-write the same file at the same time, one of them loses. The classic lost-update bug. On Linux, a single `write(2)` up to `PIPE_BUF` bytes is atomic; a read-modify-write is not. In practice, multi-agent systems on a single laptop rarely race this way because agents produce messages slowly (seconds between messages, not microseconds) and a send is a single synchronous `writeFileSync`. I have personally seen this race exactly zero times in a hundred hours of multi-agent work. I have seen it in lab code where I deliberately tried to provoke it. That distinction matters — if you push this transport into a setting where agents produce messages in tight loops, you will eventually lose a write.

The fix is not complicated. Write to `<file>.tmp`, then `fs.renameSync` — `rename(2)` is atomic on the same filesystem, and advisory locks (`flock(2)`, `fcntl(2)`) are a library call away. Most zero-dependency implementations skip it until they hit the bug. That is a fair choice. Skip until it bites.

**Partial writes.** If the process dies between `writeFileSync` starting and finishing, the file on disk is truncated. You end up with `[{"from":"x","te` and no way to parse it. The same `.tmp + rename` trick fixes this as well, and most serious implementations of this pattern use it. Claude Code's runtime does.

Pretending these failure modes do not exist is how people end up convinced that file-based IPC is fundamentally unreliable. It isn't. It is reliable at the level of effort you put into it, which is a property of every transport.

---

## 4.5 Reading: The Poll Loop

The receiver has the easier job. It reads its own file. It walks the array. It picks out the messages it has not yet handled. That is the whole loop:

```typescript
async function pollInbox(inbox: string) {
  while (true) {
    const arr = JSON.parse(fs.readFileSync(inbox, "utf-8"));
    for (const msg of arr) {
      if (!msg.read) {
        handle(msg);
        msg.read = true;
      }
    }
    fs.writeFileSync(inbox, JSON.stringify(arr, null, 2));
    await sleep(1000);
  }
}
```

The `read` flag is the delivery receipt. When a message has `read: true`, it has been seen; the receiver skips it on the next tick. This is how polling does not re-deliver the same message forever. Chapter 5 is an entire chapter on `read` because getting that flag right is more subtle than it looks. For now, the mental model is: messages accumulate in the file, and `read: true` is the mark the receiver leaves to say "I have digested this."

Two alternatives to the sleep-and-poll loop:

**`fs.watch`.** On Linux, this is an inotify subscription. The kernel tells you when the file changes. You avoid wasting CPU on reads where nothing happened.

```typescript
fs.watch(inbox, (event) => {
  if (event === "change") drainInbox(inbox);
});
```

The cost: `fs.watch` is famously flaky across operating systems. On macOS it collapses some events; on older kernels it drops events under pressure; on NFS it doesn't work at all. In a laptop-scale system you will have fewer than a thousand events per day, and the kernel handles that volume fine. In a federated system where the file lives on a shared filesystem, `fs.watch` is often worse than polling.

**Polling at a saner interval.** A one-second poll is plenty for a conversational agent. Humans type slower than that; agents that think for four to sixty seconds between messages certainly do not care. The cost of a `readFileSync` on a 10KB JSON file is on the order of tens of microseconds. A thousand polls a day is one second of CPU. You can poll a small-team inbox forever and never see it on a profiler.

Claude Code's runtime uses a mix: a background task checks inboxes on a short tick, and certain events (SendMessage returning, TaskUpdate firing) do a synchronous drain. The mix matters less than the fact that both components are trivial.

---

## 4.6 A Complete Round-Trip

Let me walk through a single exchange, start to finish, so every mechanism is on the page.

**State at t=0.** `team-lead` and `bus-p2` are both running. `inboxes/bus-p2.json` exists and is `[]`. `inboxes/team-lead.json` exists and is `[]`.

**t=1.** `team-lead` calls `SendMessage({ to: "bus-p2", summary: "write Part II", message: "You are BUS-P2..." })`. Internally, the runtime:

- Opens `inboxes/bus-p2.json`.
- Reads it. Gets `[]`.
- Constructs the envelope: `{ from: "team-lead", text: "You are BUS-P2...", summary: "write Part II", timestamp: "2026-04-13T07:30:16.328Z", read: false }`.
- Appends the envelope.
- Writes `inboxes/bus-p2.json`.

**t=2 (next poll tick).** `bus-p2`'s poll loop reads its inbox. It finds one message with `read: false`. It hands the message to the agent's conversation — in Claude Code, this means the text shows up as a `<teammate-message>` block in the next prompt turn. It sets `read: true` and writes the file back.

**t=3.** `bus-p2` does its work. An hour later it calls `SendMessage({ to: "team-lead", summary: "Part II shipped", message: "Three chapters written, N words total." })`.

**t=4.** The runtime opens `inboxes/team-lead.json`, reads `[]`, appends, writes. The return message now sits in `team-lead`'s file.

**t=5.** `team-lead`'s poll loop sees the new message, delivers it, marks `read: true`.

That is the whole round-trip. No socket. No handshake. No heartbeat. Two file writes and two file reads, with the filesystem as the rendezvous.

If you are used to reasoning about message passing in terms of sockets and queues, this can feel anticlimactic. Where is the magic? The magic is that there is no magic. The operating system has been doing read-and-write to named locations for fifty years, reliably, and that is enough.

---

## 4.7 Why This Works at Small-Team Scale

"Small-team scale" is the hedge in this chapter. Let me try to pin down what it means.

A JSON-array-per-file inbox works well when the total cost of a full rewrite is small. "Small" means you can rewrite the file faster than new messages arrive. For a 10KB file on a local SSD, a rewrite is well under a millisecond. You could sustain thousands of writes per second before the rewrite became a bottleneck. You will never send thousands of messages per second between AI agents — token generation alone takes seconds per message.

It works well when the number of participants is bounded. One file per agent. A team of eight agents means eight inboxes. A federation of a hundred nodes, each with ten agents, would mean a thousand inboxes, and the directory listing would start to be noticeable. That is already far beyond where you need to reach for a more structured transport.

It works well when messages are ephemeral and bounded in count. "The team dissolves in a few hours; the inboxes get deleted with it." Chapter 6 is about what happens when you need memory beyond the life of the team. The short version: move durable state to a different file.

It stops working when any of those assumptions break. Sustained message volume in the hundreds per second, or unbounded retention, or fine-grained cross-process concurrency — any of those is a signal to reach for a real queue. Not before.

---

## 4.8 What You Get for Free from the Filesystem

Being honest about what this transport gives you, without asking for it:

- **Persistence across a restart.** If an agent crashes, the messages it received — and the ones it sent — are on disk. The next time it starts, it reads the file and picks up where it left off. Compare with an in-memory queue, where a crash loses everything not yet consumed.
- **Inspection.** I can `cat bus-p2.json` from any terminal and see exactly what is in the queue. No client library. No admin UI. I can `grep` for a keyword across every inbox. I can pipe it to `jq`. I can open it in a text editor. Debuggability is the quiet superpower of file-based systems.
- **Backup.** The directory is a directory. `tar`, `rsync`, a Git commit — the usual tools apply. A team's full message history is `tar czf team.tar.gz ~/.claude/teams/<team>`. You cannot do that with a Redis instance without running `BGSAVE` and hoping.
- **Interop.** Any language, any tool, any process that can read a UTF-8 file with a JSON parser can participate in the bus. A Python side-script that wants to inject a message just writes JSON. A shell script that wants to read the latest status just runs `jq -r '.[-1].text' bus-p2.json`.

These are the properties that make me stop reaching for Redis for the first six months of a project. The filesystem has been a bus all along.

---

## 4.9 What You Have to Build If You Want It

Being equally honest about what you do not get:

- **Delivery guarantees.** If the process crashes between `readFileSync` and `writeFileSync`, the `read: true` flag does not get written back — so the message gets delivered twice on restart. This is at-least-once semantics, and if your handler is not idempotent, you will see the bug.
- **Ordering across senders.** Two senders writing at roughly the same time will produce an interleaving that depends on which one won the last write. If order matters across senders, you need a sequence number, which means you need a broker that assigns them — which means you are no longer zero-dependency.
- **Backpressure.** The file grows without limit by default. If a fast producer writes to a slow consumer, the file gets large and rewrites get slow. You need to prune. Chapter 5 covers one tidy way (trim `read: true` messages on a cadence) and one lazy way (let it grow, it will not matter for the lifetime of this team).
- **Access control.** Anyone with permission to read the directory can read every message. Use file permissions for the coarse case; do not put secrets in messages for the fine case. I have seen a team briefly panic when they realized the inbox had an API key in it. They had written it because it felt like a private channel. It wasn't.

None of these are showstoppers. All of them are work you have to do if you need them. That is the trade.

---

## 4.10 The Generic Lesson

Do not let the specific details — Claude Code, `~/.claude/teams/`, `SendMessage` — narrow your view. The lesson generalizes.

You can build an IPC primitive out of `fs` alone. A file per participant in a well-known directory, a JSON array of messages, append on send, poll on receive, a `read` flag to mark delivery. It is a few dozen lines of code in any language. It runs on any operating system that has a filesystem. It survives restarts, is debuggable from the shell, backs up with `tar`, and carries zero operational surface area.

It is not the right answer for every problem. It is the right answer for more problems than people reach for it. Every time I have skipped straight to a broker for a small multi-agent setup, I have regretted the complexity within a week. Every time I have started with JSON append plus polling, I have been able to replace it later with something fancier only after I actually hit a wall — which, at small-team scale, usually never happens.

The rest of Part II builds on this primitive. Chapter 5 is the contract that the messages carry. Chapter 6 is what you do when the inbox is not enough — when you need memory that outlives the team.

---

## Takeaways

- The minimum viable agent bus is a JSON array in a file, written with append-semantics and read with a polling loop.
- A file per agent in a well-known directory gives you addressing, durability, and decoupling — the three properties that make something a bus.
- A `read: true` flag on each message is how polling avoids redelivering the same thing forever.
- The honest failure modes — concurrent writes, partial writes, at-least-once delivery — are real but manageable with `tmp + rename` and idempotent handlers.
- The filesystem hands you persistence, inspection, backup, and interop for free; you do not get ordering, backpressure, or delivery guarantees without building them.
- At small-team scale (agents numbered in the dozens, messages per minute, not per second), this primitive is genuinely enough. Reach for a broker when you have a specific reason, not a generic anxiety.

---

## Next Chapter

Chapter 5 picks up where this one leaves off: what should actually go *inside* each message. The schema is the contract. Get it right early — before eight agents start depending on field names — and the bus scales with you. Get it wrong and every future change hurts.
