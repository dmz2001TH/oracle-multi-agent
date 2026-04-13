# 8. The Yeast Model of Agent Reproduction

> A new agent is not a copy. A new agent is a child.

---

## The wrong way: `cp -r`

The first time you spin up a second agent, you do the obvious thing. You have an agent that works. You want another one. So you copy it.

```bash
cp -r ./agents/writer ./agents/writer-2
sed -i 's/writer/writer-2/g' ./agents/writer-2/CLAUDE.md
```

Now you have two agents. Congratulations. You have also just broken every single thing that made the first agent useful.

The problem is not technical. The files copied cleanly. The problem is that `cp -r` is the wrong mental model for what you are actually doing. You are not duplicating a disk image. You are creating a second agent that has to coexist with the first — share a vault, read the same mailboxes, possibly pass work back and forth — and the `cp -r` approach gives you a perfect identical twin with none of the machinery to tell itself apart from its sibling.

Watch what breaks. The new agent writes a retrospective. Its retrospective file is named `writer-2_2026-04-13.md`, but the content inside says "I am writer, and today I finished the auth refactor" — because the pronoun "I" was written by the template and nobody touched it. The new agent answers a message addressed to `writer`, because both of them are subscribed to that mailbox. The new agent opens a PR and signs the commit with the old agent's name, because the git identity was copied too. Every lineage question — *who made this decision? which agent learned this lesson? whose retrospective is this?* — answers to the wrong name.

And the worst part: you cannot see any of this going wrong until the system has enough state that the confusion is expensive to unwind. By which point you have two agents with overlapping memory and no way to separate them.

`cp -r` is the naive answer. What you want is not a copy. What you want is a child.

---

## What biology already figured out

Yeast reproduces by budding. A parent cell grows a small protrusion, the bud. The bud inherits cytoplasm, organelles, and a copy of the genome. Eventually the bud pinches off and becomes its own cell — related to the parent, descended from it, but not the same cell. It has its own membrane, its own mitochondria, its own life from that point forward. If the parent dies, the child lives on. If the child does something stupid, the parent is not blamed for it.

This is almost exactly the right shape for agent reproduction.

- **Inheritance, not copy.** The child gets a subset of what the parent had — the useful parts, the durable parts. Not every scrap of in-flight state.
- **New identity from the moment of separation.** The child has its own name, its own address, its own accountability. Mail addressed to the parent does not get delivered to the child.
- **Lineage is preserved.** The child knows who its parent was. The parent knows it has a child. But neither confuses itself with the other.
- **Asymmetric reproduction.** The parent does not vanish. Yeast budding is not fission — it is not "two new cells from one." The parent continues, and a new child is added.

This last point is where most file-based "fork" approaches break down. They conflate the parent's continuation with the child's birth. A good bud does not disturb the parent. If I spawn a child agent from `writer`, `writer` should not have to restart, re-read its own identity, or wonder whether it has become something new. It was `writer` before the bud. It is still `writer` after. Only the child is new.

---

## What a child actually inherits

When a parent agent buds a child, the inheritance is selective. Not all of the parent's state should pass through. Think of it as three tiers.

### Tier 1: inherited wholesale (the genome)

Things that are *so* foundational that re-deriving them for every child would be wasteful, and that every agent in this lineage should share.

- **Principles.** If the parent follows "Nothing Is Deleted," so does the child. These are the house rules. You inherit the house.
- **Tooling conventions.** Which commands to prefer. Which wrappers exist. The CLAUDE.md boilerplate about RTK, about git hygiene, about commit signing — inherited.
- **Family identity.** The lineage name. In our worked example, every oracle budded from a root ancestor carries that ancestry in its own CLAUDE.md: `Budded from: neo`. The child knows its grandparent's house.

### Tier 2: inherited selectively (the starter culture)

Things the parent *might* pass down, but only if the child is going to need them. The bud gets a sample, not the whole cell.

- **A starter mailbox.** Optional. If the child is being spawned to take over a specific domain, it may inherit a handful of relevant messages — the open thread about caching, say, or the current plan for the UI refactor. It does not inherit the parent's entire inbox. Most of what's in the parent's inbox is not the child's problem.
- **Relevant retrospectives.** Not all of them. Maybe the last week, maybe none. The child is not the parent, and the parent's memory of "what happened last Tuesday" is not useful to a child born today.
- **Selected patterns.** If the parent has a proven pattern file — e.g., "how to handle a Telegram webhook retry" — and the child's domain involves Telegram, inherit the pattern. If not, leave it behind.

### Tier 3: not inherited (what must be fresh)

Some things the child *must* define for itself, because inheriting them would break the very distinctness that makes it a child and not a copy.

- **Name.** Non-negotiable. If the child shares a name with the parent, you have two cells answering to one identity and the system is broken by design.
- **Mailbox address.** The child has its own inbox from the first second of its life. Mail addressed to the parent does not automatically land here.
- **Retrospective log.** Starts empty. The child writes its own diary. It can *read* the parent's diary — that is what inheritance of filesystem access gives you — but it does not start by pretending the parent's diary is its own.
- **Git identity.** Distinct committer name, distinct signing identity. When the child ships code, the attribution is on the child, not the parent.
- **Purpose.** The child is typically spawned *because* the parent's scope grew too big. The child's purpose is therefore narrower than the parent's, and should be declared fresh, not copied.

The litmus test for whether something goes in Tier 1, 2, or 3 is simple: *if this were wrong, would the blame land on the parent or the child?* If the answer is "the child, obviously," then the child needs its own copy and the parent should not be on the hook. Name, mailbox, retrospective, git identity — all clearly Tier 3 by that test. Principles and tooling conventions — clearly Tier 1, because if the house rules were wrong, the parent set them.

---

## The worked example: `maw bud`

In the system this book is grounded in, agent budding is a single command.

```bash
maw bud mawjs --from neo
```

This creates a new agent named `mawjs`, budded from a parent named `neo`. Behind the scenes the command does a specific and deliberate set of things, and the shape of what it does is exactly the yeast model above:

1. **Allocate a new identity.** A fresh directory under the vault, with the child's name. Not a copy of the parent's directory — a new one.
2. **Write the child's CLAUDE.md.** It inherits the principles section verbatim (Tier 1). It includes a `Budded from: neo` line, which is how lineage survives the fork (see the next chapter). It leaves the `Purpose` field blank — the child will fill it in at awakening.
3. **Create an empty mailbox.** Own inbox, own outbox. No messages copied from the parent. If the parent wants the child to know something, it must send it — a message, not a memory transplant.
4. **Create an empty retrospectives folder.** The child's diary starts on day one. It can *read* `neo`'s retrospectives (same vault, same filesystem), but its own log is blank.
5. **Register the child in the family registry.** So the rest of the fleet knows `mawjs` exists, who its parent is, and how to reach it. Lineage is indexed, not just embedded.
6. **Nothing is done to the parent.** `neo` is not restarted. `neo`'s files are not modified. `neo` does not even have to know about the bud until it happens to look at the family registry. This is what "asymmetric reproduction" means in practice.

Contrast with `cp -r`:

| Step                  | `cp -r` | `maw bud`          |
| --------------------- | ------- | ------------------ |
| New name              | No      | Yes                |
| New mailbox           | No      | Yes                |
| Lineage tracked       | No      | Yes                |
| Principles inherited  | Yes     | Yes                |
| Retrospective reset   | No      | Yes                |
| Parent left untouched | Maybe   | Yes (by design)    |
| Registry updated      | No      | Yes                |
| Survives if parent dies | Yes   | Yes, and knows why |

The `maw bud` command is roughly a hundred lines of shell. It is not clever. It is not magic. It is just the yeast model, rendered in code. Any framework can implement it. The difficulty is not technical. The difficulty is *noticing that you should*.

---

## Why this matters when things go wrong

The real value of the yeast model is not visible when things are going well. It is visible when things go wrong — which, in a multi-agent system running for months, they will.

Imagine a child agent develops a bad habit. Say it has been merging PRs without running tests first, and several of its merges have broken the build. In a `cp -r` world, this is a mess. The child's git identity is the parent's git identity. The child's retrospectives are written as if they were the parent's. Somebody reading `git log` cannot tell which agent did which merge. Somebody reading the retrospectives cannot tell whether the bad habit started after the fork or was always present. The only way to fix the problem is to audit every commit by hand and reconstruct, from context, which agent authored which line. It is triage by archaeology.

In a yeast-model world, this is a short, contained piece of work. The child's commits are signed by the child. The child's retrospectives are in the child's folder. You read the child's diary — all of it, it starts fresh — and find the session where the habit began. You write a correction into the child's feedback memory. You move on. The parent is not involved. The other children are not involved. The blast radius matches the actual problem.

The same asymmetry applies in reverse. When a child does something brilliant, the credit lands on the child. You can look at the family registry and say "the descendants of this ancestor tend to have clean test histories; the descendants of that other ancestor do not," and the claim is actually measurable because the attribution is clean. `cp -r` destroys that attribution. Yeast preserves it.

---

## Where the metaphor breaks

The metaphor is useful. It is not perfect. Two places it breaks, and one place it stretches uncomfortably.

**No sexual reproduction.** In biology, budding is only one of the reproductive modes. Many organisms also combine genetic material from two parents, which is how novelty enters the gene pool. Agents do not do this. You cannot "cross" two agents to get a child with a mix of their traits. You can bud from one parent at a time, full stop. If you want to combine lessons from two agents, you do it the boring way: read both of their retrospective folders and write a new CLAUDE.md by hand.

**No genetic recombination.** Related to the above. Even within a single lineage, there is no chromosomal crossover, no point mutation, no drift. A child inherits exactly what the bud command chose to pass through. Nothing more, nothing less. Evolution in this system is not automatic. It is deliberate: somebody decides to change the principles, and the change propagates to future children the next time they bud. The old children keep the old principles unless someone edits their CLAUDE.md directly.

**Lifespan is not cellular.** Yeast cells die. Agents do not die in the same way — they get archived (see Chapter 10). An "archived" agent is still on disk, still readable, still part of the lineage. Biologically this would be a fossil. Informationally it is still alive in the sense that you can still extract knowledge from it. The metaphor asks you to imagine a colony where the ancestors remain queryable forever. That is not how cells work. It is how this system works.

The metaphor is a scaffold, not a straitjacket. Hold the parts that help. Drop the parts that don't.

---

## The cost of getting it wrong, concretely

It is easy to talk about `cp -r` in the abstract. Here is the shape of what goes wrong, in the kind of system this book is about.

Picture a second agent stamped out from a parent by copy. The failures that follow are not catastrophic — they are irritating, which is in some ways worse because they waste attention in small pulls.

The first failure is voice confusion. The new agent writes a retrospective in the first person using the parent's name, because the template pronoun was copied verbatim and nobody touched it. A human reader may or may not catch this, and every retrospective written before the catch is permanently ambiguous about which agent it describes. You cannot grep your way out of a pronoun drift.

The second failure is overlapping action. The new agent goes to consume a task from a shared queue and the task is already in progress on the parent — because there is no lock, no coordination, because the two agents *believe they are the same agent*. Duplicate work. Merge conflicts on files that should never have been touched by two workers at once.

The third failure is untangling. When the operators eventually want to split the two agents' responsibilities cleanly, the combined history cannot be pulled apart. The honest fix is to treat the shared period as a shared ledger and start both agents' individual diaries fresh afterward — losing whatever agent-specific lessons existed, because there is no way to attribute them.

Every one of these is prevented by the yeast model. New name, new mailbox, new diary, from birth. The cost of implementing the yeast model is an afternoon of scripting. The cost of *not* implementing it is weeks of shared-state confusion and the loss of whatever was learned during that period. That ratio — an afternoon of design versus weeks of cleanup — is characteristic. It is the same ratio for every pattern in this book, and it is what makes these patterns worth the apparent overhead.

---

## When the parent itself is about to become the child's peer

One subtle case worth flagging. Sometimes the natural shape of a bud is not "parent stays broad, child takes a slice," but "the work has grown into two sibling scopes, neither of which is properly a subset of the other." In biology this would be a fission event: one cell splits into two peers. The yeast model does not natively support this. The model says the parent continues unchanged.

In practice, you fake fission with a bud and a graceful parent handoff. The parent buds the child, transfers the relevant mailbox threads and patterns to the child explicitly, updates its own `Purpose` to reflect the narrower remaining scope, and carries on. From the outside it looks like the cell split. From the inside it is still budding — the parent was never interrupted, never restarted, never replaced. It simply *narrowed* after the bud, by editing its own identity file.

This is worth naming because the impulse to "split an agent in half" is real, and following it literally leads back to `cp -r` territory. The yeast model forces the operation into a clean sequence: bud child, hand off, narrow parent. Three reversible steps beat one destructive one.

---

## The generic takeaway

Forking an agent is inheritance, not copying.

Three rules follow from that, and they apply whether you are building on Claude Code, LangChain, CrewAI, a bespoke Python harness, or something that does not exist yet:

1. **A new agent gets a new identity from the first byte of its existence.** Name, mailbox address, signing key. No exceptions. If you have to `sed` the identity after the fact, you have already lost.
2. **Selective inheritance beats wholesale inheritance.** The parent's genome (principles, tooling, lineage) passes down. The parent's in-flight memory (open mailboxes, live retrospectives, current plans) does not, unless you explicitly pass it.
3. **The parent is unaffected by the fork.** If budding a child requires restarting, reconfiguring, or rewriting the parent, you are not budding. You are mutating. The two operations have different semantics and should be implemented separately.

You do not need fancy tooling to do this. A shell script is enough. A Makefile is enough. What you need is the intent — the recognition that an agent's second instance is not a second copy of the first, but a descendant. Once you see that, the code writes itself.

The next chapter follows the thread one level deeper: if the child inherits selectively and has its own identity, how do we keep track of who its parent was? How does lineage survive the fork, so that three generations later, the grandchild can still answer the question *who am I descended from, and what did they believe?*
