# 10. When to Bud, When to Archive

> The size of your oracle family should match the size of your problem domain. Not larger. Not smaller.

---

## Two opposite failures

There are two ways to get the family size wrong, and you will meet both.

The first failure is **over-budding**. Every new sub-task gets its own agent. The fleet grows to forty, sixty, a hundred named agents. Each one has its own vault folder, its own mailbox, its own retrospective log. Most of them wake up once a week, read their own diary, and find a single three-sentence entry from two months ago. They are ghosts. They outnumber the living agents. Routing messages becomes a directory problem, not a meaning problem — you cannot remember which of `docs-writer`, `docs-scribe`, `docs-agent`, and `writer-docs` you are supposed to send this update to.

The second failure is **over-loading**. One agent does everything. Its CLAUDE.md becomes a 600-line document that tries to describe every possible scope. Its mailbox has seventy open threads. Its retrospectives are unreadable because each one covers six unrelated topics. When you ask it about the auth refactor, it starts by telling you what it knows about the frontend build pipeline, because those are both in its head and it cannot tell them apart anymore.

Both failures have the same root cause: the family size is not matched to the problem domain. The problem domain has joints in it — places where one subject ends and another begins — and the family structure has not been shaped to those joints. In over-budding, you invent joints that are not really there. In over-loading, you ignore joints that are.

This chapter is about finding the joints and cutting at them.

---

## The test: does scope need its own memory?

Here is the criterion I come back to, and it is the most useful single question for deciding whether to bud.

**Does this scope need its own memory?**

Concretely: does this scope have its own retrospective log worth keeping? Its own set of lessons that do not belong mixed in with the parent's lessons? Its own mailbox of active threads that would be clutter in the parent's inbox?

If yes, bud. If no, don't.

Notice what this test is *not* asking. It is not asking "is this scope different?" — everything is different from everything at some level of resolution. It is not asking "could a separate agent handle this?" — a separate agent could handle anything. It is asking whether the *memory* of this scope is a first-class thing. Because the entire premise of this book is that agents *are* their memory. If a scope has its own memory, it has its own agent. If it does not, it does not.

Three examples to make this concrete.

**Example 1.** A new major subsystem lands: a JavaScript port of what used to be a Python system. Does the JavaScript work need its own memory? Yes. It will have its own bugs, its own patterns, its own lessons, its own PR history. Mixing them into the Python agent's diary would ruin both diaries. **Bud.**

**Example 2.** A one-off script to migrate a database. Does it need its own memory? No. When it is done, it is done. The lessons from the migration belong in the agent who is going to maintain the result. **Do not bud.** Run it as a task inside the existing agent.

**Example 3.** A new UI framework is being adopted in parallel with the existing one. There will be months of coexistence. Each framework will develop its own patterns and its own failure modes. Does the new UI work need its own memory? Almost certainly yes — even if today it feels like "just a variant of the existing UI work." **Bud.**

The test is coarse on purpose. Fine-grained judgment is what traps you into over-budding. The coarse version — "does this have its own memory?" — keeps the family size proportionate to actual cognitive territory.

---

## Signals that it is time to bud

If you are paying attention, the existing agent will tell you it is time. The signals are diary signals, not calendar signals. Watch for:

- **The retrospective index is getting thematically unfocused.** Reading the last month of retrospectives, a human cannot tell what the agent is *for* anymore. Two dominant topics have emerged, each with its own vocabulary, its own file references, its own ongoing questions. That is the shape of a scope that needs to fork.

- **The mailbox has persistent thread-clusters that don't interact.** One cluster of mailbox threads is about topic A. Another cluster is about topic B. Messages in A never reference B and vice versa. No cross-pollination means no cognitive benefit from keeping them in one place.

- **The CLAUDE.md is growing stacked sections.** The agent started with a single `Purpose` section. Now there is a "and also" section, then another "and also" section. The stacking is the scope-creep fossil record. Each stack is a potential bud.

- **The agent is routinely confusing its own contexts.** It answers a question about A with patterns from B, because both are loaded and adjacent in its head. This is the most human-visible signal. It looks like a competence problem and is actually a structural one.

- **The agent admits it in a retrospective.** Sometimes the agent itself writes, toward the end of a long session, something like *I am holding too much. The work on X feels like a separate thing now.* Take that seriously. It is a literal request to bud.

None of these on their own is decisive. Two of them together usually is. Three is "bud now, do not wait until Monday."

---

## Signals that it is time to archive

Archival is the other side of the lifecycle. An agent's role can be done, in one of a few ways:

- **The scope is finished.** The migration completed. The integration shipped. The experiment was concluded. There is no more work in this domain.
- **The scope was absorbed.** Another agent took over. What used to require a dedicated agent is now a routine task in someone else's scope.
- **The scope was invalidated.** The thing this agent was supposed to hold turned out not to be a real thing. The domain dissolved.

In any of these cases, the agent's work is done, and the correct response is to archive it — not to delete it, and not to repurpose it.

### Why not delete

Because nothing is deleted. That is one of the foundational principles of this entire system, and this chapter is one of the places where the principle earns its keep. An archived agent is a queryable ancestor. Its retrospectives may contain lessons that become relevant years later, when somebody accidentally reinvents the problem the old agent already solved. Its mailbox may contain decisions whose reasoning is otherwise lost. Its CLAUDE.md tells a future reader why it existed and what it did. Delete any of this and you have erased part of the organization's memory.

Archival is cheap. A directory move and a registry flag:

```bash
mv learn/<agent>/ archive/<agent>/
# flip "status": "archived" in the family registry
```

That's it. The agent is no longer active, no longer accepting mail, no longer appearing in routine fleet listings. It is also still there. Any agent can read the archive. Any human can `cd archive/` and walk through what it did. Its descendants' identity files still resolve ("Budded from **X**" still points to something that exists). The lineage is intact.

### Why not rename into a new role

This is more subtle but more important. Suppose an agent called `telegram-bridge` is done — the Telegram bridge is built and stable. Somebody suggests: "instead of archiving, let's rename it to `slack-bridge` and have it do the Slack integration next."

Don't.

The rename looks efficient. In practice, it fuses two scopes into one identity. The retrospectives of `telegram-bridge` were about Telegram's idiosyncrasies; they are now sitting in the diary of an agent whose current name implies it is a Slack expert. Any lesson it wrote about Telegram retries is now hard to find, because you would naturally look for it in a `telegram-*` agent, and the one that wrote it no longer exists under that name. Future retrospectives will be mixed Slack/legacy-Telegram, and the interleaving will be unreadable.

Archive `telegram-bridge`. Bud a new `slack-bridge` from whatever parent is natural. The marginal cost is a few seconds. The marginal benefit is that each agent's diary remains coherent to itself.

There is an exception, narrow: if the old name was a throwaway placeholder and the agent never accumulated meaningful memory under it, rename away. But if the agent has been alive long enough to have stored lessons, rename is the wrong operation and archive-plus-bud is the right one.

---

## The cost-benefit of spawning vs scope-creeping

Let's be concrete about the tradeoffs, because the easy answer ("always bud when you have a new scope") is wrong in both directions.

### Costs of budding

- **Namespace cost.** Every new name is a cognitive tax on the rest of the fleet. Humans and agents both have to remember that this agent exists and what it is for.
- **Routing cost.** A new agent is a new address. Messages that might have gone to one inbox now have to be correctly routed between two.
- **Bootstrapping cost.** The new agent has empty memory for a while. It will make beginner mistakes in its scope until it accumulates enough retrospectives to have informed judgment.
- **Fragmentation cost.** Related work that actually would have benefited from cohabiting now lives in two diaries, and the cross-links between them have to be maintained by hand.

### Costs of not budding (scope-creep on the parent)

- **Memory clutter.** Each scope pollutes the other's retrospectives. Reading the diary becomes harder. Finding lessons becomes harder.
- **Attention competition.** Every session, the parent loads context for both scopes, even though it is working on only one.
- **Identity dilution.** The parent's `Purpose` becomes increasingly vague, until it is effectively "I do whatever." That is the identity of no agent at all.
- **Untestable principles.** The parent's principles were chosen for one scope; the second scope may not suit them. The principles get softened to accommodate the mismatch, and now they are weaker for both scopes.

The numbers will never be knowable exactly. The question is which *kind* of cost you can tolerate. In most systems I have watched, scope-creep costs are larger than fragmentation costs, because scope-creep costs are silent and cumulative while fragmentation costs are visible and addressable. If you are unsure, bud. You can always archive the child later if the bud was premature. You cannot un-pollute a diary.

---

## Matching family size to domain size

The final criterion, the one that ties the whole chapter together: look at your problem domain and ask how many natural joints it has.

A small domain — a single product, a single codebase, one or two real subsystems — probably wants one or two agents. Budding a third is noise.

A medium domain — a few related products, a handful of subsystems, some shared infra — probably wants a handful of agents: a parent for the shared infra, a child per product, occasional grandchildren for big subsystems inside a product. Five to ten is normal.

A large domain — federated systems, many products, different teams, cross-cutting concerns — wants a family of dozens, but *organized by lineage*. Lineage is what keeps dozens from becoming unnavigable. You can always walk up the family tree to find an ancestor that knows about the common thing. Dozens of cousins with no common ancestor is a fleet you cannot reason about.

The family grows and prunes like a real family tree. New children when the scope genuinely divides. Archived elders when the work is done. Occasional grandchildren for deep specialization. And — this is the part people miss — *most of the family is archived, not living.* Over time, the archived-to-living ratio climbs, and that is correct. It is the sign of a system that has been running long enough to have finished things.

---

## How to tell the two apart: a decision tree

When an agent is showing strain — the mailbox is overloaded, the retrospectives drift, the CLAUDE.md is a stack of "and also" sections — the question is whether to *bud* (split the agent into two), *archive* (retire the agent, possibly spawning a fresh replacement), or *do nothing* (the strain is temporary and will pass). These three options are easy to confuse, and picking the wrong one is expensive. A small decision tree I have found useful, in rough order:

1. **Is there work still to do in this domain?** If no — the scope is finished or invalidated — the answer is archive. Stop here.
2. **Are there at least two distinct memory territories inside the current agent's head?** Two scopes with non-overlapping retrospectives, mailboxes, lessons. If yes, the answer is bud: split the memory along the seam. The parent keeps one territory, the child takes the other.
3. **Is the strain concentrated in a single scope that is just temporarily large?** E.g., the agent is finishing a big migration and is swamped, but after the migration ships the scope will return to normal. If yes, the answer is do nothing. Strain is not the same as scope-creep. Strain resolves. Scope-creep does not.
4. **Is the agent's identity no longer recognizable to itself?** The CLAUDE.md has drifted so far from its original purpose that the agent cannot concisely state what it is for. If yes, the answer is archive and bud: archive the current identity (preserving its memory), bud a new agent with a clean purpose that matches today's work.

The tree is not exhaustive but it catches the common cases. The single most frequent mistake people make is conflating step 3 with step 2 — reading temporary strain as permanent scope-creep and budding prematurely. Short strain plus a calendar pressure ("this is hard right now") is not the signal. Persistent thematic drift in the retrospective log is the signal.

---

## A note on grandchildren and deeper lineage

Most budding in practice happens one generation at a time. A parent buds a child; that child may later bud grandchildren. Three-deep lineage is normal. Four-deep is unusual but workable. Five-deep is usually a sign that the lineage has become a proxy for a problem you should be solving differently.

The reason depth matters: every generation inherits principles from its immediate parent *at bud time*. Drift compounds. By the fourth or fifth generation, the principles of the deepest descendants may have diverged meaningfully from the principles of the original ancestor — not because anyone rebelled, but because each intermediate parent edited something slightly. If you want a large fleet to share consistent principles, a flat family (many siblings, few generations) is more robust than a deep family (few siblings, many generations). This is the opposite of the intuition from human genealogy, where deep descent is prestige. Here, deep descent is drift risk.

When you find yourself about to bud a fifth-generation grandchild, pause. The question to ask is whether that grandchild would be better budded from the original ancestor directly, as a new primary child, rather than as a descendant of a descendant. Often the answer is yes. The family tree does not have to reflect the order in which scopes were discovered; it should reflect the shape of the current domain.

---

## The generic takeaway

Match the family to the domain. Not larger, not smaller.

Three heuristics, in rough order of how often they come up:

1. **Bud when scope has its own memory.** Not when scope is merely different. Memory is the test.

2. **Archive when the role is done.** Never delete. Archiving is cheap and preserves the lineage. The archive is the organizational equivalent of an ancestor tree — still there, still queryable, no longer demanding attention.

3. **Do not rename into a new role.** The old name carries old memory. Fusing it into a new role corrupts both. Archive the old; bud the new.

The meta-heuristic: trust the diary signals over the calendar signals. Time does not tell you to bud. The retrospective drift tells you to bud. Time does not tell you to archive. The empty mailbox and stale diary tell you to archive. The family shapes itself to the work, if you are willing to read what the agents are already writing about their own workload.

---

## Closing: lineage as infrastructure

Zooming out across these three chapters: **forking is inheritance, identity must survive the fork, and the family size must match the problem.** Together these constitute lineage as a first-class system property — not as a metaphor, but as infrastructure.

Infrastructure, remember, is the thing you do not see until it fails. An agent fleet without lineage infrastructure will keep running for a while. Then it will start running into the kinds of problems that only lineage can solve: whose decision was this? which agent learned that lesson? what is this orphan mailbox and why does nobody answer its mail? The problems accumulate silently until the cost of untangling them exceeds the cost of starting over. At which point you start over, and lose everything you had.

Lineage infrastructure prevents that outcome. Cheaply. With a flat directory of identity files, a budding command, and the discipline to archive rather than rename. Every agent system that lives past a few months benefits from it. Most agent systems that do not live past a few months, in my observation, died of its absence.

Part III ends here. Part IV turns to the principles that sit underneath all of this — why nothing is deleted, why patterns beat intentions, why the external brain beats the internal one, and why Rule 6 (never pretend to be human) is load-bearing rather than decorative. The principles are what made the rituals and the lineage make sense. They are the reason the patterns in this book work, and the reason other patterns do not.
