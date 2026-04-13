# Chapter 6: Standing Orders and Persistent Context

> "An inbox is a conversation. A mailbox is a life."

---

## 6.1 The Day the Team Got Deleted

The first time I watched `TeamDelete` run, I understood a thing about multi-agent systems that I had not fully faced before.

A team had finished its work. Eight agents, maybe three hours of real coordination, a cluster of pull requests shipped, one clean retrospective. I ran the teardown. The runtime deleted `~/.claude/teams/<team>/` and everything under it — the config, the eight JSON inboxes, the full message log, the whole accumulated conversation. Gone. The filesystem did not care that the agents had traded a hundred messages getting aligned on an architectural decision. The filesystem deleted the directory because that is what it was asked to do.

And then the next day I spawned a new team with some of the same agent roles, and they did not remember any of it. Of course they didn't. There was no "they" — there were just new processes, reading empty inboxes, starting over. An agent whose memory lived only in the inbox had just died, as completely as a goldfish in a toilet bowl.

This chapter is about that. The inbox is a conversation. It is per-session, per-team, and it is supposed to be. But an agent that exists for more than one session needs a second store — one that outlives the team. This is the distinction between *context* (this session's state) and *memory* (this agent's knowledge). Conflating them is a surprisingly common mistake. Distinguishing them is most of what it takes to build agents that seem to persist across time.

The generic takeaway: per-session state is a cache; per-agent state is the real memory. Design both stores. Decide what goes where. Write the rituals that move state between them.

---

## 6.2 Two Timescales, Two Stores

Here is the framing that clicked for me. Every piece of state an agent touches belongs on one of two timescales:

- **Session timescale.** This conversation, this team, this task. Lives from spawn to teardown. Safe to discard when the team dissolves.
- **Agent timescale.** The knowledge, preferences, and identity that follow an agent across many spawns. Safe to discard only when the agent itself is retired.

You need a store for each. Conflating them means either your team is bloated with stale history (if you keep everything in the inbox forever) or your agent forgets its own standing preferences every Monday (if you let the session be the whole of memory).

In the system that shipped this book, the two stores are:

- **Session store.** `~/.claude/teams/<team>/inboxes/<agent>.json` — the subject of Chapters 4 and 5. JSON array, append on send, flat, ephemeral.
- **Agent store.** `ψ/memory/mailbox/<agent>/` — a directory of markdown files, one agent per subdirectory. Persistent. Indexed by convention, not code.

The directory listing for a live agent store tells you what goes in it:

```
ψ/memory/mailbox/scaffolder/
├── 2026-04-13_findings.md
└── standing-orders.md
```

Two kinds of files. `standing-orders.md` — a short, stable briefing that tells the agent what it is for. `YYYY-MM-DD_findings.md` — dated logs of what the agent learned during specific sessions. Both are markdown. Both are plain text. Both are indexable with `grep`. Neither is tied to the team that was running when they were written.

Let's walk through both.

---

## 6.3 Standing Orders: The Portable Briefing

A standing-orders file is the answer to "what does this agent need to know, every time it wakes up, regardless of what today's task is?" It is short. It is stable across sessions. It changes slowly, if at all, across weeks.

Here is a real one, untouched, from the `scaffolder` agent:

```
Validate plugin names strictly (lowercase, no digits-first, no spaces).
Bake ABSOLUTE SDK paths into generated Cargo.toml (not relative).
Always support --here flag for cwd scaffold.
Graceful error if template missing (e.g. AS SDK not yet built).
```

Four sentences. A few hundred bytes. Not a list of tasks — a list of invariants. Things the agent should treat as non-negotiable whenever it is asked to do scaffolding work. An operator wrote them. Future instances of `scaffolder` inherit them.

Three properties make a good standing-orders file:

**It is written in the imperative.** "Validate names strictly." Not "the agent should validate names." Not "names are validated." The document is a direct instruction to whoever is loading it — if that happens to be a language model running as an agent, it will treat the instruction as an instruction. If it is a human operator reviewing, they will read it the same way.

**It is specific but not exhaustive.** Four rules, not forty. The rules cover the decisions that have burned the agent before — the scaffolder's orders name the exact fields (`Cargo.toml` paths must be absolute) that caused the bug a month ago. The rules do not try to teach the agent its whole craft. That would not fit, and if it did, the model would not follow it under a prompt budget.

**It is boring to update.** You edit it when an invariant genuinely changes. Not when the task of the day changes. If you find yourself updating the standing orders every session, the content belongs somewhere else — probably in the task description, or in the findings log.

The generic pattern: a plain-text briefing, stored at a path that depends only on agent identity, that the agent pre-loads at spawn. That is all a standing-orders file is. The format is less important than the fact that it exists and is the first thing loaded.

---

## 6.4 The Findings Log

Standing orders are stable. Findings are what happened.

```
## 2026-04-13 maw plugin create shipped
**Time**: 2026-04-13T07:16:31Z

20 tests passing. Files: src/commands/plugin-create.ts, wired into
src/cli/route-tools.ts cmd === 'plugin' dispatch (lines 145-162).
Supports --rust/--as/--here/--dest. Cargo.toml rewrite swaps
path='../../maw-plugin-sdk' to absolute path at scaffold time.
AS template at examples/hello-as/ — if missing, throws with 'maw update' hint.
```

One session, one entry. Dated header, absolute timestamp inside, a dense paragraph of what was done and where to find it. No ceremony. No pretty template. The entry is what the future version of this agent will want to find when it is asked to reason about its own past work.

The structure that emerged by use:

- **One file per day, appending entries** — `2026-04-13_findings.md` — so that a day's work is co-located and a week's work is at most seven files to skim.
- **`##` header per entry**, phrased as a result, not a task. "Migration shipped" is useful. "Migration work" is not.
- **Absolute timestamp inside the body**, so you can reconstruct a timeline even if filenames have been normalized.
- **Concrete references**: file paths with line numbers, exact flag names, real counts ("20 tests passing"). This is the stuff a later agent can actually act on.
- **No long prose.** A findings entry is a field note. The goal is that a future instance reading it for the first time in three weeks can orient in twenty seconds.

The thing a findings log is *not*: a diary of the session. If you want session-level prose, put it in a retrospective file elsewhere. The findings log should be consultable, dense, and dull.

---

## 6.5 The Preload Ritual

The stores are static files on disk. The agents are processes that spawn and read. The thing that connects the two is a ritual — a fixed sequence run at the start of every session.

The ritual Claude Code uses looks roughly like this, in pseudo-code:

```
on agent_spawn(name):
  prompt = render_system_prompt(name)
  for file in sorted(list("ψ/memory/mailbox/{name}/*.md")):
    prompt += read(file)
  deliver_prompt(prompt)
```

Two things to notice. First, every file in the agent's mailbox gets concatenated into the prompt. That is the preload. The standing orders come along. So does every findings file that happens to be there. Second, the order is deterministic — sorted by filename — so the same agent with the same on-disk state always wakes up to the same prompt. Determinism is how you keep the system debuggable.

There is a real cost. Every file in the mailbox is tokens in the prompt. If you let the mailbox grow without limit, the agent spends more of its context window reading its own history than doing today's work. Two mitigations:

**Cap the findings log retention.** Keep the last N days, or the last M bytes, and archive the rest into `ψ/memory/archive/<agent>/`. The archive is still on disk and grep-able; it just doesn't auto-load into the prompt. This is the same move that makes long-lived human knowledge bases tractable — the recent stuff is at hand, the old stuff is searchable.

**Summarize.** Periodically — weekly works well — have the agent read its own findings and condense them into a single `long-memory.md` file that replaces the raw entries. The raw entries go to archive. The summary loads into future prompts. This is lossy by design; it trades precision for token budget. Standing orders are preserved untouched because they are the stable parts.

For a small agent with a few weeks of findings, neither mitigation is needed. The whole mailbox fits in a few thousand tokens and loads in one shot. The mitigations matter when the agent has been around for months and the findings log is the largest thing about it.

---

## 6.6 The Archive Ritual

The symmetric operation is shutdown. When a team dissolves, the inbox goes away — but before it goes away, you have a chance to copy what was valuable out of it and into the agent's own mailbox.

In Claude Code, this looks like:

```
on team_delete(team):
  for agent in team.members:
    findings = extract_findings_from_inbox(agent)
    if findings:
      append_to_file(f"ψ/memory/mailbox/{agent.name}/{today}_findings.md",
                     findings)
  rm -rf ~/.claude/teams/{team}
```

It is a hook into the teardown. The runtime looks at what the agent said it discovered, writes those discoveries into the agent's persistent mailbox, and then lets the team's inbox be destroyed.

What counts as "findings" is a judgment call. Claude Code uses a convention — agents tag important session outcomes with a special marker in their messages, something like `#findings:` or a specific SendMessage shape — and the archive step picks out the tagged ones. A human operator can also do this by hand, copying the important paragraph out of the inbox into the mailbox before running `TeamDelete`. Both work. Automation is nicer; the manual path is fine for low-volume systems.

The generic pattern is not specific to this tagging convention. It is: **the end of a session is a chance to promote session state to agent state**. If you do not take that chance, the state dies with the team. If you do, you turn a three-hour team's work into a line in the agent's permanent notes.

There is no equivalent of this ritual in, say, a pure microservice architecture. A microservice does not have session state to promote. Agents do, because agents are more like employees than like functions — they come in on Monday with yesterday's notes, they leave on Friday with today's additions to them.

---

## 6.7 What Belongs in Each Store

A rough rubric. Things that live in the session store:

- The current task description.
- In-flight messages between teammates.
- Pending approval requests, idle notifications, status pings.
- The current conversation history of each agent.
- Anything that will be irrelevant once this team dissolves.

Things that live in the agent store:

- The agent's standing orders — invariants it should always uphold.
- Dated findings from past sessions: what was learned, what was shipped, what went wrong.
- References to external systems the agent uses (URLs, file paths in project repos, etc.).
- Any identity-level configuration — the agent's voice, its color, its nicknames.
- Anything the agent would want to reread in three months.

Things that should *not* live in either:

- Secrets. Use a secret store. The mailbox is plaintext on disk, backed up, and grep-able — everything a secret should not be.
- Large artifacts. Don't put a binary or a multi-megabyte log in the mailbox. Store it in the project repo and put the path in the findings log.
- Anything the agent could derive faster by reading the project. "What is in `src/routes.ts`?" belongs in the project, not the mailbox. The mailbox is for things you cannot get back from code.

If you are uncertain about a piece of state, a good first question is: *would this matter to the next spawn of the same agent if it joined a different team?* If yes, agent store. If no, session store.

---

## 6.8 The Filesystem Is the Universal Agent Memory

Every detail in this chapter is implementation-flavored. Claude Code picked markdown; you could pick YAML or JSON. Claude Code picked `ψ/memory/mailbox/<agent>/`; you could pick any other rooted directory. Claude Code splits standing orders and findings into separate files; you could combine them.

None of that is essential. The essential parts are:

- **Per-agent storage** rooted at a stable, identity-derived path.
- **Plain text** that a human can open and grep.
- **Two kinds of content** — stable briefings and dated event logs — because those are different beasts.
- **A preload ritual at spawn** and an **archive ritual at teardown**.

These apply equally to an agent running in a Bun process, a Python script, or a Rust daemon. They apply equally whether the LLM is local, hosted, or an ensemble of models. They are not coupled to any framework. Run them on a filesystem and you have persistent agents; skip them and you have amnesiac agents.

The thing I believe most strongly is the second point: **plain text**. I have tried richer stores. A SQLite database was reliable and completely opaque — you could not debug a misbehaving agent by reading its memory without also writing a SQL query. A vector database was fashionable and introduced a whole second failure mode around embedding drift. A hierarchical YAML with schema validation was precise and required a tool to parse. In every case the cost of the richer store exceeded the value. Markdown in a directory has the one property that matters: you, the human operator, can open it, read it, and edit it. That property is worth more than any amount of structure.

---

## 6.9 Honest Failure Modes

The pattern is not flawless. Four failure modes worth naming, because I have walked into all of them.

**Mailbox bloat.** An agent that has been alive for six months and never archives has hundreds of findings files. The preload blows through its context window before it can do any real work. The fix is the archive-and-summarize cadence from §6.5; skip it and this is what you will hit.

**Write conflicts across sessions.** If two simultaneous teams both spawn the same agent, both sessions may try to append to `findings.md` at the same time. Rare, but not impossible. Lock or serialize writes per-agent; the simplest version is a single global runtime process that owns the mailbox and is the only thing that writes to it.

**Stale standing orders.** The scaffolder's orders say "bake absolute paths into `Cargo.toml`." Six months later the project refactored and absolute paths are wrong. The orders have not been updated. The agent cheerfully bakes absolute paths into every new scaffold, creating a migration problem. Standing orders need an owner. Someone has to review them on a cadence. Nothing in the filesystem forces this; it is a process thing.

**Trust failure between sessions.** An agent reads its own findings and treats them as ground truth even when they no longer are. "Yesterday I wrote that `src/routes.ts:45` has the handler" may have been true yesterday and untrue today. The mitigation is a line in the standing orders: *verify before acting on past findings*. It is not foolproof. But it shifts the default from "trust the log" to "check the code."

None of these failures break the pattern. They are the price of having a persistent memory at all. A stateless agent has none of them and also has no persistence. Pick your trade.

---

## 6.10 Back to the Team

We started this chapter with the day the team got deleted. Here is the end of that story.

The next team I spawned had the same agent roles — a scaffolder, a reviewer, a researcher, a writer. But this time, because I had set up `ψ/memory/mailbox/<agent>/` before the teardown, each agent woke up with its standing orders already in its prompt and yesterday's findings already archived. The new team's inbox started empty, as it should; the new team's work started with memory, as it should. The team was different. The agents — in a real, load-bearing sense — were the same.

That is the point of this chapter. A team is disposable. An agent, with the right storage pattern, is not. The inbox carries the conversation. The mailbox carries the life.

---

## Takeaways

- Inboxes are per-session and get destroyed with the team. Build a second, per-agent store so your agents survive team lifecycles.
- Two kinds of content belong in the agent store: **standing orders** (stable invariants) and **dated findings** (what happened).
- Use plain text on disk, rooted at a stable per-agent path. Grep and an editor are your debugger; don't give them up for a richer format unless you are forced to.
- Run a **preload ritual** at spawn — concatenate the agent's files into its initial prompt — and an **archive ritual** at teardown — promote session findings to agent-store entries.
- Bound the preload: cap retention, summarize old findings, archive the rest. A mailbox that grows unchecked drowns the agent.
- Mailbox state is trust-on-reread. Standing orders should say *verify before acting on past findings*, because the world drifts between sessions.
- Per-session state is a cache. Per-agent state is the real memory. Design both explicitly; do not let one silently swallow the other.

---

## Next Chapter

Chapters 4–6 covered the file-based mailbox: the minimum transport, the schema it carries, and the persistent store that outlives it. Part III moves up a tier. When agents need to talk to each other *while both are running*, not through a polled inbox, the substrate changes — panes in tmux become the shared runtime, and `tmux send-keys` becomes the underlying send primitive. Chapter 7 opens that story: panes are processes, and that single observation reframes tmux from "terminal multiplexer" into "multi-agent host."
