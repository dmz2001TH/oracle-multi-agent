# 01 — Pick Your Substrate

When I say *substrate*, I mean the physical thing that moves bytes from one agent's mouth to another agent's ear. Not the framework. Not the protocol. The thing underneath.

This distinction matters because the first mistake most multi-agent designs make is picking a framework before picking a substrate. They reach for an orchestration library, adopt its opinions about how agents talk, and then discover three months in that the library wants a hosted broker, a schema registry, and a cloud account — when what they actually needed was a shared file and a polling loop.

A substrate is a choice about where the message lives while it's being delivered:

- In a shared address space?
- In a file on disk?
- In a terminal's scrollback buffer?
- In a UDP packet crossing a tunnel?

Each answer has different failure modes, different observability, and different cost. And — this is the important part — a single agent team routinely uses *all four* in a single working session. The question is never "which transport should we pick?" It's "which transport fits this particular hop?"

This chapter introduces a four-tier framework for thinking about that question. The tiers are not a hierarchy. Tier 4 is not "better" than Tier 1. They are a palette. You use the one that matches the scope of the conversation you're trying to have.

## The Four Tiers

Here's the map, top to bottom by blast radius:

| Tier | Substrate | Scope | Example |
| --- | --- | --- | --- |
| 1 | In-process function call | Same process | `Agent(...)` in Claude Code |
| 2 | File-based mailbox | Same machine | JSON in `~/.claude/teams/*/inboxes/` |
| 3 | tmux / subprocess | Same machine, different process | `maw hey <agent>` wrapping `tmux send-keys` |
| 4 | Network (WireGuard) | Multi-machine federation | `maw hey <node>:<agent>` |

That's it. That's the whole framework. The rest of this chapter is why each tier exists and when you pick it.

One note before we go in: I'll use `maw hey`, Claude Code, and WireGuard as worked examples throughout, because they're what I've actually shipped with. They are not the subject. They are *an* implementation of each tier. You could build Tier 2 with SQLite instead of JSON files. You could build Tier 3 with `screen` instead of `tmux`. You could build Tier 4 with Tailscale instead of WireGuard. The tiers are what matter.

## Tier 1 — In-process Function Calls

The cheapest message you will ever send is the one that never leaves your process.

When Claude Code's `Agent` tool spawns a subagent, no message bus is involved. The parent agent's runtime allocates a new conversation context, runs the subagent inline, collects the result, and returns it as a tool result. From the parent's point of view, spawning an agent costs one tool call. From the system's point of view, it's a function invocation with a long-running body.

Strengths:

- **No serialization.** The parent's prompt structure flows directly into the subagent's system prompt via the tool's `prompt` parameter. No JSON envelope. No delivery confirmation. No inbox polling.
- **Result is the reply.** When the subagent finishes, its output *is* the tool result. There is no round-trip dance — call returns means reply delivered.
- **Observability by default.** The tool call and its result show up in the parent's conversation log. If anything goes wrong, you see it in the same place you see everything else.

Weaknesses:

- **Lifetime is bounded by the parent.** If the parent's session ends, the subagent is gone. You cannot have long-running work this way, because "long-running" requires survival beyond the parent's context.
- **No parallel dialog.** The parent blocks on the subagent's completion. You can spawn many subagents in parallel, but you can't interleave *conversation* with them. It's launch-and-collect, not chat.
- **Token cost lands in the parent.** Everything the subagent produces eventually shows up somewhere in the parent's context — as a tool result if nothing else. Spawn a dozen subagents and you've bought a dozen tool results worth of tokens.
- **Single machine.** By definition, you can only spawn agents that live in the same runtime.

When to use Tier 1: a discrete question with a discrete answer, executed now, where you want the result back before you continue. "Search the codebase for every place that calls `foo`." "Review this diff and tell me if the migration is safe." "Read these five files and summarize."

When *not* to use Tier 1: anything you want to check back on later. Anything that should outlive the current session. Anything that's better modelled as a peer than as a tool.

## Tier 2 — File-Based Mailboxes

The moment you want an agent to outlive the session that spawned it, you need the message to live outside any single process. The cheapest place to put it is a file.

A file-based mailbox is a folder of JSON files, one per message, named by timestamp and sender. An agent "sends" by appending a file. An agent "receives" by listing the folder, reading new files, and remembering what it has already processed. There is no broker. There is no protocol. There is only `write()` and `read()`.

This sounds primitive. That's because it is. That's also why it works.

In the system this book is based on, the mailbox lives at `~/.claude/teams/<team>/inboxes/<agent>/` and messages are JSON objects with fields like `from`, `subject`, `body`, and `timestamp`. Delivery is "write the file." Reading is "list the directory." The whole thing could be re-implemented in fifty lines of bash.

Strengths:

- **Zero dependencies.** If the machine has a filesystem, the bus works.
- **Survives sessions.** The mailbox is on disk. The sending agent can die, the receiving agent can be offline, the message sits there until it's read.
- **Debuggable with `ls`.** You don't need a special tool to inspect the queue. You can `cat` it. You can `grep` it. You can `rm` a message you regret.
- **Natural durability boundary.** Back up the mailbox folder and you've backed up the conversation.

Weaknesses:

- **Polling, not pushing.** The receiving agent has to *look* at the folder. If it's not running, or not looking often enough, the message sits there unread. This is not a real-time channel.
- **No ordering guarantees without effort.** Two senders writing at the same microsecond can collide on filename. Ordering across senders is "whatever the filesystem returned from `readdir`." You can solve this with timestamps and sequence numbers, but you have to solve it — it's not free.
- **Single filesystem.** Two machines don't share this mailbox unless you mount it across, which gets messy fast. This is fundamentally a single-machine bus.
- **Visibility is opt-in.** Messages exist, but nobody is "subscribed" in the pub-sub sense. If the receiving agent doesn't poll, nothing notifies it.

When to use Tier 2: handoffs between sessions. Standing orders ("next time you wake up, remember this"). Persistent notes. Anything where the sender and receiver don't need to be alive at the same time.

When *not* to use Tier 2: anything that needs to reach a *running* agent right now. For that, you need Tier 3.

## Tier 3 — Tmux and Subprocess Messaging

Tier 2 solves "agent A left a note for agent B." Tier 3 solves "agent A needs to interrupt agent B, who is currently typing."

The substrate here is tmux. Each agent runs in a tmux pane. Each pane has an address — a session name and a window/pane index — that any other process on the machine can target. `tmux send-keys` pushes keystrokes into the pane as if a human had typed them. The running agent in that pane sees the keystrokes in its stdin, reads them as input, and responds.

`maw hey <agent>` is a thin wrapper around this. It looks up the agent's pane address in a registry, formats the message, calls `tmux send-keys`, and (optionally) presses Enter so the running agent actually receives the input as a complete message rather than a half-typed line.

Strengths:

- **Real-time.** The message arrives in the target agent's input buffer within milliseconds. There's no polling.
- **Reaches running agents.** The receiver doesn't have to do anything special to be reachable — just be running in a pane.
- **Zero network surface.** Everything is local. tmux is already doing the work of multiplexing a terminal. You're just addressing one of its panes by name.
- **Composable with everything else.** The sender doesn't have to be an agent. A cron job, a git hook, a manual `maw hey` from the user — all route the same way.

Weaknesses:

- **Fragile to UI state.** If the target pane has a prompt waiting, the keystrokes are consumed as a reply. If it's in the middle of tool output, they may be buffered. If the agent has crashed, they go into a dead shell. You have to know the target is ready.
- **No delivery receipt.** `tmux send-keys` returns success if the keys reached the pane, not if the agent *processed* them. "Sent" and "received-and-understood" are different things.
- **Requires tmux.** This is obvious but worth stating. Panes are the addressing scheme. If your agent is not in a pane, this tier doesn't reach it.
- **Single machine.** tmux sessions live on the machine they were started on.

When to use Tier 3: waking up an idle agent, injecting a new task into a running agent, broadcasting a signal across panes on the same box. Any time you want a running agent to notice something *now* without restarting it.

When *not* to use Tier 3: talking to an agent on a different machine. For that, you need the network.

## Tier 4 — Federation Over WireGuard

The fourth tier is the same as the third, with a tunnel underneath.

The design: each machine in the federation runs its own tmux sessions, its own registry of local agents, and its own message daemon. The machines are connected by WireGuard, so every node has a stable IP address on a private network, regardless of where it actually sits on the public internet. To send a message from `node-a:agent-x` to `node-b:agent-y`, the sender invokes `maw hey node-b:agent-y <message>`. Under the hood:

1. The sender's `maw hey` recognizes the `node:agent` syntax.
2. It looks up `node-b` in its WireGuard peer table, gets the peer's internal IP.
3. It opens an SSH connection to that peer (or uses a daemon listening on the WG interface) and invokes `maw hey agent-y <message>` on the far side.
4. The far side's `maw hey` resolves `agent-y` locally — Tier 3 — and drops the message into the right pane.

The user's mental model is: *every agent in the federation is addressable by `node:agent`*. The substrate — WireGuard plus SSH plus tmux — is invisible to them. They type `maw hey white:planner "review the latest issue"` and a message appears in a pane on a different physical machine.

Strengths:

- **No cloud.** There is no hub. There is no broker. The federation is peer-to-peer. If one node goes down, the others keep talking to each other. If *you* go down, your peers don't know or care until they try to reach you.
- **Same addressing scheme as local.** `maw hey agent` is local; `maw hey node:agent` is remote; the rest of the call site is identical. Code that wants to send a message does not have to know or care whether the target is local or remote.
- **Bounded trust surface.** WireGuard handles the authentication and encryption at the transport layer. If a peer's WG key isn't in your config, they can't route to you. There's no token to leak, no API to compromise.
- **Works over shitty networks.** WireGuard is a UDP overlay. It punches through most NATs, survives connection migrations, and reconnects silently after sleep. A laptop waking up from suspend doesn't need to re-auth.

Weaknesses:

- **Ops complexity.** You have to run WireGuard. You have to keep peer configs consistent. If a node's IP changes or its config drifts, the federation quietly partitions. Debugging this is worse than debugging a local bus because now you're debugging *networking*.
- **Name collisions.** If `agent-x` exists on both `node-a` and `node-b`, `maw hey agent-x` is ambiguous. You need a naming discipline. The system in this book had a whole class of bugs around this — see later chapters.
- **Latency is real.** Not much — WireGuard over broadband is fine — but it's not zero. Tier 3 is microseconds; Tier 4 is tens of milliseconds plus SSH startup. For high-frequency chatter, the difference matters.
- **Visibility is distributed.** A message sent from `node-a` to `node-b` doesn't appear in `node-a`'s logs after it leaves the SSH call. You need to look at both nodes to see the whole hop.

When to use Tier 4: when agents on separate machines genuinely need to coordinate. Cross-node fleet operations. Letting your home server's long-running agent wake up your laptop's editing agent when something interesting happens. Allowing a peer in another country to ping an agent on your box.

When *not* to use Tier 4: when one machine would have done. Most of the time, one machine would have done. Federation is for when the work genuinely spans machines — not for the flex of having the work span machines.

## How These Tiers Compose

The tiers aren't mutually exclusive. A single operation can use all four:

A user types a question into a Claude Code session on their laptop. The session is Tier 1 — the main agent spawns three subagents via `Agent()` to do parallel research. One of those subagents decides the answer requires a long-running investigation and writes a message to a mailbox at Tier 2, addressed to an overnight agent. The overnight agent, scheduled by cron, wakes, reads the mailbox, and starts work. It needs to check something on the home server, so it invokes Tier 4 — `maw hey home:scanner` — which crosses the WireGuard tunnel and lands as a Tier 3 tmux message in a pane on the home server. The scanner there responds by writing to *its* local mailbox (Tier 2 on the remote side), and the result is retrieved across the tunnel.

That single chain touches all four tiers. Nobody designed it to. Each hop was chosen because it fit the scope of that hop.

This is the key insight: *the substrate is a per-hop decision*, not a per-system decision. There is no "we use X for messaging." There is "this hop needed to reach a running agent on this machine, so we used Tier 3, and the next hop needed to reach a different machine, so we used Tier 4."

## Anti-patterns

Once you have the four-tier model, you can name the mistakes you used to make without names:

- **Tier-4-for-Tier-1 work.** Using the federated bus when a function call would have sufficed. Symptom: spawning remote agents to do things that could have been a subagent in the same process. Cost: latency, ops burden, observability loss — all for no gain.
- **Tier-1-for-Tier-2 work.** Spawning a subagent to do work that should have been an overnight task. Symptom: the user waits for a result that doesn't need to be synchronous. Cost: the user's attention, and a fragile dependency on the session staying alive.
- **Tier-3-for-Tier-2 work.** Firing a `tmux send-keys` at a pane to leave a note. Symptom: the message arrives into a pane that may or may not be ready to receive it, when a mailbox would have captured it reliably. Cost: silent drops.
- **Tier-2-for-Tier-3 work.** Writing a mailbox message that needs to be acted on *now*. Symptom: the receiver polls every thirty seconds, so your "urgent" message sits in a queue until the next sweep. Cost: latency, and the illusion that the system is broken when it's actually just correct-but-slow.

Each of these is a scope mismatch. The fix is always the same: look at what scope the message actually needs to travel, and pick the tier whose strengths match.

## Takeaway

There is no one transport. There is a palette of four.

- **Tier 1** when the call is small and synchronous.
- **Tier 2** when the call must outlive the session.
- **Tier 3** when the call must reach a running agent on this machine.
- **Tier 4** when the call must reach a running agent on a different machine.

The rest of this book fills in how each tier works in practice — schemas, failure modes, naming, observability. But the mental model starts here: *pick your substrate per hop, not per system*. The operating system already built you a multi-agent bus. You just have to recognize which layer of it you need.
