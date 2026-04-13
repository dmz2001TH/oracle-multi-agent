# 03 — When to Fire-and-Forget, When to Dialog

There are two fundamental shapes a conversation between agents can take, and most multi-agent designs go wrong because they pick the wrong shape — not the wrong tier, not the wrong framework, but the wrong *shape*.

The first shape is **fire-and-forget**. You spawn an agent, you give it a complete specification of the job, you walk away. The agent works. Maybe it reports back; maybe it doesn't. What matters is that the sender does not need to be present during the work. The sender has already said everything they're going to say.

The second shape is **dialog**. You send a message, you wait for a reply, you read the reply, you send another message. The work is interleaved between sender and receiver. Either party might ask questions, push back, or change direction. Both parties have to be alive the whole time.

These are not subtle variations. They are different *kinds of programs*, in the same way batch processing and interactive REPLs are different kinds of programs. You cannot retrofit a dialog onto a fire-and-forget agent, and you cannot make a dialog-trained agent do useful fire-and-forget work, without rewriting most of what you're asking of it.

This chapter is about how to tell which one you want, how each one shapes the *prompt* you write for the agent, and what goes wrong when you pick the wrong shape for the job.

## Fire-and-Forget

The defining property of fire-and-forget is that the sender's session does not need to survive the work.

In practical terms, the pattern I use most often looks like this: I spawn a Claude Code instance with `claude -p "<long prompt>"` inside a tmux pane. The prompt contains the entire assignment — what to do, what success looks like, how to report at the end — and I detach the pane and walk away. The agent runs for however long it runs. When it's done, its final output has instructions to do something visible: commit a file, open a PR, write to a mailbox, send a message to a specific teammate. That visible thing is how I know it's done. The sender (me) does not have to be watching.

The prompt for a fire-and-forget agent has a particular structure:

1. **Context fully stated.** You cannot ask a clarifying question. The agent has to have everything it needs already. If it encounters ambiguity, the prompt has to tell it how to resolve the ambiguity — usually "make the most reasonable choice and document what you picked and why."
2. **Success criteria explicit.** The agent has to know when to stop. "Done" is defined in the prompt, not negotiated.
3. **Reporting baked in.** The prompt specifies *how* the agent signals completion. "When done, write a summary to `<path>`." "When done, create a PR with body containing the word `ready`." "When done, post to inbox `done-queue`." Without this, the agent may finish and silently disappear, and the sender has no way to find out.
4. **Failure has a shape.** What happens if the work can't be completed? The prompt should say. "If you encounter X, write to `<error-path>` and stop." Otherwise, the agent will try to recover in ways you didn't ask for.
5. **Time or scope bound.** The agent should have some ceiling on what it will try. Open-ended prompts produce open-ended sessions. A prompt that says "explore until you've found something interesting" will still be exploring tomorrow.

A concrete shape:

```
You are a code-review agent.

Context: <all the relevant repo state, inline>
Task: Review the changes in <branch>. Look for correctness bugs and missing tests.
Success: Write your review to <path>/review.md with sections "Bugs", "Tests",
         "Nits", and "Ship it? yes/no". Keep it under 500 words.
If the branch does not exist or you cannot check it out: write <path>/error.md
and stop.
Stop when review.md exists.
```

Notice what's not in there: any expectation that the sender will answer a follow-up. Any place where the agent pauses to ask. The agent either produces `review.md`, produces `error.md`, or runs out of time. There is no fourth option.

Strengths of fire-and-forget:

- **Sender is free.** The moment the work starts, the sender can close their laptop. The work proceeds without them.
- **Parallelizable.** Nothing forces you to spawn one at a time. Fifty fire-and-forget agents running in parallel don't interfere with each other, because none of them are waiting on a sender.
- **Cheaper to coordinate.** There is no back-and-forth to route, no ping-pong of messages through a bus.
- **Testable.** A fire-and-forget prompt is a deterministic (or at least bounded) function from inputs to side-effects. You can run it, inspect the outputs, iterate the prompt, and run it again.

Weaknesses:

- **You have to specify fully up-front.** If something is unclear, it stays unclear. There is no one to ask.
- **Recovery is inside the agent's prompt, not in the human's head.** If the agent gets stuck, you have to have predicted it, or the agent fails silently.
- **Results land where you told them to.** If you forgot to say "report here," you will find out by discovering nothing changed.
- **Debug loops are slow.** Iterating on the prompt means re-running the full job each time. If the job takes half an hour, each prompt iteration costs half an hour.

When to use fire-and-forget: any well-scoped, discrete piece of work where you can write down what "done" looks like. Code reviews. Single-pass refactors. Searches. Batch updates. Overnight investigations. Anything you'd have written a shell script for if the task were mechanical.

When *not* to use fire-and-forget: anything genuinely exploratory, where the next step depends on what you found in the previous step and you can't predict what you'll find. Anything where you're likely to change your mind. Anything you want to intervene in.

## Dialog

Dialog is what most people imagine when they hear "multi-agent system." Agents ping each other. One asks, the other answers. Work progresses through messages.

In the system this book is grounded in, dialog happens through the SendMessage primitive: one agent addresses another by name and sends a message; the other agent receives it as an event in its own context and chooses whether to reply. A back-and-forth is many of these events interleaved. Either agent can interrupt, either can go quiet, either can ask a question that redirects the work.

The prompt for a dialog-capable agent is almost the opposite of a fire-and-forget prompt:

1. **Minimal up-front context.** You don't need to specify everything. The agent can ask. This means the prompt can be shorter and more open-ended.
2. **"Done" is negotiated.** There may not be an explicit success criterion. The agent may be told to work "until the teammate signs off," which is determined at runtime.
3. **Interruption is expected.** The agent has to be ready for new information to arrive mid-task. It can't have a rigid plan that breaks if a message re-routes it.
4. **Reporting is continuous.** Instead of a single end-of-run report, the agent talks as it works. Teammates pick up status from the ongoing stream.
5. **Termination is explicit.** Because there's no fixed stopping condition, somebody has to say "stop." Either the sender, or a watchdog, or a "shutdown_request" primitive the team agrees on.

A concrete shape, from the system in this book:

The team lead sends a task assignment to a researcher via SendMessage. The researcher starts work, hits ambiguity at step 2, and sends a question back to the lead. The lead answers. The researcher produces a partial result, shares it, asks if that's the right direction. The lead says "yes, keep going on that angle but skip X." The researcher continues. Eventually, the researcher posts a final summary and marks its task completed.

The pattern is ping-then-wait. Every ping is followed by (usually) a wait, because the agent needs the reply before it can keep going.

Strengths of dialog:

- **Mid-course correction.** The work can change direction as it becomes clearer what the real goal is. You don't need to know the answer when you start.
- **Ambiguity is okay.** If the agent is unsure, it can ask. Nothing is wasted by being unsure — the question is cheap.
- **Shared understanding emerges.** Over a dialog, both agents build up a model of what the other is doing. Their next messages are more precise because of what was said before.
- **Harder problems become tractable.** Problems that would require paragraphs of prompt in fire-and-forget can be started with a short one and refined in flight.

Weaknesses:

- **Both parties must be alive.** If the sender closes their laptop, the researcher stops receiving replies. The conversation freezes.
- **Sequential by nature.** Dialog is hard to parallelize. One agent waiting on another is idle. A dozen dialog pairs running in parallel don't interfere, but each pair is sequential within itself.
- **Expensive in tokens.** Every message adds context to both sides. A long dialog is a long context on both ends.
- **Easy to stall.** If the sender forgets about the agent, or the agent forgets to send a reply, the dialog dies silently. You need a convention for "you've been quiet too long, are you okay?"

When to use dialog: open-ended exploration, collaborative reasoning, interactive debugging, anything where the sender is going to be present anyway and would rather nudge than specify.

When *not* to use dialog: long-running background work, anything you want to walk away from, anything where the overhead of coordination exceeds the overhead of writing a careful prompt once.

## The Pattern Dictates the Prompt

Here's the observation that took me the longest to internalize:

> You cannot take a prompt written for fire-and-forget and use it in a dialog agent, or vice versa, without rewriting most of it.

A fire-and-forget prompt specifies heavily, defines termination, bakes in reporting. If you hand that prompt to a dialog agent and expect them to be collaborative, they won't be — they've been told there's a path and an endpoint, and they'll march down it. They won't ask clarifying questions, because their prompt doesn't say they can.

A dialog prompt is loose, open-ended, collaborative. If you hand it to a fire-and-forget agent and then walk away, the agent will reach the first ambiguity and either stall, or ask a question nobody will ever see, or (worst) invent an answer and proceed. There's no sender to clarify with. The dialog prompt assumed a presence that no longer exists.

This means that deciding which shape you want is not a "later concern" — it's upstream of writing the prompt. If you change your mind later, you are not tweaking a prompt. You are writing a new one.

Some concrete consequences:

- **Don't take a dialog and "convert" it to fire-and-forget.** If you have a conversation that worked well as dialog and you want to automate it, you are not copying the prompt. You are writing a new, self-contained prompt that bakes in the decisions the dialog was exploring.
- **Don't take a fire-and-forget prompt and "make it more collaborative."** If you want collaboration, you rewrite the prompt to be open-ended. Adding "also, feel free to ask questions" to an otherwise-complete prompt confuses the agent — it's been told what success looks like, and also been told that success is negotiable. It will pick one.

## Mixing the Patterns

You can absolutely have a system that uses both patterns, as long as each *hop* is cleanly one or the other.

The cleanest mix I've shipped is this:

- A user and an orchestrator agent are in dialog. The user is present, the orchestrator is present, messages flow back and forth.
- At some point in the dialog, the orchestrator decides a piece of work is well-scoped enough to farm out. It writes a complete fire-and-forget prompt and spawns a subagent (or, at a different tier, a `claude -p` process in a tmux pane). The subagent runs.
- The orchestrator returns to the dialog with the user. Eventually the subagent completes, its report is picked up, and the orchestrator summarizes it for the user.

Within the user↔orchestrator hop, the pattern is dialog. Within the orchestrator↔subagent hop, the pattern is fire-and-forget. Each hop's pattern is clear, and each hop's prompt is written correctly for its pattern.

What goes wrong: trying to have a "mostly fire-and-forget with occasional check-ins." The subagent doesn't know whether to specify up-front or to wait for input. If the user happens to be present, it might ask a question; if the user isn't, it might stall. This is the pattern that produces ghost agents — processes that are neither finished nor working, just stuck, waiting for an input that was never going to come.

## Signals That You've Picked Wrong

A few symptoms I've learned to recognize:

- **You keep opening the pane to check on it.** You told the agent to fire-and-forget, but you wrote an ambiguous prompt, and now you have to watch because you're not sure it's going to do the right thing. Fix: either commit to the fire-and-forget (rewrite the prompt to remove the ambiguity) or switch to dialog and close the loop explicitly.
- **The agent is asking clarifying questions nobody is answering.** You wrote a dialog prompt, but the counterparty is gone. Fix: either bring the counterparty back, or rewrite the prompt for fire-and-forget with a sensible default for each ambiguity.
- **You're copy-pasting messages from one pane to another.** You have a dialog, but the two participants aren't on the same bus. Fix: put them on one. That's what the transports in Chapters 1 and 2 are for.
- **You got a result but you don't know what the agent did.** Classic fire-and-forget failure. You didn't bake reporting into the prompt. Fix: next time, specify where the agent should write its trail.
- **You told it to stop but it kept going.** The prompt didn't have a clean termination condition. This happens most often when people try to do fire-and-forget with dialog-style prompts ("work on this with me").

## Reporting: The Thing Both Patterns Need Done Differently

Reporting is the single detail that most distinguishes the two patterns, because both need it, but in completely different shapes.

Fire-and-forget reporting is **one-shot and structured**. The agent produces a final artifact at a specified location with a specified shape. You know where to look. You know what to expect. You can parse it if you need to.

Dialog reporting is **continuous and conversational**. The agent narrates as it works, shares partial findings, asks for validation, adjusts. You don't wait for a "final report" because there isn't one — the dialog *is* the report.

If you catch yourself asking "should the dialog agent also produce a final summary at the end?" — maybe. But then you're asking it to do both. Do it consciously. And if you catch yourself asking "should the fire-and-forget agent also talk as it works?" — the answer is usually no, because there's nobody listening. The talk is waste.

## Watching for Dialog Creep

One more failure mode, because it's common enough to deserve a name: *dialog creep*.

Dialog creep is what happens when a fire-and-forget task slowly becomes a dialog because the sender keeps "just checking in." I started an agent on an overnight refactor. I told it to commit its work at the end. Twenty minutes in, I was curious, so I looked at the pane. Forty minutes in, I sent it a small clarification ("actually, skip the tests folder"). An hour in, I asked for a status. By now, the agent is no longer fire-and-forget — it's in a dialog, one I didn't mean to be in, and the prompt I wrote for it wasn't designed for that.

The symptom of dialog creep is that you keep opening the pane. The cause is that you *could* have written a better fire-and-forget prompt — one that preempted the clarification, reported status at useful checkpoints, and committed to a stopping condition — and you didn't, so the gap between what you specified and what you wanted got paid for in your attention instead of in the prompt.

The antidote is to notice. The moment you find yourself wanting to check in, ask: "Am I in a fire-and-forget that I wrote too loosely? Or am I in a dialog that I'd rather walk away from?" If the former, let this one finish and write the next prompt tighter. If the latter, close the loop — either tell the agent to wrap up, or commit to being present.

The cost of dialog creep isn't just your attention. It's that you've violated the rule from earlier: *both parties must be alive in a dialog*. If you drift in and out, the agent ends up talking to a ghost — sometimes answered, sometimes not, unable to plan around when you'll be there. That is a uniquely frustrating mode for an agent to be in, and it produces output that reflects it: hedging, stall, and repeated requests for confirmation.

## Takeaway

Every hop between agents is one of two shapes:

- **Fire-and-forget**: the sender specifies fully, walks away, and the receiver reports via a predetermined channel.
- **Dialog**: both parties are alive, messages interleave, work proceeds through back-and-forth.

The prompt you write is downstream of which shape you picked. Fire-and-forget prompts are complete, bounded, and report-aware. Dialog prompts are open, collaborative, and assume a live counterparty.

You can mix the two — but only per hop, never within a hop. The moment a single hop tries to be "kind of both," it becomes neither, and the agent gets stuck in the seam.

Pick the shape first. Write the prompt to fit. Don't retrofit.
