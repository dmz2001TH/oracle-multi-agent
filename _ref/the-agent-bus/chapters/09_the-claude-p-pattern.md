# 9. The `claude -p` Pattern

There is a long-running agent. It has a pane, a PID, a conversation history, a name. Chapter 7 called it the cell of the agent runtime.

There is also a different kind of agent. It comes into existence to do one thing. It does the thing. It tells someone. It exits. It has a pane briefly, a PID briefly, and no history anyone will ever look at again. It is a visitor, not a resident.

This chapter is about the visitor.

The concrete primitive is `claude -p "<prompt>"` — Anthropic's CLI in non-interactive mode. It starts, it consumes the prompt, it produces output, it exits. Zero ceremony. But the pattern is larger than the flag: any LLM CLI with a fire-and-forget mode slots into the same slot. Ollama, llm, aichat, gemini, local inference wrappers — if the CLI takes a prompt as argv or stdin and writes a response to stdout before terminating, it implements the pattern.

The pattern's shape is the interesting thing. Once you see it, you stop trying to keep transient agents alive and start sending them to do their job.

## Fire-and-forget as a first-class mode

Interactive agents — the kind you attach to in tmux and talk to — are great for open-ended work where you don't know the next question until you see the last answer. They are expensive for work where you *do* know the next question: "summarize this log," "classify these tickets," "draft a changelog from this diff range."

For that class of work, there are three things you don't want:

1. **A long-lived process.** It ties up memory, a pane slot, a place in your mental model of what's running.
2. **An attach/detach ritual.** You don't need to watch it. You just need the answer.
3. **A conversation history.** One prompt, one answer, no thread.

`claude -p` removes all three:

```bash
$ claude -p "in two bullets, what changed in git log -5?"
- Added RTK token-optimized commands to CLAUDE.md.
- Documented the BUS-P3 assignment for the book expansion team.
$
```

Process starts, prompt sent, answer printed, process exits. `echo $?` is 0. No residue. Ready to be piped, redirected, backgrounded, or embedded in a script.

This is the primitive. The pattern is what you wrap around it.

## Spawning a transient agent from a parent

The most common use: a long-running "parent" agent in a pane decides a sub-task is worth delegating, spawns a short-lived "child" to do it, and wants to be told when the child is done.

```
parent (in pane %304)
   │
   ├─ spawns: claude -p "do X; when done: maw hey parent 'X done'"
   │
   └─ (continues doing other work)
```

That `claude -p` invocation runs in the background, consumes some tokens, produces some output, and at the end — because you told it to in the prompt — calls `maw hey parent 'X done'`, which delivers a message back to `%304`'s pane. The parent sees the message in its scrollback and responds to it (possibly by waking up, possibly by logging it, possibly by spawning another child).

The mechanics are two shell commands, assuming the parent has a `maw wake` wrapper:

```bash
maw wake scout "survey the 2026-04 retrospective files and maw hey parent with 3 bullet points"
```

Under the hood, `maw wake` does roughly:

1. Compose the full prompt, including the "report via `maw hey parent` when done" clause.
2. Pick a name for the child (`scout`).
3. Either:
   - **(a) Run detached**: `nohup claude -p "$PROMPT" > ~/.maw/children/scout.log 2>&1 &`
   - **(b) Run in a new pane**: `tmux new-window -d -n scout "claude -p '$PROMPT'"`
4. Return immediately. The child is someone else's problem now.

Variant (b) is preferable in practice. A pane is observable (you can `tmux capture-pane` it mid-run, which (a) makes hard). A pane auto-cleans when the process exits (which (a) also does, but you lose the scrollback). A pane shows up in `tmux list-panes` so you can count what's running without grepping ps.

The net effect: from the parent's perspective, `maw wake scout "task"` is indistinguishable from a `setTimeout` that takes a few seconds to a few minutes and eventually posts a message. It's async. It's ergonomic. It is, underneath, a subprocess spawning a subprocess and exchanging two lines of text.

## The prompt is the contract

Now the critical point. When you spawn a long-lived agent in a pane, you can talk to it after the fact. You can prompt it, it will reply, you can correct, it will adjust. The conversation is the contract, and the contract is continuous.

When you spawn a `claude -p`, you cannot. The process will exit before you have a chance to send a follow-up. You cannot say "wait, also do Y" once it's running. You cannot say "nevermind" once it's running. You cannot ask for clarification, because there is no one at the other end to clarify to.

Therefore:

> **The prompt is the only contract.**

Everything the child needs to know must be in the initial prompt. Everything the child needs to do on completion — including how to report — must be in the initial prompt. Everything the child needs to do on *failure* must also be in the initial prompt, because there is no one to catch the exception.

A useful prompt for a fire-and-forget agent has this shape:

```
ROLE: <what you are>
TASK: <what to do>
INPUTS: <files, data, context>
OUTPUT: <where the result goes, and in what shape>
REPORTING: when done, run: maw hey <parent> "<format>"
ON FAILURE: if you cannot do the task, run: maw hey <parent> "FAILED: <reason>"
```

Six sections. Every one matters. The third and fourth are familiar from any task definition. The fifth and sixth are the ones people forget — because in a long-running agent, reporting is implicit (you'll just see what it said), and failure is implicit (you'll just see the error). In fire-and-forget, both must be explicit, because there is no ambient observer.

In practice, the prompt template in the live maw system looks approximately like this:

```
You are <name>, a transient agent spawned by <parent> on node <node>.
Your task is: <task>.

Working directory: <path>
Relevant files: <list>

When complete, send your result back by running:
  maw hey <parent> "DONE: <one-line summary>. Details: <short body>"

If you cannot complete the task, run:
  maw hey <parent> "FAILED: <one-line reason>"

Do not ask questions. You have no one to ask.
Do the best work you can with the information above.
```

That last line — "Do not ask questions. You have no one to ask" — is the most important sentence in the prompt. It overrides the LLM's natural tendency to request clarification. In an interactive session, asking for clarification is good behavior. In a fire-and-forget spawn, asking is a dead-letter: the question goes into stdout that no one reads, and the process exits, and the work never happens. You must tell the model, explicitly, that its brief is complete and it must proceed.

## Why the reporting-back channel is `maw hey`, not stdout

A fire-and-forget agent has two possible return paths:

**Path A: return via stdout.** The parent captures `stdout` and reads the result.
**Path B: return via message-send.** The child runs `maw hey <parent>` at the end.

Path A is cleaner if the parent is happy to block on the child. But if the parent is another agent — another pane, another tmux-hosted process — blocking is the wrong model. The parent is alive, doing other work, and wants to be *notified* when the child is done, not *paused* until then.

Path B collapses to the tmux transport you already have. The child runs `maw hey parent "DONE: ..."`, which resolves to `tmux send-keys -t <parent-pane> -l "DONE: ..." ; send-keys Enter`, which shows up in the parent's scrollback exactly as if a human had typed it. The parent, if it is a `claude` REPL, interprets that line as a new user turn. If it is a shell, the shell tries to execute "DONE" as a command and fails harmlessly (log it if you care). If it is a polling loop reading scrollback, the loop picks up the line and dispatches.

The point: the return channel is the same transport as every other agent message. There is no second protocol. This is the whole thesis of the book at small scale — four tiers, one substrate — here expressed in one interaction.

## Concrete example: a sweep delegated to a child

A long-running orchestrator wants to survey a directory of retrospective notes and get back three bullet points. The orchestrator itself is busy with other work.

```bash
# In the orchestrator's shell (or issued via maw hey to a shell-pane):
maw wake scout '
You are scout, a transient agent spawned by orchestrator.
Survey the retrospective markdown files in ~/mawjs-oracle/ψ/memory/retrospectives/2026-04/
and produce three bullet points summarizing the dominant themes.

When complete, run:
  maw hey orchestrator "SCOUT_DONE: <bullet 1> | <bullet 2> | <bullet 3>"

If you cannot complete (no files, permission error, etc.), run:
  maw hey orchestrator "SCOUT_FAILED: <reason>"

Do not ask questions. Produce your best summary with what you can read.
'
```

What happens:

1. `maw wake` builds the prompt above, spawns `claude -p` in a new tmux window named `scout`.
2. The orchestrator returns to whatever else it was doing.
3. A minute or two later, `scout` finishes reading files and composing its summary.
4. Its final step — because the prompt demanded it — is to run `maw hey orchestrator "SCOUT_DONE: ..."`.
5. `maw hey` sends that string as keystrokes into the orchestrator's pane.
6. The orchestrator's pane contains a new line: `SCOUT_DONE: <bullets>`.
7. The orchestrator (a `claude` REPL) treats that as a fresh user turn and responds to it — or a polling harness detects the `SCOUT_DONE:` prefix and acts programmatically.
8. `scout`'s `claude -p` process exits. Its pane closes. The window disappears.

Eight steps. No message broker. No webhook. No hosted anything. Two shell wrappers (`maw wake`, `maw hey`), one tmux server, one LLM CLI. The orchestrator got its bullets.

## When fire-and-forget is wrong

Not every sub-task fits the pattern. `claude -p` is a poor fit when:

- **The task needs iteration with a human.** If the child will produce a draft that a human will react to and the reaction will change the next step, you want an interactive pane, not a one-shot. Use `maw wake` with `claude` (interactive) instead of `claude -p`.
- **The task is long enough that you want partial progress.** A 30-minute task dumped into `claude -p` produces nothing until it's done (or fails). If you want to see progress, give it a pane and let it print as it goes.
- **The task must produce machine-readable structured output.** `claude -p` can do this, but errors are harder to recover from — if the model returns malformed JSON, you have no chance to correct mid-flight. For structured output in a one-shot context, pair the invocation with a parse-and-validate step, and include "if parse fails, re-emit in valid shape" logic in the calling script.
- **The task has ambiguous scope.** If the prompt requires judgment calls the model might reasonably escalate, fire-and-forget will suppress the escalation and produce something plausible-but-wrong. Add a pane, attach to it, talk.

The rule of thumb: `claude -p` is right when the task description is complete and the success criterion is unambiguous. That's a narrower window than you'd think. But for summarization, classification, extraction, mechanical transformation, and any "take this and produce that" shape, it's perfect.

## The `-p` prompt is larger than you think

New users often underestimate how much *prose* belongs inside the `-p` prompt. Since the prompt is the whole contract, skimping on it saves tokens and costs correctness.

A robust `-p` prompt includes:

- **Identity.** "You are `<name>`, a transient agent …" — the model uses this to adjust tone and scope.
- **The parent's expectation.** "…spawned by `<parent>`." — the model understands it's in a pipeline, not a standalone conversation.
- **Environment facts.** Which directory it's in. Which files exist. Which machine. What "today" is. (The model does not know unless you tell it.)
- **The task.** The actual ask.
- **Output contract.** Not just "summarize" but "summarize in three bullets, each under 12 words, prefixed with `SCOUT_DONE:`".
- **Reporting contract.** The exact command to run at the end, including quoting that will survive shell expansion.
- **Failure contract.** What to do if the task cannot be completed.
- **The "don't ask" clause.** Explicit instruction to proceed without clarification.

That is several hundred tokens of prompt before you even describe the task. It feels heavy. It is also the reason the pattern works — the weight of the prompt is the reason the process can exit and still deliver.

## Patterns that compose naturally

Once `maw wake`/`claude -p` is a habit, a few compositions show up on their own.

**Fan-out.** A parent spawns N children in parallel, each handling one slice of a larger task. Each child reports `CHILD_DONE: <slice-id> <result>` to the parent. The parent is a polling harness (see Part II) that waits until it has heard from all N and then composes the final answer. The whole thing is a for-loop plus a counter.

```bash
for slice in a b c d; do
  maw wake "scout-$slice" "process slice $slice; maw hey parent \"DONE: $slice <result>\""
done
```

Four subprocesses, one parent pane, one shared outbound channel. Reducing tasks like "summarize these 40 documents" to "40 `claude -p` invocations and a merge step" is often the right instinct.

**Pipelines.** A `claude -p` that does step one, pipes its output into a `claude -p` that does step two, pipes into a third. Each step is a prompt; the composition is a shell pipeline. Unix was built for this shape, and `claude -p`'s stdout/stdin contract means it drops in cleanly:

```bash
claude -p "extract author names from $FILE" \
  | claude -p "deduplicate and normalize this author list" \
  | claude -p "sort these authors by last name, one per line"
```

Three independent model calls, zero state, exit codes propagate via `set -o pipefail`. This is not revolutionary — it's just what happens when you treat an LLM invocation as a filter.

**Retries and timeouts.** Because the process really does exit, timeouts are trivial via `timeout(1)`, and retries are trivial via a `for` loop. You cannot timeout an interactive agent the same way; you can absolutely timeout `claude -p`.

```bash
for i in 1 2 3; do
  if timeout 120 claude -p "$PROMPT" > result.txt; then
    break
  fi
  sleep $((i * 5))
done
```

Three tries, each capped at two minutes, with a small backoff between attempts. Standard shell idioms. No framework required.

## The thing you'll want to build next

After a week of using `claude -p` this way, the next feature you'll want is a small **spawner** that:

1. Accepts a short invocation (`maw wake <name> "<task>"`).
2. Expands it into a full prompt using a template.
3. Picks a unique `<name>` if not supplied.
4. Records the spawn in a transient registry (pid, pane, start time).
5. Cleans the registry on exit.
6. Optionally times out and kills the child if it runs too long.

None of that is hard. All of it is worth doing once, properly, in one shell script. The live `maw wake` is about 80 lines. The template, the spawn, the registry, the timeout, the cleanup — each one is a few lines, and the whole is still something you can hold in your head.

This is the theme of the whole tmux + subprocess section. The runtime is small. The primitives are old. The pattern is new only because few people have bothered to name it.

## The takeaway

The fire-and-forget agent is not a lesser kind of agent. It is a *shape* — a short-lived subprocess whose whole job description, including how to report back, is compressed into its launch prompt.

Because the process will not live long enough to be asked anything, the prompt must contain all the answers in advance. Because the process will not be watched, the reporting must be explicit. Because the process will exit, its "goodbye" must be a side effect — a `maw hey` call to some other pane that *will* be alive to receive it.

Get those three things right — the complete brief, the explicit reporting, the outbound side-effect — and `claude -p` (or its equivalent in any LLM CLI you prefer) becomes the cheapest, most composable form of agent you can run. One process, one prompt, one answer, one goodbye. Stacked together, they form a swarm; watched from the outside, each one is still just a subprocess.

Which is the whole argument of this book, compressed into a single flag: **the agent bus is made of processes, and the smallest useful agent is the one that exits on purpose.**
