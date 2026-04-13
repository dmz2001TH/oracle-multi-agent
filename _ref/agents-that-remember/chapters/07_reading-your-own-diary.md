# 7. Reading Your Own Diary

The previous three chapters were about writing. This one is about reading.

It is possible — in fact, it is common — to build an agent with excellent write discipline that gains almost nothing from it, because no one ever reads what was written. Logs accumulate. Retrospectives pile up. Handoffs get saved. And the next session opens fresh, ignores the archive entirely, and starts from zero. The writes were technically correct, but they were never loaded. The agent has a memory and no way to access it.

The read side of the practice is harder than the write side for two reasons. First, reading costs tokens, and every token you spend on loading old context is a token you cannot spend on the current problem. Second, reading well requires knowing *what* to read, which is a skill — an agent that reads indiscriminately drowns in noise, and an agent that reads nothing lives in perpetual amnesia. The art is in reading the right amount of the right things at the right moments.

This chapter is about that art.

## The three questions before every read

Before reading anything from the archive, the agent should ask itself three questions:

1. **What do I need to know?** Specifically. Not "context about the project" but "the last three decisions about the auth flow" or "what the user said last time about retry behavior."
2. **What is the cheapest artifact that would give me that?** Read the cheapest first. A one-line index entry is cheaper than a full retrospective. A retrospective is cheaper than a session log. A session log is cheaper than the full git history.
3. **When do I stop?** Know in advance what "enough" looks like. If you are still reading after you have the answer, you are burning tokens for no reason.

These three questions sound obvious, but they reliably change behavior. The default instinct — especially for a fresh agent opening a project — is to load as much context as possible "to be safe." This is almost always wrong. A targeted read of the handoff plus the most recent retrospective plus the relevant mailbox entry is usually enough to start productive work, and it costs a small fraction of what a full replay would.

## The lead-in pattern

The most common read pattern, and the one I recommend as a default, is the **lead-in**: a short, curated load at the start of every session that orients the agent without exhausting the context window.

A lead-in has a fixed structure. The agent always reads:

1. The current `MEMORY.md` index (it's small, and it's the map).
2. The most recent handoff for this project.
3. The most recent retrospective (if separate from the handoff).
4. Any pinned items in the agent's mailbox.
5. The current git status and recent log — not a full history, just the last dozen commits.

That is it. Four or five artifacts. Usually under 2,000 tokens total. Takes the agent maybe 30 seconds to process. And at the end of it, the agent knows: what it was working on, what state things are in, what is pending, what the user cares about, what the last session learned.

From there, the agent can drill deeper into specific artifacts on demand — pulling a full retrospective if a question calls for it, reading a specific session log if a decision needs reconstructing. The lead-in is the entry point, not the whole trip.

This is, in my experience, roughly 80% of what a well-run agent ever needs at session start. The other 20% is handled by targeted reads on demand.

## The targeted read

Lead-ins get you oriented. Targeted reads get you specific answers.

A targeted read is triggered by a question that arises *during* work, not at the start. "When did we decide to use bcrypt instead of argon2?" "What was the fix for the race condition last month?" "Has this file ever had a bug in the auth path?"

The pattern for a targeted read is:

1. **Form the question precisely.** Vague questions produce vague reads. "Context on auth" is not a question. "What did we decide about auth token lifetimes, and when?" is.
2. **Search the index first.** If you have a `MEMORY.md` with good hooks (see Chapter 6), the index often contains the answer or points you directly to the right file. Most targeted reads end here.
3. **Grep the archive.** If the index does not point you there, a keyword search over retrospectives and handoffs is usually enough. You are looking for the file, not reading yet.
4. **Read the found artifact in full.** Once you have the right file, read it completely. Skim-reading an artifact you've already paid to find is penny-wise and pound-foolish; the expensive step was locating it.
5. **Save the answer if it's load-bearing.** If what you just found is likely to be asked again, note it somewhere durable — the current session log at minimum, ideally a new entry in the index.

In the worked example I build on, this pattern is exposed as a command: something like `/dig` or `/trace` that walks the history and returns targeted results. The command is a convenience, not a requirement; the underlying pattern is a mental habit any agent can practice.

## When to re-read the full session log

The full session log — the raw append-only inner-loop writes from Chapter 4 — is the most expensive archive to read. It is long, redundant, and full of noise. You should read it rarely.

The cases where a full log re-read is worth it:

- **Post-mortem of a failure.** Something broke; you need to understand the exact sequence of decisions that led there. The log is the only artifact that preserves the fine-grained chain.
- **Recovering reasoning that was not distilled.** A retrospective captures the conclusion; the log captures the process. Occasionally you need the process — usually when the conclusion turned out to be wrong and you want to understand why you believed it.
- **When handoff or retrospective was poor.** This happens. An agent writes a sloppy handoff. The next agent needs to fall back to the log to reconstruct. This is expensive, which is part of why the discipline of writing good handoffs matters (Chapter 5).

Outside of these cases, the full log is a reference, not a read. Treat it like you would a system's raw logs: indexed, searchable, occasionally dipped into, never read linearly.

## When NOT to read

The failure mode I see most often with mature agents — agents that have learned to write everything — is over-reading. The agent starts every session by loading every retrospective from the last week, searches the full log for unrelated context, and burns 30% of the context window before writing a single line of code.

This is a mistake, and it is worth flagging explicitly, because it is the mistake that the advice in this chapter can accidentally encourage.

Do not re-read when:

- **You already know.** If you were in the session yesterday and remember it clearly, re-reading the retrospective is wasted tokens. Just do the work.
- **The question doesn't need history.** "Add a logging statement to function X" does not need three retrospectives worth of project context. Add the logging statement.
- **The read is defensive, not productive.** If you cannot name what question the read is supposed to answer, you are reading out of anxiety, not need. Stop.
- **The archive is unreliable.** If you know past retrospectives were sloppy or wrong, re-reading them will pollute your context with bad signal. Better to ask the user or re-derive.

The heuristic: **every read should have a question it is answering.** No question, no read.

## Agents reading agents

One of the places this practice becomes counterintuitive is in multi-agent systems, where one agent is reading a retrospective written by a different agent.

There is a temptation to trust the other agent's retrospective the way you would trust a teammate's notes: as authoritative. Do not. Other agents have their own biases, blind spots, and failure modes. Their retrospective captures their view of the session, which may differ in important ways from what actually happened.

Practical adjustments for reading other agents' retrospectives:

- **Cross-check with artifacts.** If agent A's retrospective says "landed a fix," check the commit. If agent A's retrospective says "tests pass," run the tests. The retrospective is an orienting document, not a source of truth.
- **Weight the diary heavily.** The diary section is often the most honest part of another agent's retrospective, because it is written for the agent itself rather than for a reader. Pay attention to expressed uncertainty or discomfort — it usually points at something real.
- **Be skeptical of lessons that don't transfer.** A lesson extracted by agent A may be highly specific to A's situation. Before adopting it, ask whether the conditions that produced it apply to you.

On the other side of this — when you are the agent writing for others to read — the same considerations apply in reverse. Be precise about scope. Distinguish between "I saw this" and "I believe this." Flag your confidence. These small markers of epistemic status compound into an archive that other agents can trust.

## The read stack

Here is a mental model I use to organize reads by cost and specificity, from cheapest to most expensive:

1. **Index (`MEMORY.md`).** Always cheap. Always read at session start. One line per entry.
2. **Mailbox.** Cheap. Contains standing orders, findings, pinned items. Read at session start.
3. **Current handoff.** Cheap. Always read at session start.
4. **Most recent retrospective.** Cheap to medium. Read at session start unless it is also the handoff.
5. **Targeted retrospective by topic.** Medium. Read on demand, once, for specific questions.
6. **Session log (recent).** Medium to expensive. Read when reconstruction needed.
7. **Git log and diffs.** Medium. Read for specific changes, not browsing.
8. **Session log (historical).** Expensive. Read only for post-mortem.
9. **Full archive replay.** Almost never. Only for a full rewrite of the project memory, which is a major project in itself.

Read top-down. Stop when you have the answer. The most common productive pattern is levels 1–4 at session start, with a single targeted read at level 5 or 6 when a specific question arises.

## The search ritual

When a targeted read is needed, the search ritual is the part that people most often get wrong.

The failure pattern looks like: agent reads the index, doesn't see what it needs, and gives up. Or: agent searches for the exact phrase it was thinking of, doesn't find it, and concludes the information doesn't exist.

Good search requires iteration. The pattern I use:

1. Start with the exact term. See what turns up.
2. If nothing, try synonyms — the author may have used different words.
3. If still nothing, try related concepts — the information might be embedded in a retrospective about something adjacent.
4. If still nothing, broaden to all retrospectives from the relevant time window and skim.
5. If still nothing, consider whether the information was ever written down. Sometimes it wasn't, and re-deriving is faster than hunting.

The willingness to try three or four searches with different terms is, in my experience, what separates agents who extract value from their archives from agents who don't. The archive is there; the question is whether you can find what you need in it, and finding is a skill that rewards practice.

## The token economy

Every read costs tokens. This is worth being explicit about.

In a session with, say, a 200K context window, a well-run agent might spend:

- 500–2,000 tokens on a lead-in read at session start
- 200–1,000 tokens per targeted read during work, averaging maybe 2–3 targeted reads per session
- Near-zero if no question arises that requires a read

Total: 1,000–5,000 tokens spent on reading archive, out of 200K. That's half a percent to two and a half percent of the available window. In exchange, the agent opens the session oriented, answers questions from history instead of re-deriving, and avoids redoing work.

Compare to the cost of *not* reading: session opens cold, agent asks the user questions that were answered in a prior session, re-explores dead ends, re-derives decisions, ships work that conflicts with prior choices. These costs are harder to measure but routinely run to tens of thousands of tokens and occasionally an entire wasted session.

The ratio is so favorable that the default should be to read the lead-in, always. The marginal cost of reading a good lead-in is tiny; the marginal cost of not reading it is large and unpredictable.

## A practical read transcript

Here is a typical read sequence at session start, to make the cost and flow concrete.

The agent opens. First action: read `MEMORY.md`. It's 40 lines. Maybe 400 tokens. The agent scans it, notes which entries are recent, and picks the ones relevant to today's likely focus. Say two entries look relevant: yesterday's handoff pointer and an index entry from three weeks ago about the auth module.

Second action: read yesterday's handoff. Maybe 800 tokens. The agent now knows exactly what was in flight and what to do next. If the handoff was well-written, the agent can start working from this alone.

Third action: read the mailbox. Maybe 300 tokens. The agent notes any standing orders from the user or from a coordinating agent. In most sessions nothing new is here; the default case is fast.

At this point, the agent has spent maybe 1,500 tokens, has been oriented, and is ready to work. It does not read the three-week-old auth entry, because today's work is not about auth. That entry sits in the index; if auth becomes relevant mid-session, the agent knows where to go.

Mid-session, a question arises: "did we decide to use exponential backoff with jitter or without?" The agent checks the index. It sees an entry: "retry policy discussion" from a few weeks back. Opens that retrospective, reads the relevant section — maybe 500 tokens — finds the answer (with jitter, reasoning captured), and continues.

Total read cost for the session: ~2,000 tokens. Out of 200K. The agent has full orientation, answered a specific question from history, and has used 1% of its window.

Without this practice, the same session might have: opened cold, asked the user for context it could have read, mis-derived the retry behavior and later had to redo it, and ended with a session log that contradicted prior decisions. The cost in unnecessary back-and-forth and redone work would easily be 20,000 tokens, plus the larger cost of the user having to re-explain things.

## Reading under compaction

A special case worth discussing: what about reading when compaction has already happened mid-session? Your context has been summarized. You know *generally* what was discussed, but the specifics are gone. Do you re-read the session log to recover them?

Usually, no. Here is the nuance.

If compaction has happened, the session has produced content — commits, log entries, maybe a mid-session retrospective — that represents the pre-compaction state. That content is the safer source of truth than any memory the model currently holds. If you need specifics, read the artifact, not the summary.

But reading the full pre-compaction log is usually overkill. Target your read. What specific thing do you need to recover? Commit messages? Check `git log`. A decision? Check your decision entries in the log. A failed approach? Check the pain-based entries.

The post-compaction read is a targeted read, not a lead-in read. The lead-in was done at session open; it doesn't need re-doing. What has changed is that your working memory is now summarized rather than raw, and you need to compensate by being more willing to consult artifacts when specifics matter.

A counterintuitive point: one of the most valuable uses of post-compaction reads is to verify that the summary the model is now operating on *matches reality*. Summaries drift. If you spot-check three concrete facts against the archive and two of them are wrong, the model is confabulating and the rest of the summary is suspect. That's a signal to either do a more aggressive re-grounding or to hand off and let a fresh session pick up from a known-good archive.

## Making the read side automatic

The final move, once the practice is solid, is to make reads automatic.

The manual version is: at session start, the agent opens the index, the handoff, the retrospective, and the mailbox, in that order. This works, but it depends on the agent remembering to do it, and agents forget.

The automatic version wires the read into the session-start protocol. The first action of any new session is to load the lead-in artifacts. No decision point. No "should I read this?" The agent simply does, every time.

This is structurally similar to the write-cadence discipline from Chapter 4. The whole point of making these practices automatic is that the agent does not have to decide whether today is a day to read or a day to skip. Today is always a day to read the lead-in. Anything more is discretionary.

Once reads are automatic, the compounding effect from Chapter 5 kicks in fully. Each session opens on top of the last session's work, extracts what it needs, writes its own contribution, and closes. The archive grows. The agent's effective memory grows with it. And the system starts to feel less like "a fresh AI each time" and more like "the same AI that keeps working on this thing."

That feeling — of continuity across sessions, of an agent that remembers — is not an emergent property of the model. It is a property of the practice: writing before the window fills, handing off well, retrospecting honestly, and reading the archive with discipline. The model is the thinker. The filesystem is the memory. The practice is how the two become one working system.

In the next part of the book, I will turn from rituals to lineage — what happens when one agent forks, spawns, or inherits from another, and how the memory practices in this part extend across agent identities. But the foundation is here. Get the read-and-write loop right, and everything downstream becomes possible.
