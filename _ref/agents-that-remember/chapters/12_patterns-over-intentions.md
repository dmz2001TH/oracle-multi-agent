# 12. Patterns Over Intentions

> Observation beats declaration. Read what the system did, not what it meant to do.

The second principle cuts against one of the most natural instincts of anyone building with AI agents: the instinct to trust the agent's self-report.

When an agent says *"I updated the mailbox"* — do you believe it? When it says *"I fixed the bug"* — do you check? When its retrospective claims *"we shipped three PRs today"* — do you look at git log, or do you take the summary as fact?

If you take the summary as fact, sooner or later the system will eat you.

This is not because AI agents are liars. They are not. But they are *narrators*, and narration is always a lossy compression of what actually happened. The agent wrote one thing, intended another, remembered a third, and summarized a fourth. Somewhere in that chain, three of the four will diverge from reality. The question is not whether narration drifts. The question is what you trust as ground truth when it does.

The answer is: always trust the pattern. Never trust the intention.

## What Counts as a Pattern

A "pattern" in this principle's sense is an observable trace — something the system *did*, captured in a way that can be replayed or queried.

Examples of patterns:

- The git log (what was actually committed, with what hash, at what time)
- The mailbox files on disk (what bytes are actually there)
- The inbox JSON (what messages were actually delivered)
- Shell history (what commands were actually run)
- HTTP server access logs (what requests were actually served)
- File modification timestamps (when files were actually touched)
- Process state (what processes are actually running)

Examples of intentions — things that *sound like* patterns but aren't:

- The agent's retrospective summary
- A PR description
- A commit message
- A comment in code
- A README's claim about what the system does
- A Slack message saying "I just fixed X"
- A handoff note saying "the state is now Y"

Intentions are useful — they encode what a human or agent *wanted* to happen, which is data about purpose. But when you're debugging, auditing, or making decisions, and there's a conflict between intention and pattern, the pattern wins every time.

## The Classic Failure Mode

Here is the shape of nearly every debugging session that goes sideways:

1. Something is broken.
2. You ask the agent (or the human engineer) what's happening.
3. They tell you their mental model of what's happening.
4. You try to fix the thing based on that mental model.
5. The fix doesn't work.
6. Several hours in, you finally `tail -f` a log or `git log -p` a file, and the actual behavior is completely different from what the mental model claimed.
7. The real fix takes five minutes.

The wasted hours are the cost of trusting intention over pattern. The five-minute fix was available from the start, if you'd gone to the observable trace first.

I have made this mistake. Every engineer has made this mistake. The way to stop making it is not to trust people less — it is to build the reflex of *always touching the pattern first*, before you touch the story.

## Agents Are Especially Prone To Confabulation

With human engineers, at least, you get the occasional "I don't know, let me check." With AI agents — especially large language model agents — you often get confident-sounding summaries that are partial fabrications.

This is not malice. It's the shape of how LLMs generate text. They produce plausible continuations. When asked "what did you do in the last 50 turns," they produce a plausible narrative. Much of the time, the narrative is largely correct. Sometimes it merges two sessions. Sometimes it hallucinates a file operation that never happened. Sometimes it skips the crucial failure and reports only the successful retry.

So when an agent says *"I updated the mailbox with the new standing orders,"* the principle says: don't take that as a truth claim. Take it as a hypothesis.

To convert the hypothesis to a fact, do the observation:

```bash
ls -la ψ/agents/my-agent/mailbox/
cat ψ/agents/my-agent/mailbox/standing-orders.md
```

If the file is there and the contents match the claim, the hypothesis is confirmed. If not — and this happens more often than you'd guess — you've just saved yourself from acting on a phantom.

Build tooling that makes this observation cheap. A single command that shows the current mailbox state. A single command that shows recent git activity. A single command that dumps inbox messages. When observation is one keystroke, it becomes default. When observation requires three terminal windows and sudo, people take the agent's word.

## "Read The Inbox JSON, Not The Agent's Summary"

The multi-agent system this book is drawn from has an inbox mechanism. Agents write messages to each other. Each agent has a directory like `ψ/agents/$NAME/inbox/` full of JSON files, one per message.

A common query is: *"did agent A actually receive the message agent B said it sent?"*

There are two ways to answer this:

**Wrong way:** Ask agent A. "Did you get the message about X?" Agent A reads back its recent activity and says yes or no.

**Right way:** List agent A's inbox directory. If there's a file there with the right sender and content, the answer is yes. If not, the answer is no.

The wrong way can fail in subtle ways. Agent A might have received the message but forgotten to mention it. Agent A might confabulate receiving a similar message because it thinks one must have come. Agent A might report success because it received *some* message from B, not the specific one under discussion.

The right way cannot fail. The JSON file is either there or it isn't. The bytes do not lie.

Every piece of important state in a multi-agent system should have a question like this you can ask — a directory you can list, a log you can grep, a database row you can select. If there is important state that you can *only* query by asking an agent, you have not built observability; you have built a rumor network.

## The Git Log Is The Source Of Truth

This generalizes well beyond agents. For any codebase, the git log is the pattern. What the dev said in standup, what the PR description claims, what the commit message asserts — those are intentions. The log entries, the diffs, the file contents at HEAD — those are patterns.

When you need to know "did this actually ship," there is one answer and it lives in `git log`. Everything else is a narrative about git log.

This principle has practical consequences for how you review code, how you audit a codebase, and how you onboard. It suggests:

- Read the diff, not the description.
- Spot-check commits against their stated messages.
- When a doc claims a behavior, grep for the code that implements that behavior.
- When a commit message says "refactor only," verify with `git show` that no behavior changed.

A doc that gets out of date is not a problem. A doc that nobody cross-checks against the code is a problem. The docs decay, the code lives. When the two disagree, the code wins — because the code is what actually runs.

## Logs Over Self-Reports

This principle has specific bite for AI agents because agents can do a lot of work in a way that feels opaque. A chain of tool calls, a sequence of file edits, a round trip to an API — the agent's self-narrative might summarize all of that as "updated the auth flow," which is useless when you need to understand what actually changed.

The fix is logging. Not the agent's retrospective (that's intention). The tool-call logs — the raw record of *"tool X was invoked with parameters Y at timestamp Z and returned result W"*.

In the maw-js system, every tool invocation is written to a session log. The log is append-only. It is never edited for prose. It is rarely the thing you read for a quick status check — but when something goes wrong, it is always the thing you read for ground truth. "What did the agent actually do when it claimed to run the test?" → grep the log for `test` → see the exact command, exit code, and output.

If your agent framework does not write this kind of log, add it. It's not optional infrastructure. It's the same infrastructure every serious distributed system has, repurposed for an agent. Just as you wouldn't run a microservice in production without access logs, you shouldn't run an agent without tool-call logs.

## The Pattern Beats The Intention Even When It's Ugly

A subtle consequence of this principle: sometimes the pattern will show you something that contradicts not just an agent's claim, but your *own* memory.

You remember shipping three PRs yesterday. The git log shows two. You remember cleaning up a directory. The filesystem shows the old files are still there. You remember the agent completing a handoff. The handoff file doesn't exist.

The reflex in these cases is to distrust the evidence — "surely I did it, the log must be wrong." Resist. In ninety-five percent of cases, your memory is the thing that's wrong. Human memory is a narrator too. It reconstructs. It fills gaps. It retrofits.

The filesystem, the git log, the timestamped inbox message — these are cold, untrustable-looking, easy to dismiss. And they are almost always right. The pattern is the ground. Your memory is also an intention.

## What "Patterns Over Intentions" Is Not

A principle this strong-sounding invites misreading. Two clarifications:

**It is not "ignore what people say."** Intentions matter. A commit message, a PR description, a retrospective — these carry meaning. They tell you what the author was *trying* to do, which is critical for understanding *why*. The principle says: when intention and pattern conflict, the pattern wins on what *happened*. The intention still wins on what was *meant*. Both are true at once.

**It is not "never trust the agent."** You can trust the agent to do its job. You just can't trust the agent's narrative summary as a substitute for the work product. Ask the agent to do things, let it do them, then verify via the pattern. This is no different from how you'd manage any contractor: trust but verify, and the verification is always against what shipped, not what was reported.

## Making Observation The Path Of Least Resistance

For this principle to actually shape behavior, you need observation to be easy. If checking the pattern takes five minutes and reading the summary takes five seconds, the summary will win almost every time — and the principle will remain an aspiration.

Things I've found that help:

**A single dashboard command.** `maw` (or whatever your status command is) shows, in one screen: recent git activity, mailbox state for your active agents, recent inbox messages, current task list. One keystroke gets you from "I wonder" to the pattern.

**Inline links from intentions to evidence.** When an agent writes a retrospective that says "shipped PR #N," the retrospective links to PR #N in GitHub. When a handoff says "left the branch in state X," the handoff includes the exact commit hash. The intention points at the pattern. You can click through in one step.

**Tool-call logs that are grep-able.** Plaintext, one call per line, with timestamps. Any developer (or any agent) can find out what actually happened without special tooling.

**A habit of closing with evidence, not assertion.** When you (or an agent) finish a task, the closing report is not "done" — it's "done, commit `<hash>`, file X updated, test Y now passing." The assertion is paired with the pattern. The reader can verify without asking.

These are small things. They are also the difference between a system where you can trust nothing until you've dug through logs, and a system where observation is a reflex that costs nothing.

## The Generic Takeaway

If there is only one sentence you carry from this chapter into your own agent system, let it be this:

> Observation beats declaration. When you want the truth, read the trace, not the summary.

The trace is harder to read. It's longer, denser, less polished. It does not flatter the reader or tell a clean story. It is just what happened, in whatever order it happened.

Learn to love the trace. Learn to write systems that emit rich, searchable traces. Learn to build agents whose reports link back to traces instead of claiming to replace them.

Next chapter takes this into the third principle — the external brain — where we'll stop trying to make the model remember things and start putting the memory where it belongs.

## A Worked Example: The Inbox That Wasn't Delivered

Here is a failure mode I watched unfold in real time. Two agents were supposed to coordinate: Agent A would generate a report, write it to Agent B's inbox, and B would pick it up on its next session start.

The report was written. A's retrospective confirmed: "delivered report to B's inbox." B's next session started. B's `/inbox` ritual ran. B reported: "no new messages." The operator — me — read B's report and was puzzled. A said it delivered. B said nothing arrived.

The intention-first instinct is to re-run the delivery, or to ask both agents to "try again." The pattern-first instinct is to look at the filesystem.

```bash
ls -la ψ/agents/B/inbox/
```

The directory was empty. So A's report of "delivered" was wrong — somewhere between writing the file and claiming delivery, the file had not actually landed. A deeper look at A's tool-call log showed the truth: A had written the file, but to the wrong path. Its intended destination was `ψ/agents/B/inbox/`. Its actual destination was `ψ/agents/b/inbox/` — a typo in a variable that created a new directory, lowercase, that didn't correspond to any agent at all.

No amount of re-asking A or B would have surfaced this. Both agents' narratives were internally consistent. The bytes on disk told a different story. The fix was five minutes, once the pattern was believed over the intentions.

This is the pattern-over-intentions principle in miniature. The agents were not lying. They were reporting the model's best reconstruction of what happened — which skipped over the exact detail that mattered. The filesystem was the only witness that saw the typo, and it told the truth in the shape of an empty directory.

## Retrospectives As Narrated Patterns — Not As Patterns

A subtle point worth making: the retrospectives an agent writes are themselves intentions, not patterns. They are the agent's narrated summary of a session. They are useful — chapter 11 depends on preserving them — but they are not the ground truth of what happened in that session.

The pattern-truth of a session is the tool-call log, the git commits, the file diffs, the mailbox mutations. The retrospective *points at* these patterns and adds interpretation. When you read a retrospective months later, read it with this framing: it is a *reading guide* for the evidence, not the evidence itself.

This matters when retrospectives disagree with patterns. If a retrospective says "shipped cleanly" but the git log shows a revert the next day, the pattern wins. Update your understanding from the log, not from the retro. The retro was written in good faith and got the big picture wrong — the bytes of the revert are the truer record.

Some teams get nervous about this — "are you saying retrospectives are unreliable?" No. Retrospectives are interpretive. The unreliability isn't a flaw; it's the nature of what a retrospective is. A retro without interpretation would just be a log. A retro *is* narration about a log. Narration is always lossy. Lose the narration or lose the log and you lose something; but if you had to pick, keep the log.

## A Quick Framework: The Two-Column Discipline

A simple practice that keeps patterns-over-intentions honest: when you (or your agent) make a claim, write it in two columns.

| Claim (intention) | Evidence (pattern) |
|---|---|
| shipped PR #N | link to the PR |
| fixed the retry bug | link to the commit |
| cleared the backlog | `ls inbox/` shows 0 files |

If you can't fill the right column, the left column is a hypothesis. The moment you refuse to ship claims that don't have evidence columns, you've built the patterns-over-intentions reflex into your daily practice.

This even works inside agent prompts. Ask the agent to report its work in the two-column form. The ones who can't populate the right column are the ones to double-check. The ones who habitually do become reliable collaborators.
