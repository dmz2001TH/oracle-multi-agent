# 7. Panes Are Processes

The quietest fact in multi-agent orchestration is this: you are already running one.

Open a terminal. Type `tmux`. Split the window. Now you have two shells, each a child of the same multiplexer, each addressable by a number, each persistent across your next SSH disconnect. Run `top` in one and `tail -f` in the other. Close your laptop lid, walk to a coffee shop, SSH back in, type `tmux attach`, and both are still running — because they were never bound to your terminal in the first place. They were bound to a daemon that owns them.

That daemon is an orchestrator. You just haven't been using it as one.

The rest of this chapter is an argument that you should. Because the moment you accept that a tmux pane is a subprocess, and that a subprocess can run `claude -p` or any LLM CLI, the "multi-agent runtime" problem you thought you had disappears. You don't need Kubernetes. You don't need a job scheduler. You need `tmux new-session`, a shell, and enough discipline not to fight the tool.

## What a pane actually is

A pane is not a tab. A pane is not a terminal window. A pane is a **pseudo-terminal device (PTY) plus a child process of the tmux server**, rendered into a rectangular region of screen real estate. The process doesn't know it's in a pane. As far as it's concerned, it's connected to a terminal exactly like any other. It can print, it can read input, it can be killed, it can exit. It has a PID. It has file descriptors. It has an environment. It has everything a subprocess has.

What it has that a subprocess does not have is an **address**.

```
$ tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} #{pane_id} #{pane_pid} #{pane_current_command}'
oracle:0.0 %0 284912 zsh
oracle:0.1 %1 284991 claude
oracle:1.0 %2 285044 vim
mawjs:0.0  %304 301188 node
```

Four columns matter:

1. **Session:window.pane** — the human address (`oracle:0.1`).
2. **Pane ID** — the immutable address (`%1`). Survives renames, survives reordering, only dies when the pane dies.
3. **Pane PID** — the actual OS process.
4. **Current command** — what's running inside right now.

The pane ID is the one that matters. Humans will rename sessions. Windows will reshuffle. Panes will swap positions. The `%N` never moves until the process exits. When you automate against tmux — and you will — you automate against `%N`.

## Why this is the hidden MVP

The GUI-first agent frameworks ask you to believe that orchestrating agents is a platform problem. A dashboard. A queue. A worker pool. A deploy step. An auth system. A storage layer. A SaaS subscription. They are mostly right about the primitives — they are mostly wrong about where those primitives live.

Here is what tmux already gives you, for free, on a laptop that cost less than a cloud orchestrator's monthly bill:

- **A supervision tree.** The tmux server is PID 1 for every pane. If a pane dies, you see it. If a pane hangs, you kill it. If the server dies, every pane dies with it — which, contrary to the instinct that this is a bug, is exactly the isolation guarantee you want from a runtime.
- **Persistence across disconnect.** The server is not your shell. Your SSH session is a client of the server. Disconnect and the server keeps running. Reconnect and everything is still there, scrolled back, running, waiting. Most "agent reliability" stories are, underneath, just "the process kept running while the human stepped away." Tmux gives you that for zero effort.
- **Addressability.** Every pane has a stable identifier. You can send text to it. You can read its scrollback. You can move it, resize it, link it to another window. Try to do that with a terminal tab in iTerm. You cannot — because the terminal tab is not a first-class object anywhere except in the UI.
- **Composability.** Panes nest in windows nest in sessions. Sessions can be shared between clients. Two humans can attach to the same session. Or one human and one script. Or zero humans and two scripts. The model does not care.
- **Scriptability.** `tmux list-panes`, `tmux send-keys`, `tmux capture-pane`, `tmux new-window` — every interactive action has a non-interactive equivalent. The CLI *is* the API. There is no second API you wish you had.

Take those five properties and squint. That is a multi-agent runtime. That is the thing the frameworks are selling you. The only reason you don't think of it that way is that tmux was designed in 2007 for system administrators who wanted to keep `irssi` running on a jumpbox, and nobody has bothered to rebrand it.

## The pane as the cell

In the Agent Bus model, a pane is the smallest unit of agent existence. Not a function call, not a container, not a process — a pane.

Why a pane and not just a process? Because a process without a pane has no I/O you can observe or influence. A daemon writing to a log file is invisible until you tail the file. A pane is a process *with a bidirectional wire attached*. You can send text in, you can read text out, and the sending and reading are the same abstraction whether the occupant is a shell, a REPL, an LLM CLI, or a Python interpreter waiting on `input()`.

Concretely, here is how the live system in this book's source material addresses agents:

```
white:oracle.0      → the oracle running in session "oracle" on node "white"
yellow:research.2   → the "research" agent's pane 2 on node "yellow"
colab:mawjs.0       → the maw-js process on the colab node
```

Each of those is a `<node>:<session>.<pane>` triple. Each resolves, on its node, to exactly one pane ID (`%304`, `%91`, `%12`), which resolves to exactly one PID, which resolves to exactly one running agent. No service registry. No DNS. No health check endpoint. The pane either exists or it doesn't, and `tmux list-panes -a` is the oracle.

This is important enough to state as a rule:

> **The pane is the address.** If the pane exists, the agent exists. If the agent exists, the pane exists. There is no third state.

When you violate this rule — by, say, letting an agent register itself in a JSON file and then not unregistering on exit — you invent the entire class of bug known as the "ghost agent." Whole chapters of agent frameworks are devoted to defending against ghost agents. The tmux approach sidesteps the category: tmux cleans up when the process exits, because the pane closes when the process exits, because the pane is the process.

## The four addresses of a pane

In practice you will refer to a pane four different ways depending on who is asking.

**1. The human address: `session:window.pane`**

```bash
tmux send-keys -t oracle:0.1 "ls" Enter
```

This is what you type when you're debugging. It reads. It's the one you memorize. Downside: it drifts when someone renames the session, and it is ambiguous if `oracle:0` has been swapped with `oracle:1`.

**2. The pane ID: `%N`**

```bash
tmux send-keys -t %304 "ls" Enter
```

This is what scripts use. It never drifts. It is opaque to humans. In a well-run agent system, scripts always resolve a human address to a `%N` *once*, then hold the `%N` for the rest of the operation.

```bash
PANE_ID=$(tmux list-panes -t oracle:0.1 -F '#{pane_id}')
tmux send-keys -t "$PANE_ID" "ls" Enter
```

**3. The PID**

```bash
$ tmux list-panes -t %304 -F '#{pane_pid}'
284991
```

This is what you use when tmux is not the problem. When the process is wedged, or hung in a syscall, or eating 400% CPU — you don't fight through tmux, you reach past it. `kill -TERM 284991`. `strace -p 284991`. The PID is the escape hatch back into the underlying OS.

**4. The federated address: `node:session.pane`**

Covered in depth in Part IV, but worth naming here: once you introduce WireGuard and a handful of peer nodes, the local pane address `oracle:0.1` needs a prefix to disambiguate it from the `oracle:0.1` pane on *another* machine. The convention this book uses throughout is `<node>:<agent>` — effectively a URL, where "node" is a WireGuard-routable hostname and "agent" is a local tmux address (or alias to one).

```
yellow:oracle     → oracle on the yellow node
white:research    → research agent on the white node
```

The local case is just `agent`; the federated case adds the `node:` prefix. Same underlying address space, widened by one field.

## Persistence: the quiet superpower

A freshly-spawned agent framework has to answer a question: *what happens when the human closes the laptop?*

The tmux answer is: nothing. Nothing happens. The session is owned by the tmux server, which is owned by init (or systemd, or launchd), which keeps running regardless of who is attached. The attach/detach cycle is a *separate concern* from the process lifetime. You can reconnect a week later — genuinely, a week — and the pane will still be there, mid-scrollback, mid-prompt, waiting.

This matters for agents in two specific ways.

**Long-running agent processes.** If your agent is a REPL (like `claude` or `python -i` or a custom Node shell), it will have in-memory state: loaded modules, open connections, a prompt history, a conversation buffer. You do not want to kill it every time you log off. Tmux persistence lets that state live as long as the agent needs it to.

**Observability after the fact.** Scrollback is free forensics. If an agent produced a puzzling output three hours ago and you weren't watching, you don't need a log aggregator — you have `tmux capture-pane -t %304 -p -S -3000` and 3000 lines of history. Free. No config. No schema.

The combination is why a tmux-based runtime often feels *less* fragile than a framework-based one, despite being made of plain shells. Frameworks trade away persistence for elegance. Tmux is inelegant. Tmux works.

## Sessions and windows, for completeness

A pane lives inside a window, which lives inside a session. These are not just organizational conveniences; they carry real operational weight.

A **session** is the unit that owns a detached state. When the tmux server keeps something "running in the background after SSH disconnect," the thing it keeps running is a session. You `tmux attach -t oracle` to a session. You `tmux kill-session -t oracle` to tear one down. A session without any attached client is the normal case — most of the time, your agent sessions should have zero attached clients, because you spawned them, set them going, and went back to doing other work.

A **window** is the unit of foreground focus within a session. A window can contain one pane (the default) or be split into multiple panes via `split-window`. Windows are cheap. In an agent-heavy workflow, the convention that often emerges is "one window per agent, one session per team" — so `team-research:scout.0`, `team-research:writer.0`, `team-research:reviewer.0` group naturally when you do attach to watch them.

A **client** is a connected terminal emulator. It is not a pane and not a process you orchestrate — it is the eyes of whoever is currently looking. Zero clients is fine. One client is typical. Two clients on the same session is how pair-programming-with-tmux works, and also how a human and a script can both watch the same agent at the same time.

The hierarchy maps onto agent-team language naturally:

| tmux concept | agent-team concept              |
|--------------|---------------------------------|
| Server       | The runtime daemon              |
| Session      | A team, or a long-lived project |
| Window       | A single agent's workspace      |
| Pane         | A running agent process         |
| Pane ID (`%N`) | The stable handle for the agent |
| Client       | A human (or bot) watching       |

You can work the whole system without ever learning the mapping. But when you reach for automation, the mapping is what makes the scripting obvious.

## What tmux is not

To be precise about what a pane gives you, be precise about what it does not.

- **A pane is not a sandbox.** Two panes in the same session share the same UID, the same filesystem, the same network. If you want isolation, you want a container, and tmux inside the container. Tmux's isolation story is "different process trees from the same user," which is good enough for local multi-agent work and not remotely good enough for running untrusted code.
- **A pane is not schedulable.** There is no CPU quota per pane. If one agent spins, the whole machine feels it. `nice` and `cgroups` still exist; use them outside tmux, not through it.
- **A pane is not replicated.** The pane lives on exactly one machine. If the machine goes down, so does the pane. Federation (Part IV) gives you peer panes on peer machines, which is not the same as replication.
- **A pane does not speak JSON.** The wire protocol is "bytes go in, bytes come out, mostly human-readable." If you want structure, you layer it yourself — which Chapter 8 is about.

None of these are objections. They are boundaries. Knowing where the boundary is lets you stop trying to make tmux be something else and start using it for what it is.

## The contrast with GUI-first frameworks

Most modern agent frameworks start from a different premise: *agents are web-app concepts, and their runtime is a browser tab plus a Node process plus a hosted database.* This is not wrong so much as it is a product category — an understandable one, because agents are easier to *sell* when they come with a dashboard.

But take a concrete comparison. The user wants to spawn three agents, give them a task each, see what they say back, and stop them when done.

**Framework-first path:** install the SDK. Get an API key. Configure the runtime. Spin up a web UI. Define the agent classes. Wire the message bus. Deploy to the cloud (or localhost, if you're lucky). Open the dashboard. Create three agents. Give them tasks through the dashboard's input field. Watch the messages stream through the web UI. Tear down via the dashboard's stop button. Pray the cleanup worked.

**Tmux-first path:**

```bash
tmux new-session -d -s team
tmux new-window -t team -n a "claude -p 'first task'"
tmux new-window -t team -n b "claude -p 'second task'"
tmux new-window -t team -n c "claude -p 'third task'"
tmux attach -t team
```

That's it. Three agents, three panes, three PIDs. Kill them with `tmux kill-session -t team` or just `Ctrl-C` each one. Logs are the scrollback. Addressing is `team:a.0`, `team:b.0`, `team:c.0`. If you reboot, they die; if you SSH out, they don't.

The second path isn't worse. It's just less sellable. No screenshots for the landing page.

## A small experiment you can do right now

If the argument of this chapter still feels abstract, here is a five-minute exercise that makes it physical.

1. `tmux new-session -d -s demo`
2. `tmux new-window -t demo -n counter "bash -c 'i=0; while true; do echo count=\$i; i=\$((i+1)); sleep 1; done'"`
3. `tmux list-panes -t demo -a -F '#{pane_id} #{pane_pid} #{pane_current_command}'`

You now have an "agent" (a counting bash loop) running in a pane you do not have to look at. Note the `%N` and PID.

4. Close your terminal entirely. Reopen a new one.
5. `tmux attach -t demo` — the counter is still ticking. You left; it did not.
6. `tmux send-keys -t %N "" C-c` — kill it. The pane closes because the process exited.

That sequence is the whole chapter, reduced to three commands. Persistence after disconnect, a stable handle, kill-by-sending-a-key, auto-cleanup on exit — every property a multi-agent runtime needs to have, demonstrated with a loop that counts.

Everything we build on top — named agents, federated addresses, a hey-wrapper, a wake-spawner, an inbox, a team — is elaboration on this core. The core itself is `tmux`, and it was already installed.

## Where this is going

The next two chapters take the pane-is-process insight and push on it.

Chapter 8 goes under the surface to `tmux send-keys` — the low-level primitive that is, in the end, the only way anything gets into a pane from outside. Understanding `send-keys` is how you debug every higher-level abstraction. When `maw hey agent "hi"` fails, the answer is almost always in what `send-keys` did or didn't do.

Chapter 9 goes the other direction, up to the pattern layer: `claude -p` — fire-and-forget LLM invocation — and why it pairs perfectly with the pane runtime for spawning transient, single-task agents. The pane is a long-lived home; `claude -p` is a short-lived visitor. The two together make a surprisingly complete runtime.

The takeaway of this chapter, though, is the one the next two depend on:

> Tmux is not a terminal multiplexer. Tmux is the multi-agent runtime you already have, with an interface optimized for humans and an API that happens to work for machines too. A pane is a process. A process can be an agent. An agent with a pane has an address, a supervisor, a scrollback, and a persistence story — and that is most of what a runtime needs to be.

Everything else in the tmux section is how to use the runtime you already have.
