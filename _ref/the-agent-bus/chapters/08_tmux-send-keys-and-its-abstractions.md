# 8. `tmux send-keys` and Its Abstractions

Every higher-level agent-messaging tool you will build on top of tmux resolves, at the bottom, to one command:

```bash
tmux send-keys -t <target> <keys...>
```

That is the entire transport. Everything else is routing, naming, safety, and sugar. The moment you forget that, you will hit a bug you can't explain — because the abstraction you reached for is leaking, and the only way to stop the leak is to descend, temporarily, back to the primitive.

This chapter does two things. First, it teaches `send-keys` well enough that you can debug any wrapper built on top of it. Second, it argues for building the wrappers anyway — because "you *can* debug through the primitive" and "you *want* to use the primitive every day" are different sentences. The goal is a tool you reach for routinely and a primitive you can fall back on when the tool confuses you.

## What `send-keys` actually does

`tmux send-keys` writes bytes to the *stdin of the process running in a pane* — specifically, through the PTY's input side, which is how characters normally arrive when a human is typing.

That phrasing matters. `send-keys` is not "paste this string." It is "act as if a very fast, very obedient human typed this sequence of key events." Shells, REPLs, and readline-based programs receive those events exactly as if they had come from a keyboard. That means all the usual input behaviors apply: special characters are interpreted, shell metacharacters are dangerous if unquoted, `Enter` is a literal key you send separately, and there is no atomicity guarantee between one key and the next.

A minimal, correct invocation:

```bash
tmux send-keys -t %304 "echo hello" Enter
```

Three things are happening:

1. `-t %304` picks the target pane (by pane ID; see Chapter 7 for why pane IDs beat session:window.pane addresses in scripts).
2. `"echo hello"` is one argument. `send-keys` interprets its arguments as a sequence of key events. An argument like `"echo hello"` expands to the character sequence `e`, `c`, `h`, `o`, space, `h`, `e`, `l`, `l`, `o`.
3. `Enter` is a separate argument, and `send-keys` recognizes it as a key name, not literal text. Other key names: `Escape`, `Tab`, `BSpace`, `Space`, `C-c`, `M-x`.

Running this against a pane with a shell at a prompt: the shell sees `echo hello\n`, runs it, prints `hello`.

## The six gotchas, in the order you will hit them

### 1. Forgetting `Enter`

```bash
tmux send-keys -t %304 "echo hello"
```

No `Enter`, no submission. The text sits at the prompt, unsubmitted. You look at the pane and think your script did nothing — when in fact it did exactly half of what was asked.

This is the first lesson and the one you will re-learn the most: **`send-keys` does not submit**. It types. Submission is a separate keystroke, and you must send it explicitly.

Corollary: if you want to *not* submit (e.g., you're prefilling a command for a human to edit), leave `Enter` off on purpose.

### 2. Shell quoting collides with `send-keys` arguments

```bash
tmux send-keys -t %304 "echo 'hi there'" Enter
```

What gets typed is `echo 'hi there'`, which is fine. But:

```bash
MSG="Let's go"
tmux send-keys -t %304 "echo $MSG" Enter
```

The shell expands `$MSG` first, so `send-keys` receives `echo Let's go` as a single argument — and the shell inside the pane then sees `echo Let's go`, which is a syntax error because of the unclosed single quote. The bug is not in `send-keys`; the bug is that you had two shell contexts and didn't respect either.

Rule: when the payload contains anything that might confuse a shell, use literal mode.

### 3. Literal mode: `-l`

```bash
tmux send-keys -t %304 -l "$MSG"
tmux send-keys -t %304 Enter
```

With `-l`, `send-keys` treats the argument as raw characters with no key-name interpretation. `Enter`, `C-c`, `Escape` are all just the literal text "Enter", "C-c", "Escape". That is almost always what you want when you are forwarding a user-supplied message *and* you will send `Enter` separately.

The two-step dance — typed literally, then `Enter` — is the pattern that survives arbitrary payloads. It is also the pattern that `maw hey`, the wrapper we'll introduce below, uses internally.

### 4. Speed and interleaving

`send-keys` dumps its bytes into the PTY as fast as the kernel will take them. For a shell at a blank prompt, this is fine — the shell buffers input and processes it when line-complete. But for *some* consumers, especially programs with their own line discipline or slow startup, back-to-back `send-keys` calls can interleave unpleasantly.

```bash
tmux send-keys -t %304 "first command" Enter
tmux send-keys -t %304 "second command" Enter
```

If the pane is a `claude` REPL that hasn't printed its new prompt yet, the second line might arrive before the first one has been accepted. The symptoms range from "nothing happens" to "both commands concatenate on one prompt line." The fix is not to tune tmux — it's to either wait for a prompt indicator (`tmux capture-pane -t %304 -p` and scan for your prompt string) or to let the wrapper handle pacing.

Most of the time you don't need to care. But when a fast script misbehaves and a slow human-typed repro works, interleaving is the suspect.

### 5. The pane ID can disappear

```bash
tmux send-keys -t %304 "echo hi" Enter
# tmux: can't find pane: %304
```

The process exited. Or the user closed the pane. Or the machine rebooted. The pane ID was valid when you captured it; it is not now. A robust wrapper always re-resolves the target before sending, and distinguishes between "pane doesn't exist" (don't retry, agent is gone) and "pane is busy" (maybe retry).

### 6. Sending a multi-line payload

```bash
tmux send-keys -t %304 "line one
line two" Enter
```

Each newline in the payload is interpreted as `Enter` — which means `line one` is submitted, then `line two` is typed and `Enter` submits it. This may be what you want for pasting a script into a shell; it is almost never what you want when sending a message to an interactive agent that expects one submission per message.

For a single "message with line breaks" semantic, you have two options:

- Encode the payload so the receiver sees literal newlines as a separator it interprets (e.g., `\n` two-character sequence).
- Use a higher-level transport (a file, a JSON inbox — see Part II) and have `send-keys` merely wake the receiver.

The general lesson: `send-keys` has no opinion about what a "message" is. It sends keystrokes. Anything higher-level is your convention.

## The `capture-pane` companion

`send-keys` is half the conversation. The other half is `tmux capture-pane`, which reads what the pane contains.

```bash
tmux capture-pane -t %304 -p          # current visible screen
tmux capture-pane -t %304 -p -S -200  # current + 200 lines of scrollback
tmux capture-pane -t %304 -p -S -     # entire scrollback
```

`capture-pane` is how you verify that `send-keys` did what you expected, how you scrape an agent's response, and how a polling harness checks for completion strings. Its output is lossy (ANSI color codes are stripped by default, line wrapping is as-rendered not as-logically-structured), but for human-readable agent output that's usually fine.

The two together — `send-keys` to write, `capture-pane` to read — are a full-duplex wire. Slow, text-shaped, and in many ways perfect for an agent that already speaks text natively.

## Why you build the wrapper

Given the primitive works, why wrap it?

Because the bare `send-keys` invocation, in a real multi-agent system, is **almost never what you actually want**. What you want is:

- "Send this message to the agent named `research`" — not "`send-keys -t %304 -l 'msg' \; send-keys -t %304 Enter`."
- "Find the right pane regardless of which session it currently lives in" — not "look up `research` in my head, find its session:window.pane, paste it into the command."
- "Send to an agent on the yellow node" — not "SSH to yellow, resolve the pane, send-keys there, disconnect."
- "Don't crash if the agent isn't running; tell me so."
- "Log what I sent so I can audit later."
- "Respect literal mode for every payload, always, because I will forget and someone's payload will contain a backtick."

The live system this book draws from expresses all of that as a single command:

```bash
maw hey research "run the sweep on 2026-04-13 logs"
```

Underneath, `maw hey` does approximately this:

1. Resolve `research` to a pane address via a contacts registry (`~/.claude/teams/<team>/contacts.json` or similar).
2. If the address is a `node:agent` federated form, SSH to the node and run the local form there. (See Part IV.)
3. Locate the pane ID for the agent on the target node.
4. Check the pane is alive (`tmux list-panes -t %N`).
5. `tmux send-keys -t %N -l "<message>"` with literal mode.
6. `tmux send-keys -t %N Enter`.
7. Optionally log the send to a transcript file.
8. Return an exit code: 0 for delivered, non-zero with a reason for not-delivered.

Eight steps, one command. And because it is one command, you use it — which is the point. A wrapper that is slightly harder to type than the primitive it wraps will not be used.

## Why the wrapper does not replace the primitive

The temptation is to hide `send-keys` entirely once `maw hey` works. Resist.

When `maw hey research "test"` produces unexpected behavior — say, the message arrives but nothing happens, or it arrives garbled, or it doesn't arrive at all — the debugging path is always the same:

1. Reproduce with `maw hey`. Confirm the failure mode.
2. Find the pane ID the wrapper resolved. (`maw hey --dry-run` or equivalent.)
3. Try `tmux send-keys -t %N -l "test"` and `tmux send-keys -t %N Enter` by hand.
4. If the primitive works, the wrapper has a bug.
5. If the primitive fails too, the pane has a bug (wrong process, wedged, exited).
6. If the primitive can't even find the pane, the contacts registry is stale.

Every step here requires knowing `send-keys` at the level the first half of this chapter taught. If you only know the wrapper, you debug blind. If you only know the primitive, you will refuse to use the wrapper (because typing raw `send-keys` for every interaction is friction you will not sustain). You need both — the wrapper for daily use, the primitive for diagnosis.

Hence the chapter's title. The abstractions are plural because `send-keys` deserves several of them:

- A **naming layer** (`maw hey research` → pane ID).
- A **transport layer** (local tmux, or SSH + remote tmux).
- A **safety layer** (literal mode always, explicit `Enter`, existence check).
- A **logging layer** (what was sent, when, to whom, did it deliver).

Each is small. Each is worth writing. None is interesting enough to be a framework.

## A minimal wrapper, to make this concrete

Here is what a 40-line `maw-hey` shell wrapper can look like for the single-node case. (Federation extends it in Part IV.)

```bash
#!/usr/bin/env bash
set -euo pipefail

TARGET="$1"
shift
MSG="$*"

CONTACTS="${MAW_CONTACTS:-$HOME/.maw/contacts.json}"

# 1. Resolve name to pane address (session:window.pane)
ADDR=$(jq -r --arg name "$TARGET" '.[$name].pane // empty' "$CONTACTS")
if [[ -z "$ADDR" ]]; then
  echo "maw hey: no contact named '$TARGET'" >&2
  exit 2
fi

# 2. Resolve session:window.pane to %N (stable, immutable for the life of the pane)
PANE_ID=$(tmux list-panes -t "$ADDR" -F '#{pane_id}' 2>/dev/null | head -n1)
if [[ -z "$PANE_ID" ]]; then
  echo "maw hey: pane for '$TARGET' ($ADDR) not found" >&2
  exit 3
fi

# 3. Send: literal payload, then Enter
tmux send-keys -t "$PANE_ID" -l -- "$MSG"
tmux send-keys -t "$PANE_ID" Enter

# 4. Log
mkdir -p "$HOME/.maw/log"
printf '%s\t%s\t%s\t%s\n' "$(date -Iseconds)" "$TARGET" "$PANE_ID" "$MSG" \
  >> "$HOME/.maw/log/hey.tsv"
```

Forty lines, give or take. It handles: naming, literal-mode safety, explicit `Enter`, pane-existence check, and audit logging. If you read it end-to-end, you will notice that almost every line corresponds to a gotcha earlier in this chapter. That is not accidental. The wrapper's job is exactly to pay, once and permanently, for the lessons the primitive will otherwise teach you repeatedly.

## Observability: logging every send

A working wrapper logs. Always. The ten extra lines to append a TSV record per send are the cheapest forensics you will ever buy.

When something goes wrong — an agent didn't respond, a message arrived garbled, a decision was made based on a report that never got sent — the log tells you whether `maw hey` was even called, when, with what payload, to which pane. Without the log, you are guessing from symptoms. With it, you are reading a transcript.

A minimal send-log schema:

```
<iso-timestamp>\t<target-name>\t<pane-id>\t<exit-code>\t<message-hash>
```

(Hash the payload rather than logging it in full if the content may be sensitive; a 12-character truncated SHA is enough to correlate with the receiver-side scrollback.)

The corresponding receive-side forensics is `tmux capture-pane -p -S -`, which reads the full scrollback of a pane. Between the sender's TSV and the receiver's scrollback, any "did my message arrive?" question becomes answerable in under a minute. This is the kind of observability that distributed message queues charge you real money for. Here it's three `printf`s and a `tmux` call.

## Cross-node sending, previewed

Chapter 10 covers federation in depth, but the wrapper sketch above has an obvious extension. Suppose the target is `yellow:research` rather than just `research`. The wrapper splits on the colon, sees `yellow` is a node name, looks up `yellow`'s SSH destination, and runs the local-form `maw hey research "..."` *on yellow* via SSH:

```bash
if [[ "$TARGET" == *:* ]]; then
  NODE="${TARGET%%:*}"
  LOCAL="${TARGET#*:}"
  SSH_DEST=$(jq -r --arg n "$NODE" '.[$n].ssh // empty' "$NODES_JSON")
  exec ssh "$SSH_DEST" maw hey "$LOCAL" "$MSG"
fi
```

Five lines added to the wrapper, and the same command now works across machines. The underlying transport is still `tmux send-keys`, only now the send happens on the remote side of an SSH connection. Layered abstractions, one primitive.

That's what we mean by the wrapper being plural. It's not one wrapper; it's a stack of small ones — name resolution, transport, federation, safety, logging — each thin, each readable, each testable on its own. None of them deserve to be called a framework. Together, they are the agent bus at tier 3.

## The literal-mode decision, once and for all

If you take one rule away from this chapter, take this one:

> **Always use `-l` and always send `Enter` separately.**

The one-argument-is-both-payload-and-submission form of `send-keys` is convenient for interactive debugging and dangerous everywhere else. In scripts, wrappers, and any piece of infrastructure that handles messages you did not personally write, the two-step literal pattern is the only pattern that survives payloads containing backticks, dollar signs, newlines, quotes, or key names that tmux would otherwise interpret.

Yes, it costs an extra tmux invocation per send. No, that is not a measurable performance concern. Agents talk slowly. Your bottleneck is the LLM, not `tmux(1)`.

## What this buys you

By the end of this chapter, a working multi-agent system has a transport layer that is:

- **Observable.** Every send is a `send-keys` invocation and can be traced.
- **Debuggable.** The wrapper's behavior reduces to two `send-keys` calls; run them by hand when the wrapper fails.
- **Composable.** Anything that can produce a line of text (a cron job, a webhook handler, a script, another agent) can talk to any pane.
- **Honest.** The abstraction does not lie about what's underneath. There's no protocol, no encoding, no handshake — just keystrokes.

That honesty is the point. It is why the next chapter, on `claude -p`, can stay equally concrete: a fire-and-forget agent invocation, sent into a pane with `send-keys`, reporting completion back through another `send-keys`. The whole runtime is a handful of subprocesses exchanging typed lines. Simple enough to fit in your head. Complex enough to run a team.

## A field guide to failures

Because this chapter is also meant to be useful the next time something breaks, here is a compressed checklist you can consult when `maw hey` (or its equivalent) misbehaves.

| Symptom                                     | Likely cause                                    | Next step                                        |
|---------------------------------------------|-------------------------------------------------|--------------------------------------------------|
| Nothing happened in the pane                | No `Enter` sent                                 | Verify wrapper sends `Enter` as a second call    |
| Command typed but not submitted             | Pane was busy at input moment                   | Capture-pane to confirm; consider pacing         |
| Payload garbled (syntax errors in target)   | Literal mode not used                           | Switch to `send-keys -l`                         |
| "can't find pane: %N"                       | Pane exited or ID stale                         | Re-resolve from contacts and retry once          |
| "can't find pane: research:0.0"             | Session renamed / reordered                     | Script against `%N`, not human address           |
| Message arrived on wrong pane               | Contacts registry points to a recycled `%N`     | Contacts must be rewritten when agents respawn   |
| Works locally, fails over SSH               | Remote shell has no tmux on path                | Use full path or a known-env login shell         |
| Works one call, fails in a tight loop       | Two sends interleaved before the reader consumed| Add a capture-pane wait or a small sleep         |

Most real incidents fall into two or three of these cells. Having the table in your head — or pasted into the wrapper's `--help` — shortens a ten-minute puzzle into a thirty-second check.
