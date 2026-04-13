# 02 — The Cost Model of Talking to Agents

Every message between agents costs something. Sometimes the cost is obvious, like a token bill. Sometimes the cost is a subtle one, like the half-second you'll never get back every time your cron fires. And sometimes the cost isn't the message at all — it's the *absence* of the message in a log you'll need three weeks from now, when you're trying to figure out why the system made a decision you don't remember approving.

The previous chapter gave you four tiers. This chapter asks: what does each tier cost you?

I'm going to work in four dimensions. You don't have to rank them the same way I do, but you have to think about all four, or you'll pick a tier that's cheap in the dimension you weren't measuring.

The dimensions:

1. **Tokens** — context overhead and LLM bill.
2. **Latency** — how long from "send" to "the receiver has actually acted on it."
3. **Operational complexity** — what has to be running, configured, and maintained for this tier to work.
4. **Visibility** — how easy it is to see, after the fact, that the message happened and what the receiver did with it.

A transport that's cheap in one dimension is usually expensive in another. That's not a flaw of a particular transport — it's the nature of the design space. The job is not to find the cheapest bus. The job is to pick the bus whose expensive dimensions are ones you can afford.

## Dimension 1 — Tokens

Tokens are the most-measured and least-understood cost.

Most-measured because every LLM call has a visible token meter. Least-understood because the cost of a message in tokens is rarely the tokens of the message itself — it's the tokens the message forces into everyone's context downstream.

Take Tier 1, the in-process subagent call. The message *to* the subagent is cheap: a single `Agent()` tool call with a prompt parameter. What's expensive is the tool *result*, which has to find its way back into the parent's context when the subagent finishes. If the subagent produces 10,000 words of research, those 10,000 words land in the parent's conversation. The parent now has to reason over them. Every subsequent turn in the parent's session drags those tokens along.

This is the reason the Claude Code guidance around spawning subagents emphasizes asking for concise reports. "Give me a summary in under 300 words." That's not because the subagent works better with a word limit — it's because the parent has to live with whatever comes back, for the rest of its life.

Tier 2, the file-based mailbox, has a different token profile. The message itself doesn't burn any tokens — it's a file on disk. The cost lands when an agent *reads* the inbox. If the agent's wake-up ritual is "read the last N mailbox messages," those N messages are now in its system prompt or first user turn. That's predictable, at least. Bigger problem: mailbox messages tend to accumulate. A two-week-old mailbox is a context-window grenade. Either you prune, or you paginate, or you pay.

Tier 3, tmux messaging, is close to free in tokens. A `maw hey <agent> "please do X"` call injects maybe a dozen tokens' worth of input into the target pane. The target agent now has to reason about the message, which is where the real cost is — but that's the cost of the *work*, not the cost of the *transport*. Tier 3 itself is almost invisible on the token bill.

Tier 4, federation, is the same as Tier 3 plus a transport shim. The message travels as a shell argument across SSH. Tokens stay the same as Tier 3 — the receiving agent pays the same cost to read its input, whether the input came from a local `maw hey` or a remote one. From the LLM's perspective, the tunnel is invisible.

Ranking by token cost (cheapest first, roughly): Tier 3 ≈ Tier 4 < Tier 2 < Tier 1.

Which feels upside-down, and is. The cheapest tiers in tokens are the ones with the most network and OS machinery underneath them. The most expensive tier in tokens is the one that's just a function call. That's because the expense is not in the transport — it's in the *context residue* the transport leaves behind.

## Dimension 2 — Latency

Latency is the dimension people overthink in databases and underthink in agent buses.

A Tier 1 subagent call has a latency floor equal to however long the subagent takes to think. You cannot get a response in less than the time the subagent needs to generate its output. That can be seconds to minutes. But as a *bus*, Tier 1 is instant — as soon as the result is ready, the parent has it.

A Tier 2 mailbox write is low-latency. Writing a file is microseconds. But *delivery* latency, which is the thing you actually care about, is however often the receiver polls the mailbox. If the receiver checks every 60 seconds, your worst-case delivery time is 60 seconds. If the receiver only runs on cron at 04:00, your worst-case delivery time is "tomorrow morning." Mailbox latency is the polling interval, not the write time. This is one of the easiest things to get wrong in design reviews — someone says "we'll use the mailbox" and everyone hears "real-time."

A Tier 3 tmux message arrives in milliseconds. `tmux send-keys` is a local process hitting a local socket hitting a local pane. The receiving agent sees the input the moment the kernel schedules its next read. There's no polling because the agent is already blocked on input. As long as the target pane is actually listening, this is as close to instant as anything on the machine gets.

A Tier 4 federated message adds a network hop and an SSH session startup. On a LAN or a fast WireGuard link, that's small — tens of milliseconds plus whatever SSH's first-connection overhead is. On a sleepy WG tunnel that hasn't seen traffic in a while, the first packet after idle can be slower, while the tunnel re-establishes its cryptographic state. It's not a big number. But it's not free, and if you're sending thousands of these a minute, it shows up.

Ranking by latency (lowest first, assuming the receiver is running): Tier 3 < Tier 4 < Tier 1 < Tier 2.

The big gap is between Tier 4 and Tier 1. Tier 1 feels fast because you're waiting for a result, not a handoff — but the *handoff itself* takes as long as the work. Tier 2 is the slowest as a transport because polling is the bottleneck.

## Dimension 3 — Operational Complexity

This is the one nobody wants to pay but everyone underestimates.

Tier 1 has almost no operational surface. The subagent runs inside the same process as the parent. If the parent is working, the subagent will work. There's nothing to configure, nothing to monitor, nothing to keep running. The price of admission is just whatever you paid to run the parent agent in the first place.

Tier 2 adds a filesystem. That sounds free — every machine has a filesystem — but the complexity is in the *schema*. Once you have JSON files flying around, you need:

- A convention for filenames (who owns collisions?)
- A convention for what fields are required (versioning?)
- A convention for when a message is "consumed" (do you delete it? move it? mark it read in a separate file?)
- A backup strategy (if the mailbox is the memory of the system, losing it is catastrophic)

None of this is hard. All of it is *real work*. And you cannot skip the work, because the moment a second agent type joins the bus, schema drift starts. You'll find a mailbox message written three weeks ago that no current agent knows how to parse.

Tier 3 adds tmux. You now need:

- A session/pane naming convention.
- A registry mapping agent names to pane addresses (or a way to discover them).
- A strategy for what happens when a pane dies mid-session.
- A way to reconcile "the registry says agent X is at pane 2" with "pane 2 is actually a dead shell now."

tmux itself is rock-solid. The complexity is around it — keeping the map from names to panes honest.

Tier 4 adds WireGuard, SSH, and a distributed naming problem. Now you need:

- A WireGuard config per node, kept in sync.
- Key management across machines.
- A way to detect when a peer is down (or has re-NATed) without assuming it's down.
- A convention for resolving `node:agent` names when the same agent name exists on two nodes (the #239 problem — see later chapters).
- Multi-node log aggregation, or you'll never be able to debug a failed hop.

WireGuard and SSH are each individually simple. The combination, with a name registry layered on top, is where a real operational practice starts. This tier is where you stop being able to debug with grep and start needing a mental model of the fleet.

Ranking by operational complexity (simplest first): Tier 1 < Tier 2 < Tier 3 < Tier 4.

Usefully, this tracks the tier numbering. Each step up the tiers adds one layer of infrastructure to own.

## Dimension 4 — Visibility

Visibility is the dimension you notice when something breaks.

Tier 1's visibility is excellent. The tool call appears in the parent's conversation log. The result appears right after. You can see who called, what they asked, and what came back, because it's all in one transcript. If a subagent made a bad decision, the bad decision is readable.

Tier 2's visibility is good but not automatic. The messages live on disk, so you can inspect them — but only if you know where to look. There's no natural "log" of the exchange. You can `ls` the inbox and see messages. You can't easily answer "when was this message written? who read it? did anyone act on it?" without explicit receipts and read-markers.

Tier 3's visibility is poor by default. `tmux send-keys` leaves a trace in the pane's scrollback, and the pane's log (if capture-pane is enabled) records the input. But unless you've set up logging discipline, a `maw hey` message arrives in a pane, gets consumed by the running agent, and the fact that it arrived is only visible in the receiving agent's own context — which is not somewhere the sender can see. Half the conversation lives in the sender's pane; the other half lives in the receiver's. Nobody sees both.

Tier 4's visibility is the worst. Now the two halves of the conversation are on different machines. The sender's log shows "I invoked `maw hey node-b:agent-y`." The receiver's log shows "I received a message." Connecting those two events requires you to either ship logs centrally (which undoes some of the no-hub virtue) or SSH around manually after an incident.

Ranking by visibility (best first): Tier 1 > Tier 2 > Tier 3 > Tier 4.

This is the dimension that tempts people to abandon the lower tiers and centralize everything. Don't. The fix for bad Tier 4 visibility is not "stop using Tier 4." It's *disciplined logging* on both ends of every hop, a timestamped audit trail per node, and a recovery pattern that assumes you'll have to correlate logs by hand when things go wrong. It's more work. But it's the work of the tier you chose.

## A Decision Table

Here's a rough scoring matrix. Lower is cheaper; higher is more expensive or harder:

| Tier | Tokens | Latency | Ops | Visibility cost |
| --- | --- | --- | --- | --- |
| 1 (in-process) | high | medium | very low | low |
| 2 (mailbox) | medium | high | low | medium |
| 3 (tmux) | low | very low | medium | high |
| 4 (federation) | low | low | high | very high |

Read horizontally. Tier 1 is expensive to talk through (tokens, because the result lives in the parent forever) but easy to see what happened. Tier 4 is cheap to talk through but hard to see what happened without doing extra work.

Nobody is at "cheap across the board." Nobody is at "expensive across the board." They're Pareto-spaced — each tier is the best at something and the worst at something.

## How to Pick

The cheapest bus is the one whose *expensive dimensions* are dimensions you can afford in this particular hop. That framing beats "minimize total cost" because it forces you to think about which dimension bites here.

Some practical rules:

- If the **user is watching**, pick the tier with the best visibility you can afford. Tier 1 or 2. The user will ask "what did it do?" and you want to be able to answer without SSH-ing into three boxes.

- If the **message is frequent**, pick a tier with cheap tokens. Tier 3 or 4. A loop that polls every minute at Tier 1 will bankrupt your context. At Tier 3, it's invisible.

- If the **message must survive a session**, pick Tier 2. It's the only one where the message doesn't evaporate when a process dies. Tier 1 dies with the parent. Tier 3 dies with the pane. Tier 4 dies with the receiving pane.

- If the **receiver might not be running when you send**, pick Tier 2. Every other tier assumes a running counterparty.

- If the **message is genuinely cross-machine**, pick Tier 4. But only if it *is* genuinely cross-machine. Don't federate because it sounds cool.

- If the **message is "do this right now,"** pick Tier 3 (same machine) or Tier 4 (remote). Mailboxes are too slow. Subagents block the caller.

The framing that helps most is: *name the expensive dimension before you pick the tier*. "I'm willing to pay ops complexity for real-time cross-machine delivery." "I'm willing to pay tokens for an in-context result." Say the trade aloud. If you can't, you're probably picking by vibes.

## The Cost Model Is Also A Prompt Strategy

One last thing, because this will come up in Chapter 3.

The cost model above is a physics model: what does each tier cost by nature. But the *same tier can be used with different prompt patterns*, and those patterns shift where the cost lands.

Example: Tier 1 is token-expensive because the subagent's output lands in the parent. But if you prompt the subagent to report briefly, the residue is small. Conversely, Tier 3 is token-cheap as a transport, but if the message you inject asks the receiver to do extensive work, the receiver now pays a large token bill in its own context. You moved the cost, not eliminated it.

This is the reason the next chapter is about fire-and-forget versus dialog. The pattern you pick shapes where the tokens live and who pays them — and a good transport choice can be undone by a bad pattern choice layered on top.

## A Worked Example of Mis-Costing

Here's a trap I've fallen into, to make this concrete.

I had a long-running agent on one machine that produced a small summary every few minutes. I wanted that summary available to an agent on a different machine. The obvious thing was to push each summary over the federated bus — Tier 4 — every time it was generated.

On paper this looked cheap: Tier 4 is token-cheap, latency is fine, and the agent on the receiving end would get the freshest possible information. In practice, it was a disaster in a dimension I hadn't priced: visibility. Every five minutes, a message arrived on the remote side. If I wanted to know "what did the remote summarizer say at 03:14?" I had to find the right pane on the right machine, scroll the scrollback, and hope it hadn't rotated off the top. There was no persistent record of what the remote agent had been told. When the remote agent later made a decision I disagreed with, I could not reconstruct its reasoning — I couldn't see the inputs it had been given.

The fix wasn't to change tiers. It was to change *what* each tier was used for. The summarizer now writes each summary to a Tier 2 mailbox on the remote side. The Tier 4 call is just a wake-up ping — "new summary for you, go read your inbox." Now the remote agent has a durable, inspectable record of every input it ever received. When I want to know what it was told at 03:14, I `ls` the mailbox.

The total cost went *up*: I'm now using two tiers instead of one, and there's more ops surface. But the dimension I actually needed — visibility — got dramatically cheaper, and that was the dimension I had been silently underfunding.

The moral is not "always use Tier 2 for records." The moral is that picking a single tier because it's "cheap" hides what you're spending in dimensions you're not measuring.

## Takeaway

There is no free transport. Every bus is a trade across four dimensions: tokens, latency, ops, and visibility.

- Tier 1 trades tokens for visibility and simplicity.
- Tier 2 trades latency for durability and zero ops.
- Tier 3 trades visibility for speed and cheap tokens.
- Tier 4 trades ops complexity for cross-machine reach.

The mistake isn't picking an "expensive" tier. The mistake is picking one without naming what it's expensive in, and then being surprised when that bill arrives.

The cheapest bus isn't the one that saves the most tokens. It's the one whose expensive dimension is one you've already decided you can pay.
