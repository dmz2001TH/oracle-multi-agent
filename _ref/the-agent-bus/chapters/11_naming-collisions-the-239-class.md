# Chapter 11: Naming, Collisions, and the #239 Class

> "Naming in distributed systems is a type system. Design it with the same care."

---

## 11.1 The Bug That Gave the Chapter Its Name

On the morning of 2026-04-09, `maw hey white` — a command intended to reach the `oracle` pane on the `whitekeeper` machine across the WireGuard overlay — quietly delivered its message to a local tmux window called `105-whitekeeper`. The message was a standup request. The standup was produced by a local session that had no context for the question, answered as best it could, and returned an answer that looked plausible. Nobody noticed for two hours.

The root cause was a three-line piece of code in the router that decided, when given a bare name, whether to treat it as a local agent or a remote node. The check was a substring match. `"whitekeeper".includes("white")` returned true before the federation resolver ever ran, so the local window won the routing race. `fleet doctor` — a later-added diagnostic — flagged the collision the next day, but by then the wrong answer had propagated into two retros and a planning document.

This bug is tracked as issue #239 in the live system, and we have come to use it as the canonical example of a class of failure — not a single bug to be patched but a *category* of mistakes you will make in any distributed system where peers and local entities share a namespace. This chapter is about that class: how it arises, how to prevent it, how to detect it after it ships anyway, and what a healthy name resolver looks like.

---

## 11.2 The Shape of the #239 Class

A name collision is simple to state: two things share a name, and the system picks the wrong one. In a single-process program a collision is a compiler error, because the language has a type system that rules the ambiguity out. In a distributed system spanning multiple namespaces — local agents, local tmux windows, remote peers, remote agents on remote peers — the type system is whatever you choose to build. If you do not build one, ambiguity will manifest as *quietly wrong* behaviour, which is the worst kind.

The #239 class has a specific signature. It appears when:

1. **A name is resolved against more than one namespace.** In #239, the same string could have meant a local tmux window or a remote fleet entry.
2. **The match rule is approximate.** In #239, `includes()` rather than `===`.
3. **There is no tie-breaking rule, or the implicit tie-breaker favours the wrong namespace.** In #239, local always won, which was exactly the wrong default for a federation command.
4. **The failure is silent.** A wrong delivery still delivers; the sender sees success.

Any distributed system with more than one tier of addressing can produce a #239-class bug. Multi-agent buses are especially prone because the tiers are conceptually lightweight — an agent in a pane, an agent on a peer, an agent in a team — and it is easy to let their identifiers overlap.

---

## 11.3 The Three Namespaces in a Multi-Tier Bus

The live system routes names against three namespaces, and any reasonable multi-agent system will end up with some variant of the same three:

**Local agents.** Named tmux panes inside the current machine's `maw-js` session. Examples: `oracle`, `scanner`, `book-writer`. Their authoritative list comes from `tmux list-panes` plus a metadata mapping.

**Local sessions / windows.** The tmux sessions themselves are also named, and those names are often derived from fleet entries for bookkeeping. Examples: `105-whitekeeper`, `107-boon3`. These are *descriptive* — their purpose is to tell a human which window belongs to which oracle — but the string is plain tmux, and tmux will happily send keys to it if asked.

**Fleet peers.** Remote nodes declared in `~/.config/maw/fleet/*.json`. Examples: `whitekeeper`, `boonkeeper`, `colab`. Each has an overlay IP, a port, and a list of the agents hosted on it.

The #239 bug happened because the first two namespaces overlapped visually — a fleet peer called `whitekeeper` had a local tmux window called `105-whitekeeper`, because the window name was literally constructed from the fleet entry — and the resolver did not know which namespace to prefer when a bare name matched a prefix in one and an exact string in the other.

The generic takeaway, which will sound obvious in hindsight but eludes almost every first implementation: **if two namespaces share any string, the resolver must know which namespace to try first, and must know when to refuse to resolve at all**. Neither of those disciplines is free; each is a deliberate design choice.

---

## 11.4 Exact Tokens, Not Substrings

The single rule that would have prevented #239 is also the single rule that rules out the largest slice of the #239 class: **match peer names by exact token, not by substring**. Not `includes()`. Not a fuzzy similarity score. Exact equality, after tokenisation.

In English prose this sounds trivial. In code it requires discipline because the temptation to "be helpful" is strong. Somebody types `maw hey white`; they obviously mean `whitekeeper`, the tool should figure it out. The helpfulness is a trap. There is no way to know, from the string alone, whether the user meant `whitekeeper`, or `whitekey`, or `white-office`, or a machine you added last week called `white-vultr`. The right behaviour when faced with an ambiguous input is to pause and ask, not to guess.

A principled resolver looks like this, conceptually:

```typescript
function resolve(input: string): Resolution {
  const { node, agent } = parse(input);    // "white:oracle" → { node: "white", agent: "oracle" }

  if (node) {
    const peer = fleet.find((p) => p.name === node);       // exact match
    if (!peer) return { kind: "unknown-node", input: node };
    return { kind: "remote", peer, agent };
  }

  const localAgent = panes.find((p) => p.name === input);   // exact match
  if (localAgent) return { kind: "local", pane: localAgent };

  const peerByBareName = fleet.find((p) => p.name === input); // exact match, fallback
  if (peerByBareName) return { kind: "ambiguous-or-remote", peer: peerByBareName };

  return { kind: "unknown", input };
}
```

Four decisions are encoded in that sketch and each is worth its own sentence:

- The `node:agent` form (chapter 10) is always explicit. It wins over any bare-name guess.
- Bare names resolve against *local* first, because the most common case — by two orders of magnitude — is that a human is messaging an agent on the current machine.
- Bare names that happen to equal a peer name are flagged ambiguous. The resolver does not silently pick a side. It returns a structured result that the CLI layer can turn into a prompt.
- Substring matching never appears.

Our real resolver is slightly more forgiving than the sketch — it provides a "did you mean?" hint when a name is off by one character — but the hint is a *suggestion*, and it is printed, and it does not route. The difference between a hint and an auto-correct is the difference between a helpful tool and a tool that occasionally delivers your standup to a window that had no way of answering it.

---

## 11.5 Explicit Addressing Is Not Optional

A design decision fell out of #239 that is worth calling out: **explicit addressing is the only acceptable form whenever ambiguity is possible**. The `node:agent` form was always supported; after #239 it became the encouraged form in docs, scripts, and skills. Bare names remain as an ergonomic convenience for the common case, but anything that might route across federation must use the colon.

A rough rule of thumb:

- **Interactive human typing**, aware of their own local context: bare names are fine, and the resolver will pick local first.
- **Scripts, crons, skills, hooks, anything that might run on a machine other than the one it was written on**: always use `node:agent`. Always.
- **Documentation examples**: always `node:agent`. Readers paste these. Readers have different contexts than authors.

This is a discipline, not a language feature. The system does not force it because forcing it would break the ergonomic case. But the team conventions, the docs, and the skill templates all prefer the explicit form, and over time the bare-name form retreats to its correct niche: interactive, local, attended.

---

## 11.6 Detecting Collisions at Config-Load Time

The resolver is the last line of defence. The first line of defence is catching collisions when they enter the system — at the moment a fleet entry is added or a tmux window is created.

The canonical example: a developer buds a new oracle, naming it `whiter`. The fleet entry file is created: `~/.config/maw/fleet/110-whiter.json`. At the moment that file is loaded (or at the moment it is saved), the loader should ask: *is there any existing name, in any namespace, that shares a substring relationship with `whiter`?* If so, warn now.

The live system now does exactly this via `maw fleet doctor`:

```
$ maw fleet doctor
collisions:
  whiter (new) vs whitekeeper (existing)
    - "whiter" is a prefix of neither, but collides visually
    - exact-match resolver: OK
    - substring resolver:  CONFLICT
    - recommendation: rename new peer or use node:agent form
  sam (local agent) vs samsession (tmux window)
    - exact-match resolver: OK
    - recommendation: local agent wins on bare name
health:
  4 peers reachable, 1 peer dormant, 0 peers offline
```

Two features of that output earn their space:

- It does not only report *active* collisions. It reports *potential* collisions — name pairs that *would* collide under a looser resolver. This is the difference between a doctor that diagnoses the current illness and a doctor that also points at the risky behaviour. The latter is more useful.
- It makes the resolver rules explicit, so a developer reading the output knows exactly which matching rules apply in their installation. Naming hygiene is a team property, not a personal taste; making the rules visible lets the team converge.

**`fleet doctor` did not prevent #239.** It was added *after* #239 and specifically as a response to it, which is the honest answer to the question "why did you not catch this in CI?" — we did not have CI for fleet state until the bug forced us to. The generic lesson: **naming hygiene belongs in the config loader, not in the routing layer**. A bad name in the fleet should fail at load time or at least warn loudly. Catching it at the moment a message is being routed is too late.

---

## 11.7 Canonical Forms and Rename Safety

Even with exact matching and load-time collision detection, names evolve. Peers get renamed. Agents change roles. What used to be `boonkeeper` becomes `boon3`. Unless the system has an opinion about *canonical* forms, every rename becomes a days-long scavenger hunt for the last script that still referenced the old name.

The live system's rule is simple: **fleet entries have a single canonical name, not a list of aliases**. A rename is a `fleet rename` command that rewrites the entry file, updates the known cross-references (skills, contacts, docs if they are in `~/.claude/`), and emits a deprecation message if the old name is resolved in the subsequent 30 days. After 30 days the old name is simply unknown; the deprecation period is short enough that it does not rot and long enough that most scripts get one clean startup in which to surface the warning.

Three sharper rules followed from experience:

- **No aliases.** Allowing `boon3` to be an alias for `boonkeeper` sounds friendly and creates permanent confusion. If a name changes, change it. If both need to coexist, they are different peers.
- **One canonical shape per machine.** The fleet entry file name (`107-boon3.json`), the node name field inside the JSON (`"name": "boon3"`), and the `/api/identity` response (`{ "node": "boon3" }`) all agree. A mismatch between any two is a load-time warning, because it is nearly always the symptom of an incomplete rename.
- **Agents do not rename.** An agent that was `oracle` stays `oracle`. If the role has changed, bud a new one. This feels unnecessarily strict until the first time you try to track a cross-node debug where an agent's identity changed mid-incident, at which point it feels necessary and strict, as intended.

---

## 11.8 Ambiguity-Friendly CLIs

Part of making naming safe is making the CLI handle ambiguity well. A good CLI, confronted with a bare name that maps to two possible targets, does one of three things — in order of preference:

**1. Ask.** If the tool is interactive (`maw hey whitekeeper`), and the name could mean the local window `105-whitekeeper` or the remote node `whitekeeper`, the CLI should print the alternatives and wait for a keystroke. Thirty-character prompt, two-character answer. The cost to the human is trivial; the cost of guessing wrong is the rest of this chapter.

**2. Refuse.** If the tool is non-interactive (a script, a hook, a cron), it should exit with a structured error that names the alternatives. Anything else — any "best-guess" behaviour — will eventually produce a silent wrong delivery, and the silent wrong delivery will not be caught until the humans notice the effects downstream. Loud refusal is cheaper than quiet success.

**3. Prefer local, loudly.** In exactly the case where the bare name is an *exact* match for a local agent *and* an *exact* match for a peer, prefer local (because local is overwhelmingly the intended target for bare names) *and* print a one-line warning suggesting the `node:agent` form if the user meant the peer.

The live system has iterated toward (3) as the common-case default, with (1) used in `fleet doctor` and (2) used in all hook/cron contexts.

---

## 11.9 The Broader Pattern: Naming as a Type System

The engineering literature on naming is thinner than it should be, probably because naming feels like a human problem (what do I call this thing?) rather than a systems problem (what happens when two things share a name?). In multi-agent systems it is squarely a systems problem, and the framing that has served us best is: **treat names as types, treat the namespace structure as a type system, and treat the resolver as a type checker**.

Concretely, this means three habits:

**Annotate names with their namespace.** `whitekeeper` on its own is ambiguous; `peer:whitekeeper` and `pane:whitekeeper` are not. The live system uses `node:agent` as the annotation convention. Other teams might use `/peer/whitekeeper` or `@pane/whitekeeper`; the specific syntax is less important than the habit of *writing down which namespace a name belongs to whenever ambiguity is possible*.

**Refuse to resolve across namespaces silently.** The resolver returns a structured result, and callers are forced to handle the `ambiguous` and `unknown` cases. A resolver that returns a bare `PaneId` or null has thrown away the information the caller most needs.

**Keep the namespaces small and auditable.** A fleet directory with dozens of peers is still browsable. A teams directory with hundreds of agents is a name-collision nursery. If you ever find yourself with enough names that collisions become statistically likely, that is a signal to introduce hierarchy — a second namespace level — rather than pray for uniqueness.

Naming hygiene compounds. Each of these habits is cheap on its own. Together they make a five-machine federation with a dozen agents per machine feel crisp and navigable, where an undisciplined version of the same topology would feel like a minefield.

---

## 11.10 Recovery: What to Do After a Misdelivery

When — not if — a misdelivery happens, the recovery is about two things: finding out *where* the message went, and preventing the next one.

**Find the message.** Every tier of the live bus logs the last hop. The local `maw-js` logs the resolved target. The remote `maw-js` logs the delivery. Reconstructing the path after the fact is a few `journalctl -u maw-js` or `grep` calls away. The important artefact is the resolver's decision — which namespace won, with what rule — because that is the input to fixing the resolver.

**Prevent the next one.** A post-incident checklist that has earned its keep:

- [ ] Is the name involved flagged by `fleet doctor`? If not, is `fleet doctor` insufficient?
- [ ] Was the bare-name form used where `node:agent` would have been safer? If yes, update the scripts and docs that used the bare form.
- [ ] Did the CLI print a warning at the time of delivery? If not, is the warning too quiet or was it suppressed?
- [ ] Is there a rename that would remove the collision entirely? If yes, weigh the cost of the rename against the probability of recurrence.

We have learned to write the post-incident note as a *commit message on the fleet directory*, not as a separate retro. The commit message travels with the config, survives rebases, and is the first thing the next human sees when they `git log` the directory — which is exactly the context in which the warning is useful.

---

## 11.11 Summary

The #239 bug is a specific instance of a general pattern: distributed systems with multiple namespaces will, under permissive matching rules, resolve ambiguous names to the wrong namespace, and the wrong delivery will be silent. The pattern is prevented by four disciplines:

1. **Exact tokens, not substrings.** The single most important resolver rule.
2. **Explicit addressing where ambiguity is possible.** `node:agent` is not a verbosity tax; it is a type annotation.
3. **Load-time collision detection.** `fleet doctor` or its equivalent, run every time the config changes.
4. **Structured ambiguity handling in the CLI.** Ask when interactive, refuse when scripted, prefer local loudly when bare-names match both tiers.

Underneath all four is a single idea: names in a multi-agent bus are a type system, and they deserve the same design care as any other type system. Leave them to intuition and you get #239-class bugs. Invest in them and you get a federation that feels navigable at ten peers, at twenty, at a hundred.

Chapter 12 picks up where this leaves off: once the names are sound, how do agents find each other in the first place?
