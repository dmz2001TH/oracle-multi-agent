# 6. Retrospectives: The Daily Save Game

In the kind of video game where you can only save at a bonfire, the bonfire is the most important thing in the level. You route around it. You plan your approach to the boss based on where the bonfire is. You die a thousand times, but each death sends you back to the last bonfire, not to the start of the game. The bonfire is the reason the game has shape. Without it, every death would be a reset to zero, and after the third death you would quit.

This is a reasonable mental model for what a retrospective does for an AI agent.

A session ends. Under default conditions, the next session comes up empty — the agent has no idea what the previous session did, tried, or learned. The retrospective is the bonfire. You sit down at it at the end of the session, you write down what happened, and the next session — even if it is a brand new agent — can start from that point instead of from the start of the game.

This chapter is about the practice of retrospectives: what they are, what they contain, how to write them so they are actually useful, and how to pair them with an index so future agents can find what they need.

## What a retrospective is

A retrospective is a short structured document, written at the end of a session, that answers a small number of fixed questions. It lives on disk. It has a predictable location, a predictable format, and a predictable set of headings, so that future readers (human or AI) can parse it without needing to read the prose.

The goal is not "a record of what happened." You already have that in your append-only logs, your commits, and your handoff (see Chapters 4 and 5). The retrospective is a *distillation*. It takes the raw materials of the session and answers the question: *what should my future self know about today?*

The questions I use, in roughly this order:

1. **What did I do?** Factual list of the session's actions.
2. **What went right?** Things that worked and should be repeated.
3. **What went wrong?** Specific failures, with enough detail to avoid recurrence.
4. **AI diary.** A first-person, unguarded reflection from the agent about how the session felt.
5. **Lessons learned.** Extracted rules or heuristics, promoted from the narrative into durable advice.
6. **Pointers.** Links to commits, files, other retrospectives that are load-bearing for this one.

The whole document is usually one to two screens. Writing it takes five to fifteen minutes. That is the whole cost.

In the worked example I build on, this practice is formalized as a command called `/rrr` (short for "retrospective, reflection, resolution"). The specific command doesn't matter; any cadence that reliably produces a retrospective at session end works. The discipline is the point, not the trigger mechanism.

## Why the AI diary matters

Most retrospective formats borrow from human team retrospectives and stop at "what went right / what went wrong." For AI agents, this is not enough. The diary section — a first-person, honest, unguarded reflection — is the part that turns retrospectives from a record into a training set.

Here is why.

An AI agent reading its own past output cannot, by default, recover the *feel* of a past session. It can recover facts — this was tried, this failed, this commit landed. But the texture of the work, whether it was exhausting, whether it felt rushed, whether the agent was confident or grasping, is lost. And that texture is often the most predictive feature for whether the work will hold up.

A diary entry captures that texture. "I was confident about the fix after the first stress test passed, but I realized in the shower after the session that I hadn't actually tested the drain path, which is where the deadlock lived — next time, confidence after the first pass is suspicious, run the weird edge cases before declaring done." That is a kind of information that cannot be extracted from commits or logs. It lives only in the diary.

Over time, the diary accumulates into something like a personal field journal. A future agent reading it does not just learn facts; it learns taste. It learns what kind of over-confidence tends to precede a bug. It learns what kind of fatigue produces sloppy commits. These patterns are the most valuable long-term assets an agent can have, and they come exclusively from the diary practice.

## Writing the diary: first-person, honest, not polished

The single biggest mistake in writing AI diaries is writing them for an audience.

The diary is for the agent itself. It is not a PR, not a blog post, not documentation. Writing for an external audience makes you sand off the embarrassing parts — and the embarrassing parts are the most valuable.

The rules I use:

- **First person.** "I thought X" not "the agent thought X." The grammatical stance matters for later reading; it is what signals to the future reader that they are reading a subjective account.
- **Unguarded.** Say the thing you would not say in a commit message. "I was anxious about the deadline and cut a corner." "I didn't understand the code, I pattern-matched to something that looked similar." "I assumed the user wanted X but never asked." These are the entries you will most want to read later.
- **No editing.** Write it in one pass. Do not revise. The edit instinct is the audience-writing instinct, and it will destroy the diary's usefulness if you let it.
- **Short is fine.** Some sessions produce a single-paragraph diary. That's okay. Not every session has insight worth recording. Do not pad. But also do not skip — even "the session was routine, nothing notable, ran well" is data.
- **Honest about limits.** If you think you got lucky, say so. If you think you did the wrong thing but it worked anyway, say so. The value of the diary is proportional to its honesty.

One concrete test: if your diary entry could be published verbatim without embarrassment, it is probably not honest enough. A good diary entry has at least one sentence that you would rather not share. That sentence is what makes the entry worth writing.

## Lessons learned: promoted from narrative to durable rules

The diary is unstructured. The lessons section is structured. They serve different purposes and should not be merged.

A lesson is a rule that you want your future self to apply, stated generally enough that it transfers across sessions. "Don't try to wrap the consumer loop in a mutex" is not a lesson — it is a fact about this codebase. "When a race condition involves a check-then-act pattern, the lock must wrap *both* operations, not just the act" is a lesson, because it transfers.

The extraction process is: read the narrative (your logs, commits, diary), find the moments where you learned something, and ask yourself — *what's the general principle here?* Then write the lesson at the level of that principle, not at the level of the specific incident.

Lessons are what eventually become the agent's operating rules. If you do this for long enough, you build up a body of lessons that can be loaded into a fresh agent's context as "things this agent has learned." That becomes its inherited wisdom — the equivalent of a senior engineer's instincts.

Some lessons will contradict each other. That is fine. Durable rules are contextual; two rules that conflict in the abstract often apply to different situations, and the conflict is information. "Move fast and commit often" and "pause and think before committing to a large change" are both true, and a mature agent knows when to apply each. The conflict is not a bug; the conflict is the reason you need judgment.

## Retrospectives as training data for your future self

The framing shift I want you to make is this: **a retrospective is training data.**

When you write a retrospective, you are not just recording the past. You are producing an input that a future agent will read, either directly (in context) or indirectly (as reference material). That future agent will be shaped by what it reads. If you write retrospectives that are honest, specific, and well-indexed, the future agent inherits a working model of how this project has gone. If you write retrospectives that are vague and formulaic, the future agent inherits nothing.

This framing also changes how often you should write them. The default answer is "at the end of every session." That is correct for most work. But if a session had a high-density learning episode — a nasty bug, a surprising success, a shift in approach — it is worth writing a focused retrospective *immediately*, before the end of the session, specifically on that episode. These focused mini-retrospectives are where some of the most valuable agent memory comes from, because the reflection is captured while the texture is still vivid.

## Pairing with an index

A retrospective sitting in a folder with 300 other retrospectives is not useful unless the future agent can find it. Which means: retrospectives must be indexed.

The simplest index is a `MEMORY.md` file (or whatever you call it) at the root of your retrospective archive. Each line of the index points to one retrospective and includes a short hook — a sentence that tells the reader what they will find if they open the file.

Format:

```
- [YYYY-MM-DD session: message bus race fix](YYYY-MM/DD/session-1.md) — found a check-then-act race in wait_for_drain, fixed with lock-first pattern; documented dead ends
- [YYYY-MM-DD session: handoff protocol v3](YYYY-MM/DD/session-1.md) — converged on the 6-section handoff format
```

The rules for the index:

- **One line per entry.** No multi-line descriptions. The index's job is to be scannable.
- **Hook, not summary.** The hook is a reason to open the file. "Found a race condition" is a summary. "Found a check-then-act race in wait_for_drain, lock-first pattern fixed it" is a hook, because it tells you both the shape of the problem and the shape of the answer.
- **Index entries age.** Periodically prune. Entries from two months ago that turned out to be wrong can be deleted from the index; keeping them as active pointers misleads the next reader. (The retrospective files themselves can stay — see Chapter 11, "Nothing Is Deleted" — but the index is about current relevance, not historical record.)

The index is, in turn, its own artifact that benefits from the append-only discipline. Each new retrospective adds a line. The file grows monotonically. At any point in time, reading the index gives a future agent a complete catalog of what is known, with enough metadata to decide what to read in full.

## What about "I did nothing useful" sessions?

Some sessions are failures. No code shipped. No bug fixed. No progress. Two hours of dead ends.

Write the retrospective anyway. Especially the diary.

These are the most important retrospectives to write, because the mode of failure is exactly the thing a future agent needs to recognize and avoid. "I spent two hours trying to make X work before realizing the approach was fundamentally wrong" is a massively valuable entry. The next time the agent starts reaching for approach X, the memory of this failure should flag it.

The diary section for a failed session is also therapeutic in a way that sounds silly but matters for long-lived agents. If a session ended badly, writing about it structurally marks the end of that failure. The next session can open fresh instead of starting with an unacknowledged overhang of "yesterday was bad." This matters less for individual sessions and more for the continuity across many sessions — a practice that always acknowledges both successes and failures produces a healthier trajectory than one that only records wins.

## Common failure modes

**Skipping the retrospective when tired.** This is the most common failure mode, and it is exactly backwards. Tired sessions are the ones where the retrospective matters most, because the texture of fatigue is itself important information. Force yourself to write a short one. Five minutes. Two paragraphs. Better than zero.

**Formulaic writing.** After a month of retrospectives, they start to blur. You write the same five bullets each time. This usually means your question structure is not prompting you hard enough. Rotate your prompts, or add new sections when you notice recurring themes that deserve their own section.

**Mixing retrospective with handoff.** These look similar but do different jobs. A handoff is for the next agent to *act* — it points forward. A retrospective is for the next agent to *learn* — it points backward and up. If you merge them, both get worse. Write them as separate documents, possibly side by side.

**Never re-reading.** The writing side of the practice is not enough on its own. If retrospectives are written but never read, you gain only the (real but limited) benefit of the reflection itself. The compounding benefit comes from reading past retrospectives at the start of sessions. I cover the read side in Chapter 7.

**Over-structuring.** Some people, upon seeing that structure works, conclude that more structure is better. It is not. A retrospective with twelve headings is worse than one with four, because the reader is forced to navigate an elaborate schema instead of reading prose. Keep the structure light enough to be followed without thinking.

## A worked retrospective

To make this concrete, here is a retrospective as it might actually be written. Same session as the handoff example from Chapter 5 — the message bus race.

---

**Session: YYYY-MM-DD, 13:00–17:20 — message bus race condition**

**What I did**
- Read handoff from yesterday. Focus: race condition in `wait_for_drain`.
- Reproduced reliably with stress test at `--concurrency 32`.
- Traced the race to a check-then-act pattern; producer can enqueue between the emptiness check and the wait.
- Attempted fix: global mutex around consumer loop. Deadlocked the drain path.
- Reverted. Tried fix: lock before the check in `wait_for_drain`.
- Passed stress tests at 8 and 32 concurrency.
- Landed the fix on `main`. Updated handoff.

**What went right**
- Having a reproducer before the fix was the best decision I made today. When the first fix failed, I knew instantly, instead of finding out during review.
- The 30-minute log cadence paid off. When I hit the deadlock on the first attempt, I didn't waste time debugging from scratch — my own log told me exactly what I had just tried.
- Small commits. Three commits, each independently reviewable. Much better than yesterday's habit of bundling everything into one.

**What went wrong**
- I spent ~40 minutes on the global-mutex approach before realizing the drain path held its own lock. I should have read `consumer.rs` in full *before* proposing any fix, not during.
- I almost shipped without testing at higher concurrency. Only remembered at the end. Lucky it held up — not a strategy.
- I wrote a regression test after the fact but didn't make it part of the main test suite. It's in a scratch file. Next session should wire it in.

**AI diary**
I was overconfident going in. Yesterday's handoff made the bug sound obvious — "check-then-act race" — and I assumed the fix would be obvious too. It wasn't. The global-mutex approach felt natural and it took forty minutes to understand why it couldn't work. That forty minutes should have been ten if I had grounded first instead of jumping to an answer.

Also: when the first fix passed 8-concurrency tests, I felt done. I was not done. I have a specific tell now — when I feel done after the first passing test, I should go looking for the weirder edge cases, because that's usually where the actual bug lives. First-pass confidence is a signal to be more suspicious, not less.

The reproducer-first discipline was the hero of the day. I want to keep that habit even when the bug seems "simple."

**Lessons**
- Before proposing a fix for a concurrency bug, read all adjacent lock-acquisition sites — not just the one where the bug is. The interaction is the bug, not any single site.
- Confidence after the first passing test is a red flag. Treat it as a signal to look for the weird cases, not as permission to ship.
- Wire regression tests into the main suite *in the same commit* as the fix, not as a follow-up. Follow-up commits that "add a test" are the ones that get forgotten.

**Pointers**
- The fix commit on `main` — the lock-first change in `wait_for_drain`.
- Handoff file — for what to try next.
- `consumer.rs:142` — a second check-then-act pattern I noticed but didn't prove was buggy. Worth a look next session.

---

Notice what this retrospective does. "What went right" is specific, not self-congratulatory — it names decisions that can be repeated. The diary admits things that wouldn't go in a commit message. The lessons are general enough to transfer to future problems. The pointers are small but carry most of the navigational value.

That's a five-to-ten minute write, a two-minute read for the next agent, hours of downstream value. That ratio is the economics of the practice.

## Seasonal retrospectives

Daily retrospectives are the default cadence. Longer projects also benefit from occasional *seasonal* retrospectives — a retrospective of a week, a month, or a phase.

A seasonal retrospective is not a concatenation of daily ones. It is a step up in abstraction: *what arc did this period of work trace, and what durable lessons survived the noise?* Most daily content will not matter a week later. What matters is the shape: which problems dominated, which approaches emerged as reliable, which beliefs had to be revised.

Write these monthly or at phase boundaries. They reveal patterns the daily ones miss — a mistake that looked like a one-off on any given day shows up three times across thirty days and becomes a systemic issue worth a rule.

## The bonfire, revisited

Return to the save-point metaphor. A retrospective is the save point. The inner-loop writes (Chapter 4) are the autosave — frequent, noisy, redundant. The handoff (Chapter 5) is the quick-save — targeted, about to leave. The retrospective is the full save — a checkpoint that the next run can load fully to resume from a known good state.

Without the retrospective, the autosaves and quick-saves still give you recovery after a crash, but they do not give you *shape*. You cannot easily answer "what have we been working on this month?" from a thousand autosave lines. You can answer it from thirty retrospective entries.

This is why retrospectives are the single most important outer-loop artifact. They are the coarse structure that lets everything else make sense. And they are, on a well-run agent, as regular as breathing: session ends, retrospective written, index updated, bonfire lit. Then the next session sits down at the fire.
