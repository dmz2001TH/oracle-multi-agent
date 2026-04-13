# 5. Handoffs Are the Real API

I want to make an argument that sounds wrong on first hearing, and then show why it is exactly right.

**The handoff document is the single most important artifact an AI agent produces.** More important than the code it writes. More important than the tests it passes. More important than the bugs it fixes. Because the code, tests, and fixes are one-shot artifacts — they land once and then exist on their own — but the handoff is the interface that lets the *next* agent pick up where this one stopped. Without a handoff, every session begins from scratch. With a good handoff, work compounds across sessions the way it compounds across engineers on a well-run team.

This chapter is about what a handoff is, why it is load-bearing, what separates a good one from a bad one, and how to make writing them a discipline rather than an afterthought.

## The premise: sessions end

Every session ends. There are three ways it can end:

1. **Clean end.** You finish the thing, you stop, the session closes.
2. **Compaction.** The window fills, the agent is summarized, and the agent continues with a degraded memory that feels like the same session but is not.
3. **Crash.** The harness dies, the terminal closes, the process gets killed by the OOM killer at 3am.

Of these, only the first is the one most people design for, and the first is the rarest. The vast majority of real sessions end in state 2 or 3. Which means your defensive posture should assume the session will not get a graceful shutdown, and the handoff should exist *before* the end, not *at* the end.

When I say "the handoff is the real API," I mean this literally. An API is a contract between two entities that do not share memory, that communicate through a structured interface, and that may not even exist at the same time. That is exactly what two consecutive AI sessions are. The older session is, from the perspective of the newer one, a remote service that is already dead and can only be queried through the artifacts it left behind. The handoff is the response to the query.

## What a handoff is not

Before I describe what a handoff is, let me eliminate some things it is not, because people tend to produce those things and call them handoffs.

**A handoff is not a summary of what happened.** Summaries are written for readers who want to know what happened. Handoffs are written for an agent who needs to know what to do next. A summary of "I spent three hours debugging the auth flow" is useless. "The auth flow race is fixed in the latest commit on `main` — but there's a related bug in token refresh I noticed at line 47, didn't fix, should be next" is a handoff.

**A handoff is not documentation.** Documentation describes a stable state. A handoff describes an in-flight state, with all its mess intact. If your handoff reads like polished prose, you are doing it wrong; you have sanded off the seams where the pickup happens.

**A handoff is not a commit message.** Commit messages describe changes. Handoffs describe intent. A commit message says "added retry logic"; a handoff says "added retry logic but the exponential backoff constants are still placeholders, talk to the user about the desired behavior before using in production."

**A handoff is not a TODO list.** TODO lists have no context. A handoff has all the context you need to actually pick up the TODOs. "Fix the race" is a TODO; "the race is between `enqueue` and `wait_for_drain`, happens when the queue is empty and a new producer arrives mid-check, reproducible by running the stress test with `--concurrency 32`, I suspect the fix is a mutex around the check-and-wait, tried it on a scratch branch but it deadlocked the drain path, avoid that direction" is a handoff.

## The anatomy of a good handoff

A handoff is a small, dense document. Usually one screen. Sometimes two. It has a fixed structure so that the next agent can scan it in ten seconds and locate what they need.

The structure I have converged on after many iterations:

### 1. What we did

One paragraph. Factual. No editorializing. This is so the next agent can orient quickly. "Investigated the auth race reported in the tracked issue. Root-caused to `wait_for_drain` checking emptiness before acquiring the lock. Landed a fix on `main`. Stress tests pass."

### 2. What's shipped vs. what's in flight

This is the most important section. Split pending work cleanly into:

- **Merged / live.** What is already in the main line. Reference commits and PRs.
- **Drafted but not merged.** What is in a branch or PR waiting for review, including known issues.
- **Thought about but not started.** What you identified as needing to happen but didn't touch.

The reason this split matters is that the next agent will otherwise treat your work as either all-done or all-uncertain, and it is neither. It is mixed, and the mix is load-bearing information.

### 3. What we're blocked on

Any dependency on external input — the user, another agent, an API response, a review, a decision that is not ours to make. Name the blocker, name who can unblock, and name what question is pending. "Blocked on user deciding whether to retry on 5xx or surface to caller — see my last message" is a good blocker line. "Blocked" on its own is useless.

### 4. What to try next

The most practical section. Concrete, ordered, scoped. Not "continue debugging" — specific actions. "Run the stress test with `--concurrency 64` to confirm the fix holds at higher loads. If it fails, try the patch in `/tmp/alt-fix.diff` which takes a different approach." The next agent should be able to take the first item and start working without any further decision-making.

### 5. What I would not do

This is the section most people skip and the one that saves the most pain. List the dead ends you already explored, so the next agent does not re-explore them. "Do not try wrapping the whole consumer loop in a single mutex — I tried this, it deadlocks the drain path when the producer is also holding a lock on the backpressure channel." A line like that saves an hour.

### 6. Non-obvious state

Anything that the next agent cannot figure out from reading the code alone. Environment quirks, racy tests, dev server state, magic file locations, things you know but did not document elsewhere. "The dev server must be started with `NODE_ENV=test` or the auth middleware short-circuits. This is not in any README and cost me 40 minutes."

## A good handoff vs. a bad handoff: concrete example

Here are two handoffs for the same session, drawn from my own archives (lightly anonymized).

**Bad handoff (actual, from early in my practice):**

> Today I worked on the message bus race condition. Made good progress. Found the bug and fixed it in a commit. There's still some stuff to do around the consumer side. I'll pick it up tomorrow.

This is a summary, not a handoff. The next agent (which was me, the next morning) had to re-read the entire session log to figure out what "some stuff" meant, where the commit was, and whether the fix was final. I lost about 45 minutes reconstructing context that a 3-minute handoff could have preserved.

**Good handoff (same session, rewritten):**

> **What we did:** Traced the race condition in the message bus (the tracked issue) to a check-then-act pattern in `wait_for_drain`. Producer can enqueue between the emptiness check and the wait, and the consumer hangs. Landed a fix (lock-first) as the latest commit on `main`.
>
> **Shipped:** fix is on `main`. Stress tests with `--concurrency 8` and `--concurrency 32` pass cleanly.
>
> **In flight:** Nothing. The fix is merged.
>
> **Blocked on:** Nothing.
>
> **What to try next:**
> 1. Run stress test at `--concurrency 64` and `--concurrency 128` to confirm the fix holds under higher contention.
> 2. Audit the rest of the bus for similar check-then-act patterns. I did a quick grep but did not exhaustively check; the consumer side has at least one other suspicious pattern at `bus/consumer.rs:142` that looks related but is not yet proven to be a bug.
> 3. Add a regression test that reproduces the original race reliably, so we catch this class of bug in CI.
>
> **What I would not do:**
> - Do not try a global mutex around the consumer loop. I tried a variant of this (never committed) and it deadlocked the drain path when the backpressure channel held a lock.
> - Do not "simplify" the lock acquisition in `wait_for_drain`. The order matters — lock first, then check. Reversing it reintroduces the bug.
>
> **Non-obvious state:**
> - Stress test requires `RUST_TEST_THREADS=1` or it flakes for unrelated reasons (separate tracked flake).
> - The race is easiest to reproduce on Linux; on macOS the scheduler sometimes hides it.

The second handoff is five times longer and roughly a hundred times more useful. Writing it took eight minutes. Reading it and starting productive work took about thirty seconds.

## Discipline, not afterthought

The biggest mistake in writing handoffs is treating them as the last thing you do before you close the session. By that point you are tired, the context is already being compressed, and you write a summary instead of a handoff because the summary is what you can produce in that state.

The fix is to treat the handoff as a living document, updated throughout the session. Specifically:

- **Start the session by opening the handoff file.** If there is a prior handoff, read it. Then blank it out (or create a new one) and drop a stub at the top: "working on X, started at HH:MM."
- **Update it at every 30-minute save point** (see Chapter 4). Even just a line. "Ruled out hypothesis Y." This is cheap and keeps the document fresh.
- **Update it when decisions get made.** The moment you pick an approach, write it down, with alternatives rejected.
- **Finalize it just before ending the session.** At this point, 80% of the content should already exist — you are just polishing the ordering and writing the "what to try next" section, which is the only section that fundamentally must be written at the end.

This practice is the difference between a handoff that reads like a confession and one that reads like a briefing.

## Who is the audience?

Write the handoff for a smart, sober, slightly skeptical version of yourself who has not been in the session. That person is likely literally the next AI agent, but the framing holds for any reader.

They have not seen the session. They have not heard your hypotheses. They do not know which branch is live and which is abandoned. They have roughly three minutes before they start working, and they want to know — concretely — what to do first.

If you write to that audience, you end up with dense, actionable handoffs. If you write to an imaginary documentation reader, you end up with polished prose that the next agent has to translate into action on their own, which is wasted effort.

One useful test: before you close the session, read your own handoff as if you had not written it. If the first action it suggests is "read the session log to understand context," the handoff has failed. The whole point is that the handoff *replaces* the session log for anyone starting fresh.

## Where handoffs live

Storage matters less than people think, but it is not zero. A handoff must live somewhere the next agent will look for it. Some options, roughly in order of robustness:

- **Per-agent file in a known location.** The next agent, whoever it is, checks a fixed path and knows where to find the most recent handoff.
- **Pinned in the mailbox.** If your agents have a persistent mailbox (covered in Part III), pin the current handoff to the top so it is the first thing read.
- **Last entry in the session log.** This works for solo continuity — the next instance of the same agent reads its own log — but is brittle across agents.
- **Inline in a README.** Works for project-level handoffs but gets confused with user-facing docs.
- **Chat history.** Do not rely on this. Chat history is the least durable of all storage.

The specific choice matters less than the consistency. Pick one, stick with it, and make sure every agent in your system knows where to look.

## What about branching work?

Sometimes a session ends with work on multiple fronts. The handoff must not collapse them. If you were working on three related things, write three separate "in flight" and "what to try next" sections, one per front. Do not merge them into a narrative; the merge hides the parallelism, and the next agent will often drop one of the threads.

The reverse is also true: do not create a handoff for work that is actually linear. If a session did one thing, the handoff should be about that one thing. Artificial structure hurts as much as missing structure.

## The handoff is not for you

One framing that has helped me internalize handoff discipline is to reframe who I am writing for.

If you imagine the reader of your handoff as "future me," there is a natural tendency to skimp, because future-you supposedly remembers some of the context already. This is wrong in two ways. First, future-you may not exist — the next agent in this project might be a different instance, a different model, a different person entirely. Second, even if it is literally the same agent, the memory is gone; there is no "supposedly remembers." The future reader knows exactly what is on disk and nothing else.

So reframe: the reader is a competent stranger. They are technically capable. They understand the language you are writing in. They have no memory of this project. They have ten minutes to get productive. What do they need?

This reframing kills the main failure mode, which is under-specification driven by an assumption of shared context. Once you write for a stranger, you write the things you would otherwise skip — which files to open first, which branch is current, which commands actually work, what you can ignore.

The reframing also helps you cut. A handoff for future-you is often bloated with reassurances and context-reinforcement ("as we discussed earlier..."). A handoff for a stranger is lean, because the stranger does not need reassurance; they need information. The lean handoff is also the faster-to-read handoff, and speed of uptake is the whole point.

## Handoffs for partial failures

One case that is worth calling out: sessions that end in partial failure, where something is broken and the session ran out of time before fixing it.

The temptation is to minimize the failure in the handoff. "Ran out of time, picked up tomorrow." This is the worst possible handoff for a partial failure, because the next agent has to re-derive the state of brokenness from scratch.

The right pattern:

- **State the failure specifically.** "The fix on the current branch passes unit tests but fails the integration test `test_drain_under_load` — test output shows a hang in `wait_for_drain` at the lock-acquisition site."
- **State what you know about why.** Even if your theory is incomplete: "I think the issue is that the lock is not being released in the error path, but I ran out of time to verify. The relevant code is in `consumer.rs:160-190`."
- **State what you would try first if you picked it up.** "Add a log statement in the error path to confirm the lock release is skipped. If it is, the fix is to move the release into a `finally`-equivalent."
- **Do not revert.** A partial-failure handoff should leave the broken state in place (on a branch, not main) so the next agent can see it directly. Reverting to a clean state loses the evidence.

Partial-failure handoffs are harder to write than successful ones, because they require you to be honest about where you are. They are also, disproportionately, where the next agent gets the most value. A good partial-failure handoff often saves hours.

## The compounding effect

Here is the part that only shows up after you have been doing this for a month: good handoffs compound.

Each session starts with a handoff from the last one. If that handoff is good, the session opens at a running pace — the agent knows what to do, does it, and writes a new handoff. If every session is producing a good handoff, the *quality of context* the next session inherits keeps going up, because each handoff is a refinement on the last.

This is how AI agents go from "one-shot brilliant" to "useful over weeks." Not through better models. Not through bigger context windows. Through handoff discipline. The model in session N+1 is the same model that existed in session N; the difference is that session N+1 opens with a handoff written by a version of itself that knew the problem, which is a kind of externalized memory that the base model cannot produce on its own.

You can measure this. Take a project where the handoff discipline is strict, and a comparable project where it is not. In the strict project, week 3 is materially more productive than week 1, because the agents are standing on the shoulders of their past handoffs. In the loose project, week 3 is about as productive as week 1, because every session starts from scratch.

That difference — the compounding — is the payoff of taking handoffs seriously. The session ends. The handoff persists. And the handoff is what lets the next session do something that feels like remembering.
