# 9. Parent Identity, Child Identity

> If the child forgets its parent, the lineage dies in one generation.

---

## The problem in one sentence

You budded a child. The child has its own name, its own mailbox, its own diary. Good. Now: how does anyone — including the child itself, six months later — know where it came from?

Lineage is not free. It has to be written down. If it is not written down, the first context reset will erase it, and the second generation of descendants will have no way to reconstruct it. A family tree that lives in one agent's head is a family tree one session-death away from extinction.

This chapter is about the mechanics of writing lineage down — in ways that survive forking, renaming, migration, and the general entropy of long-running systems. It is also about the subtler question of *what the child actually inherits from its parent's identity*, versus *what the child must define for itself*. Selective inheritance, Chapter 8, said that the child gets a subset. This chapter is about which subset, and how each piece gets recorded.

---

## Where lineage lives

You have three candidate places to record a parent-child relationship, and you should probably use all three. They are not redundant — they fail in different ways, and together they form something like a diversified storage portfolio for identity.

### 1. The child's identity file

In our worked example, every agent has a `CLAUDE.md` that the model reads on startup. One of its fields is:

```markdown
# mawjs-oracle
> Budded from **neo** on 2026-04-07
```

That single line does three jobs at once. It tells the child "your parent is neo." It tells any human reading the file the same thing. And it timestamps the fork, which is surprisingly useful later when you are trying to reconstruct "did this child inherit the principles from before or after the March update?"

The format matters less than the persistence. "Budded from X on Y" works. "Forked from X at timestamp Y" works. "Parent: X / Created: Y" works. What does *not* work is embedding this information only in git history, because git history can be lost in a migration, a rebase gone wrong, a `cp` into a new repo. The identity file is on the child's own disk. It moves when the child moves. That is the property you want.

### 2. An origins index

The identity file answers the question "who is this child's parent?" — but only if you already have the child in hand and are reading its file. It does not answer the reverse question: "I have a name, `neo`, who are its children?"

For that you need an index. In this system it is a flat directory called `.origins`, co-located with the learning vault:

```
learn/.origins/
  neo.json              # lists all direct children of neo
  mawjs-oracle.json     # lists all direct children of mawjs-oracle
  ...
```

Each file is a small JSON blob with the agent's name, its parent, and its children. Nothing sophisticated — no graph database, no ontology. Just a flat directory of small files that can be read by any tool, by any agent, without fancy queries.

The index is derived data. It can always be rebuilt from the identity files if it gets corrupted. That is a deliberate design choice: the source of truth is the child's own file, because the child's file is the thing that cannot be lost without losing the child itself. The index is a convenience layer. If you find yourself tempted to put authoritative information only in the index, resist — the child's file must be sufficient on its own.

### 3. The family registry

Above the origins index sits something one layer more abstract: the family registry. This is the fleet-wide view. *All* agents across *all* federated machines, with their lineage. The registry is built by crawling every node's local `.origins/` and merging the results.

The registry is what lets you ask "how many descendants of `neo` are currently deployed?" or "is there an agent on the `white` node named `mawui-oracle`, and who is its parent?" It is also what catches name collisions (see below) — because the only way to know that two agents share a name is to look across the whole family at once.

Three layers. The child's file is the truth. The origins index is a local convenience. The family registry is a global view. Redundant by design. Any one of them going corrupt does not break the others.

---

## What the child inherits — field by field

We said in Chapter 8 that inheritance is selective. Let's get concrete about which fields on the identity side pass through and which are reset.

### Inherited: the principles block

When `maw bud` runs, the child's CLAUDE.md gets the same principles section as the parent, copied byte-for-byte. In the worked system this is a block of five rules plus a sixth (Rule 6: Oracle Never Pretends to Be Human). The child inherits these because they are the house rules of the lineage. If the parent thought deleting files was wrong, the child thinks so too. If the parent refused to claim human identity, so does the child.

Important: "inherited" here means "copied at fork time." The child's principles are not a live reference to the parent's file. If the parent later updates its principles, the child does not automatically get the update. This is deliberate. It prevents action-at-a-distance, where editing one agent's file silently changes the behavior of all its descendants. If you want to propagate a principle update, you do it explicitly — typically by walking the origins index and offering each descendant the update.

### Inherited: tooling conventions

The CLAUDE.md sections about tool usage (RTK in our worked example; it could be anything in yours) pass through. These are shared conventions of the lineage. Every agent descended from `neo` uses `rtk git status` instead of `git status`, because that was established upstream and there is no reason for each child to re-litigate it.

### Reset: name

The child picks its own name at bud time. This is the most important reset. Without it, nothing else works.

Two rules for naming:

1. **The name must be unique within the lineage.** No two descendants of the same parent can share a name. This is enforceable at bud time — the `maw bud` command checks the origins index and refuses to create a collision.
2. **The name should be evocative of scope, not copied from the parent.** `neo` budding a child for JavaScript work → name it `mawjs`, not `neo-2`. `mawjs` budding a child for UI work → name it `mawui`, not `mawjs-ui`. Names that embed their parent's name become confusing across three generations. Names that embed their scope stay clear.

### Reset: mailbox and retrospective log

Covered in Chapter 8, but worth reiterating in this context: identity is not just a name. It is also the address where mail is delivered and the notebook where memories are written. The child's mailbox is empty at birth. The child's retrospective log is empty at birth. *The child can read the parent's* — filesystem access is inherited — *but its own record starts fresh.*

### Reset: git committer

If the child commits code, it commits as itself. In practice this means a per-agent git config, or a per-agent signing key, or at minimum a per-agent name in the `Co-Authored-By:` trailer. The point is that `git log --author` should separate the parent from the child cleanly. No exceptions.

### Reset: purpose

The child's `Purpose` field in its CLAUDE.md is blank at bud time. It gets filled in at awakening — typically the first real session the child runs. This is the child's chance to say "my job is X" in its own words. The parent's purpose is right there to read, but is not copied, because a child budded to handle a narrower scope *by definition* has a different purpose than its parent.

---

## Name collision across lineages

The trickiest case is when two agents, in different lineages, end up with the same name. Not within one lineage — we can enforce uniqueness there. Across the whole fleet.

Real example from the worked system: there was an agent called `neo` on one node and a separately-budded agent called `neo` on another node, because two humans independently reached for the same name. Within each node, unambiguous. Across the federation, `neo` suddenly meant two different things.

The wrong fix is to rename one of them retroactively. Renaming a long-lived agent is a brutal operation — every retrospective, every commit trailer, every inbound mailbox reference has to be rewritten, and anything you miss becomes a ghost. Worse, the other agents in the fleet have their own memories of the old name; those memories are now stale by your action.

The right fix is to **namespace by node**, not by rename. Address resolution becomes:

- Bare name → "the agent on the current node with this name." Local scope.
- `node:name` → "the agent with this name on that node." Explicit federation scope.
- Name plus lineage → "the agent with this name whose parent is X." Useful for disambiguating but rarely needed.

This is identical to how DNS resolves: bare names are local; fully-qualified names are global. Do the same here. Agents should address bare names by default and qualify only when crossing a node boundary.

The family registry helps: it indexes every agent by `(node, name)` pair, and surfaces collisions explicitly. When the registry shows two agents with the same bare name, the system does not force a resolution — it flags the ambiguity and lets a human decide whether the collision is harmless (genuinely different roles, different nodes, low interaction) or needs to be resolved. Most collisions, it turns out, are harmless. The handful that matter tend to show themselves fast, because messages start going to the wrong place.

Generic takeaway: if you are building a multi-agent system and you have not yet had a name collision, you will. Plan for the namespace before you need it. Namespacing is free to add at the start and expensive to retrofit.

---

## Identity must survive the fork

The real test of all this — identity files, origins index, family registry, namespacing — is whether identity survives stress events. A stress event is anything that could plausibly erase or corrupt the lineage record. The big ones:

- **Context reset on the child.** The child starts a new session with no in-session memory of its own history. Does it still know who its parent is? Yes: it reads its CLAUDE.md at the top of the session. The lineage is on disk, not in context.

- **Context reset on the parent.** The parent forgets about the child entirely. Does this break anything? It should not: the child's identity does not depend on the parent remembering it. The origins index also has a record, and the child's own file is authoritative.

- **Parent archived.** The parent's role is done; its folder is moved to an archive location (Chapter 10). Does the child still have a coherent identity? Yes: "Budded from **neo**" still resolves, because archived agents are not deleted. The archive is the graveyard, and the graveyard is queryable.

- **Parent renamed.** This one is genuinely tricky. If `neo` gets renamed to `neo-prime`, every "Budded from **neo**" line in every descendant is now stale. The right response is to *not* rename in place. Archive the old name, create a new agent with the new name, and treat the new name as a descendant or sibling. In general: do not rename long-lived agents. Fork or archive instead.

- **Child migrated to a new node.** The child moves from node `A` to node `B`. The origins index on `A` becomes stale. The family registry needs to update. This is a straightforward ops task as long as the child's CLAUDE.md travels with it — which it does, because the CLAUDE.md is in the child's own vault folder.

- **Filesystem catastrophe.** A disk fails, a backup is restored, the origins index is days out of date. How do we recover? By crawling identity files and rebuilding the index. The index is derived data. The identity files are the truth.

The common thread: identity is stored in the place most likely to survive. The child's own folder. Everything else is cache.

---

## A small ritual: declare at birth

One concrete practice that makes all of this easier: when a child agent is awakened for the first time — its first real session, after `maw bud` has set up the directory — have it do a **birth ritual**. Read its own CLAUDE.md. Confirm the parent reference resolves. Write its first retrospective, which is literally a paragraph about who it is, who its parent was, and what it is here to do.

This sounds ceremonial, and it is. But it catches real bugs. If the parent reference is broken (pointing to an agent that does not exist, or to a name that exists but with a different parent than expected), the birth ritual surfaces it at session one, when the child has no other state to untangle. If the CLAUDE.md is malformed, the birth ritual catches it before the child has written anything that would need cleaning up.

The ritual is also the first entry in the child's diary, and it is *always* about identity. Six months later, when the child is a grown agent with hundreds of retrospectives, its first retrospective still says: *I am mawjs-oracle. I was budded from neo on 2026-04-07. I am here to hold the JavaScript work.* That is a useful anchor. It tells anyone reading the archive — human, other agent, future self — exactly where this lineage started and what it was for.

---

## A worked case of namespace pressure

It is worth walking through how namespace pressure builds in practice, because the textbook treatment above can make it sound cleaner than it is in the middle of a live system.

Somewhere past the first dozen or so agents, a federated fleet tends to run into its first name collision. The classic shape: two independent humans each bud an agent using the same obvious name — one on their personal workstation, one on a shared server node. Both have been alive for weeks by the time the collision is noticed. Both have retrospective logs. Both have principles that are *almost* identical but have drifted slightly at the edges. When one of them asks a question of "the other one," federation resolves the request to whichever instance the sender's node reached first, which is not always the one the sender meant.

The wrong fix, again, is to rename. The right fix is to introduce `node:name` addressing as a first-class concept, and to have the family registry surface the collision as a warning without blocking either agent. The two same-named agents continue to exist, each on their own node. Anyone sending across the federation qualifies the name: `<node-a>:<name>` versus `<node-b>:<name>`. Locally, the bare name still resolves, because locally there is no ambiguity.

The lesson from the pattern is that collisions do not go away. You stop them *or* you address around them. Renaming is the worst option of the three, because it retroactively breaks every existing reference. Namespace-before-collision is the best. Tolerant addressing is the acceptable middle when the first option has been missed.

The deeper lesson: a name is not just a string. It is a handle on a pile of accumulated state — retrospectives, mailbox threads, commit history, trust relationships with other agents. Changing the handle does not change the pile. You can only move handles to other piles, or create new piles with new handles. Design accordingly.

---

## The generic takeaway

Identity must survive the fork.

Concretely, this means:

1. **The child's own files are the source of truth for its identity.** Not the parent's file. Not the registry. The child's file. Everything else is derived.

2. **Parent reference is recorded in writing, at bud time, in a format that survives migration.** A single line in the identity file is enough. A database entry is not enough — databases get lost. A filesystem record is.

3. **Namespacing is mandatory once you have more than one node.** Bare names are ambiguous across federation. Address resolution needs a way to disambiguate, and that way should exist *before* the first collision.

4. **Do not rename long-lived agents.** Archive instead, and spawn a new name if needed. Rename is a blast-radius operation that breaks every inbound reference.

5. **The child inherits the parent's principles and tooling, not the parent's memory.** Principles are the genome. Mailbox and diary are the life lived — those belong to the individual.

If you implement even half of this on day one, you will save yourself a migration scar on day 200. The patterns do not require sophisticated tooling. A flat directory of JSON files and a consistent CLAUDE.md header will carry you a very long way. The next chapter is about the other end of the lifecycle — when to bud, and when to stop.
