# 4. Write Before the Window Fills

There is a specific kind of pain you only feel once, and after that you organize your whole life to avoid it. Mine happened around hour three of a debugging session. I had traced a race condition through four layers of a message bus, found the exact interleaving that caused it, worked out a fix that preserved ordering without blocking producers, and was about to write the patch. Then the context window compacted. The agent came back, asked me politely what I wanted to work on, and I realized — the whole chain of reasoning was gone. Not just the words. The reasoning itself. The thing I had assembled, piece by piece, for three hours, was now a cloud of half-remembered summary bullets that could not be reconstructed.

I spent the next two hours retracing my own steps, and the fix I eventually wrote was worse than the one I had lost. A week later I shipped a related bug that the original reasoning would have caught.

This chapter is about the defensive posture that prevents that outcome. The rule is simple, and framework-agnostic: **if it is only in the context window, it is not saved.** Everything else follows from taking that sentence seriously.

## The window is a scratchpad, not a safe

The context window is sometimes described as memory, and people who use AI agents heavily slowly unlearn that framing. It is not memory. It is a scratchpad the agent is currently writing on, and the ink fades the moment the session compacts, ends, or crashes. Compaction is especially deceptive because the session appears to continue. The agent keeps responding, keeps working, even keeps referencing "earlier" ideas. But the granular reasoning, the tried-and-rejected approaches, the specific values you pasted in — those are now summaries of summaries, and the agent cannot tell you whether a given detail survived or was smoothed over.

Treat the window as volatile. Treat it as RAM, not disk. Everything you want to still exist after lunch has to be written to disk before lunch.

Phrased that way it sounds obvious. In practice, when you are mid-flow, it is the last thing on your mind. You are thinking about the bug, not about the archive. That is exactly when the posture matters most, and exactly when it is hardest to remember to take. So you build rituals that force the write to happen without thinking — automatic, cheap, frequent.

## Three cadences

I have settled on three overlapping write cadences, each triggered by a different event. Any one of them on its own is insufficient. Together, they give you the kind of redundancy that means losing the context window is an inconvenience, not a disaster.

### Cadence 1: Every 30 minutes (time-based)

The simplest rule, and the one that most agent builders underestimate, is a timer. Every 30 minutes of active work, you dump state to disk. This is unconditional. It does not ask whether anything important happened. Important things accumulate quietly and you do not notice them one at a time; you notice them only when you try to reconstruct them from nothing.

The 30-minute cadence is a defense against the failure mode where you say "nothing has happened yet, I'll save later." You will say that until you are four hours in and everything has happened. The timer cuts through that.

What you write at the 30-minute mark does not need to be polished. It does not need to be structured. It can be four bullet points in a scratch file. The point is not the content, it is the habit — you are building a forcing function for externalization. The content gets better later; the habit has to come first.

In the worked example I build on (a multi-agent system running over a shared on-disk vault), this cadence shows up as an append-only log file per agent. The agent dumps its current working hypothesis, the last command it ran, what it is about to try next. That is it. Three lines, sometimes five. At the end of a six-hour session the log is dense and scannable, and you can reconstruct the arc of the session by reading it top to bottom in a minute.

### Cadence 2: Every major decision (event-based)

Time-based cadences are bad at decisions. A decision is usually made in the span of a single thought, and if that thought happens 28 minutes into a 30-minute cycle, the decision gets two minutes of life in the window before the next save. That is fine for the decision itself (which you will remember), but it is not fine for the *alternatives considered and rejected*, which are the part you cannot reconstruct later.

So every time you make a non-trivial choice, you save. Specifically, you save:

- What you chose
- What you considered and rejected
- Why you rejected each alternative

This is the most valuable kind of write, because when the next session — or the next agent — reopens this work, the first question they will ask is "why didn't we just do X?" If X is written down as a rejected alternative with a reason, the question answers itself. If it is not, the next agent will often re-do the evaluation and sometimes pick X this time, because the original reasoning never made it to disk.

The mistake here is to wait until the decision is "final." Decisions are rarely final. Save them as you lean into them, and if you later change your mind, write a second entry marking the pivot. An append-only record of decisions that got revised is much more useful than a single entry that hides the evolution.

### Cadence 3: Every "this took an hour" moment (pain-based)

The third cadence is triggered by difficulty. Any time something takes more than roughly an hour to figure out — a subtle bug, a non-obvious configuration, an environment quirk, an undocumented API behavior — you write it down. Immediately. Not at the end of the day. Not when you "get to it." The moment you resolve it and the adrenaline is dropping, because the adrenaline is what makes it feel unforgettable, and it is exactly the adrenaline that will mislead you about your future recall.

The structure I use for these:

- **Symptom.** What did I see that told me something was wrong?
- **Wrong guesses.** What did I think was the cause, and why was I wrong?
- **Root cause.** What was actually happening?
- **Fix.** What made it go away?
- **How to recognize it next time.** If I see this again, what's the fastest path to the answer?

That last line is the one most people skip, and it is the most valuable. The whole point of writing it down is to shortcut your future self. "If you see X, check Y first" is worth ten paragraphs of narrative.

## Append-only or nothing

I will die on this hill: the file you dump to should be append-only. Not "mostly append-only, I'll clean it up later." Append-only.

The reason is that the act of deleting past thoughts introduces judgment into a system that needs to be free of judgment to work. The whole point of the practice is that you write without filtering, because filtering is expensive and you will stop doing it. If you allow yourself to delete or edit past entries, you will start each write by second-guessing whether it is worth keeping, and the whole cadence collapses within a week.

Append-only also serves the future reader. When you or another agent reads the log later, the wrong guesses and the revised decisions are part of the story. A cleaned-up log loses the arc. A raw log shows you how the thinking actually progressed, which is often more instructive than the conclusion itself.

Practical implementation: one file per agent, per day, or per session (pick one and stick with it). Stamp each entry with a timestamp. Never edit. If you need to correct something, append a correction. Storage is cheap; reconstruction is not.

## Commit-often with real messages

There is a second, parallel, write stream you should be using, and most people using AI agents for coding already half-use it without realizing how much more value they could extract: git commits.

A commit is a write-to-disk. A commit message is a retrospective. When you commit often with real messages, you are building exactly the same log I described above, but for code instead of reasoning. The two streams complement each other: the code log tells you *what* changed, the reasoning log tells you *why*, and together they let a future agent reconstruct a session even if the in-context memory is fully gone.

The mistake is the giant end-of-session commit. "Changes from today" with 47 files modified and no body text is not a commit — it is a backup. It fails at the one job a commit is supposed to do, which is to mark a coherent unit of change that can be understood in isolation.

Rules for useful commits during an AI session:

- **Commit at every stable state.** If the tests pass, commit. If the feature works end-to-end even if it is ugly, commit. You can always squash later; you cannot always un-squash.
- **Subject line tells the future reader what and why, not how.** "fix race in message bus" is okay. "fix bug" is not. "add mutex around Queue.enqueue, wait_for_drain in consumer" is too much for a subject line — put the how in the body.
- **Body text, if present, mirrors the decision log.** What did I try, what didn't work, what is still uncertain. You will hate writing this the first three times. You will love it the first time it saves you.
- **Co-author attribution tells you who was driving.** If an AI agent was the primary author, mark it. Months later, knowing whether a commit came from you alone or from a particular agent (and which one) is load-bearing context.

A well-kept git log is the single most recoverable memory artifact in any AI-assisted project. Unlike vault files, logs, or mailboxes, git is bulletproof — it is replicated, timestamped, cryptographically chained, and supported by every tool in the ecosystem. If you do nothing else, do this.

## Retrospectives as the outer loop

The practices above are all inner-loop — they happen while work is in progress. There is a complementary outer-loop practice that happens at the end of a session (or a day, or a phase): the retrospective. I cover retrospectives in depth in Chapter 6, but they belong in this chapter too, because they are the final save of the session and the one that ties all the inner-loop writes together.

A retrospective is a short structured document answering four questions:

1. What did I do this session?
2. What went right?
3. What went wrong?
4. What would I tell the next agent to do differently?

That is it. Five minutes. Maybe ten. The inner-loop logs give you the raw material; the retrospective is the distillation.

I have watched agents with excellent inner-loop discipline still fail at handoffs because they never wrote a retrospective. The inner-loop logs are high-volume and noisy. Without a distillation pass, the next session has to read everything, which is expensive in tokens and in cognitive load. The retrospective is what makes the inner-loop logs useful — it turns a raw stream into a summary that a fresh agent can load in under a minute.

## Failure modes

Let me name the specific ways this practice breaks, so you can recognize them in your own work.

**Silent filtering.** You think you are writing everything, but you are unconsciously skipping the "boring" stuff — the configuration values, the small decisions, the intermediate steps. Later, when something breaks because of one of those small decisions, the log has a gap. Fix: if you find yourself deciding whether something is worth writing, write it. The decision cost is higher than the storage cost.

**Late writes.** You intend to write at the 30-minute mark, but you are "almost done with this thing" so you push it to 35, then 40, then you forget. Fix: set an actual timer. Every 30 minutes it fires, you write something, even if it is one line that says "still working on the thing from last entry." The continuity matters more than the content.

**Non-searchable writes.** You write, but in different places with different formats, and later you cannot find anything. Fix: one location per agent, one format, strict convention. I cover the specific convention in Appendix A, but the principle is: boring and predictable beats clever and nested.

**The "I'll clean it up later" lie.** You tell yourself the log is a draft and you will summarize it at the end. You will not. The end of the session is exactly when you have the least energy and the most fatigue. Fix: do not plan for a cleanup pass. Write the log in a shape that is already useful as-is, and write the retrospective separately as a *new* document, not a revision of the log.

**Writing for a reader that doesn't exist.** You start writing your log as if it were documentation for a public audience, which means you spend time on polish and skip the honest parts. Fix: the audience for the log is you, tomorrow morning, hungover and skeptical. Write for that person. They do not care about tone; they care about whether they can find what they need.

**Over-reliance on model "memory."** The model says "as we discussed earlier" and you believe it. Do not. The model is confabulating from a summary of a summary. If what it says matches what you wrote down, fine. If it does not, the log wins. Always.

## The cost question

Every time I teach this, someone asks: isn't this a lot of writing? Isn't it slow?

Yes, and it is the best trade in AI engineering. I have measured this in one-off experiments. The time I spend writing defensive logs is roughly 5–10% of a session. The time I *save* by not reconstructing lost reasoning is routinely 30% of a session, and in the worst cases it is 100% of a session — because the work that was lost simply cannot be recovered, and something has to be abandoned or redone from scratch.

The ratio of save-to-write time is also heavily asymmetric for AI-assisted work specifically, in a way it isn't for solo human work. A human engineer can often reconstruct lost reasoning by re-reading their own code — the code *is* a partial memory. An AI agent cannot reconstruct lost reasoning from code alone, because the reasoning it produced was never fully encoded into the code. It was encoded into the context window, which is now gone. So the write-everything posture costs a small fraction more per-session and saves a disproportionately large fraction when the context window goes.

## A day in the life of the posture

Let me show what this looks like in practice, as a sequence, so the abstract cadences become concrete.

It is 9:00. The session opens. Before I do anything, I read the lead-in artifacts (handoff, latest retrospective, mailbox). This takes maybe ninety seconds. I now know what I am doing today.

I open an empty session log file, date-stamped, and drop a one-line entry: `09:02 — starting on the token refresh bug from yesterday's handoff.` That's it. No structure yet. Just a marker.

At 9:15 I have a hypothesis. I write it in the log: `09:15 — guessing the refresh race is in the callback path, not the timer path. Why: the logs show the timer firing normally, the callback is where the state mutation happens.` One sentence. I keep working.

At 9:30 my timer goes off. I don't stop work; I write two lines in the log about where I am. `09:30 — confirmed the callback path holds the bug. Next: reproduce in a unit test before fixing.`

At 9:47 I write a reproducer. It fails, which is good — the test catches the bug. I commit: `test: add repro for token refresh race`. The commit message body has one paragraph describing the exact interleaving that triggers the failure.

At 10:05 I have a fix. It's a small change — three lines — but it took me twenty minutes to think through which three lines. I commit: `fix: serialize refresh callback against timer tick`, with a commit body that says what I tried first and why I rejected it.

At 10:10, decision moment: the fix is working, but I realize it introduces a latency cost. Do I ship it as-is, or look for a lock-free alternative? I stop and write a decision entry in the log: `10:10 — DECISION: shipping the lock-based fix. Alternatives considered: lock-free with CAS loop (rejected: adds complexity for maybe 0.5ms saved, not worth it for this call path). Revisit if profiling shows this path hot.` Now the decision is preserved with its alternatives.

At 10:30 the timer fires. Still on track. One-line log entry.

At 11:15 something unexpected happens: a stress test flakes. Not the one I was targeting — a seemingly unrelated one. I spend forty minutes tracking this down. It turns out to be a pre-existing bug in the test harness, not related to my fix. This is a classic "this took an hour" moment. I write a structured entry in the log: symptom, wrong guesses, root cause, fix, how-to-recognize. About fifteen lines total. I also commit the harness fix separately with a clear subject line.

At 12:00 I take lunch. Before closing the terminal, I update the handoff file at the top with a one-line "where I am" note, in case the session crashes while I'm gone. Takes 10 seconds.

That's half a day. The log has maybe eighty lines in it. There are four commits. The handoff is current. If the session crashed right now — OOM, compaction, anything — a fresh agent could open the log, the commits, and the handoff, and be productive inside five minutes.

## The posture, stated plainly

If you take one sentence from this chapter, take this one: **write as if the session is about to end, because it is.**

You do not know which message will trigger compaction. You do not know which tool call will crash. You do not know when the model will be updated or the harness will be restarted. The posture of assuming the session is about to end forces you to externalize continuously, and continuous externalization is the only thing that makes AI agents useful over multi-day time horizons.

In the next chapter I will talk about what happens at the boundary between sessions — the handoff — and why the handoff is the single most underrated artifact in AI engineering. The logs and commits from this chapter are the *inputs* to a good handoff. Without them, there is nothing to hand off; with them, the handoff writes itself. Which is the whole point.
