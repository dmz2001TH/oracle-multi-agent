# 11. Nothing Is Deleted

> Delete is a weapon. Archive is a choice you can reverse.

The first principle of a stateful agent system is the one most developers instinctively violate. We are trained, from our first `rm -rf node_modules`, to treat deletion as hygiene. Empty is clean. Gone is done. The desktop is tidy because the trash was taken out.

That instinct is wrong for agents.

An agent system is not a desktop. It is a living record of decisions, attempts, corrections, and reversals — most of them by someone (or something) that will not be in the room when you find out they mattered. The moment you delete, you cut a nerve. The system still runs, but it can no longer feel back through time to ask: *what did we know last week, and why did we stop knowing it?*

This chapter is about making archive your default and deletion your exception — and about the concrete mechanics of doing it without letting the vault rot under its own weight.

## The Temptation of `rm`

The first time you build a mailbox for an AI agent, the first thing you want to do is write a `clear` command. It feels obvious. The mailbox has old findings, old standing orders, old context — and it's cluttering the agent's view. Clear it.

Don't.

Watch what happens when you do. The agent's next session looks cleaner. You feel productive. Three days later, you're trying to reconstruct why a particular retry policy was set, and the reasoning was in the mailbox. It's not there anymore. You cleared it. The retry policy is load-bearing — a hard-won adjustment after an incident three weeks ago — but the breadcrumb trail that would explain it has been composted into /dev/null.

You can still run the system. But the system has lost one of its quietest and most valuable abilities: the ability to tell you *why*.

The right move was never `rm`. It was `mv`.

```bash
# Wrong
rm -rf mailbox/findings/

# Right
mv mailbox/findings/ /tmp/mailbox-findings-$(date +%s)/
```

If you absolutely must get findings out of the agent's active view, move them somewhere archival. A timestamped directory in /tmp at minimum. A `archive/YYYY-MM/` folder in the vault if you can afford the space (and you can — text is cheap). A tarball if you need it compact. What you cannot do is pretend the content never existed.

## What Time Travel Buys You

The payoff for archival discipline is a superpower most software systems don't have: time travel.

Time travel here is not the Git sense (though Git gives you one layer of it for code). It is the system-state sense. At any moment, you can answer:

- What did the agent know on Tuesday?
- What was the standing order list three weeks ago?
- Which findings had been written before the incident that triggered the rewrite?
- What did the team lead's handoff say the night the build broke?

These questions feel abstract until you need one of them. Then you need them badly. A bug that only reproduces under last month's config is a detective case, and the only witnesses are the files that were there when it happened. If those files were deleted in the name of tidiness, you have no witnesses. You have a suspect and no evidence.

In a multi-agent system where dozens of agents cooperate across days and machines, the "what did we know when" question is not optional. It is the only way to make sense of emergent behavior. Agent A wrote a finding at 02:14. Agent B read it at 03:07 and made a decision. Agent C acted on that decision at 09:30 and shipped something subtly broken. The shipped thing is the bug. The cause is three files back in the chain. If any of those files are gone, you are guessing.

## "Nothing Is Deleted" In Practice

The principle sounds ascetic in the abstract, so let's make it operational. Here is what "nothing is deleted" looks like in the running systems I've built on top of.

### Retrospectives archive, they don't replace

Every session ends with a retrospective. The retrospective is a markdown file. When the next session runs its own retrospective, the old one is not overwritten. It's kept. You end up with a directory:

```
ψ/memory/retrospectives/
  2026-04/
    12/
      22.15_auth-refactor.md
      23.48_team-wasm-phase-4.md
    13/
      14.15_team-wasm-phase-4.md
```

The filenames encode the time, so chronological ordering is free. The directory is append-only in spirit. A future version of the retrospective system might compact old months, but "compact" means "move to a compressed archive directory" — not "delete."

### Mailbox clearing is movement

A mailbox clear operation — for an agent that has built up too much context and wants to start fresh without losing the record — moves the old mailbox contents out, not away. The operation looks like:

```bash
# What "clear my mailbox" really does
timestamp=$(date +%Y%m%d-%H%M%S)
mv ψ/agents/$AGENT/mailbox ψ/agents/$AGENT/mailbox-archive/$timestamp
mkdir -p ψ/agents/$AGENT/mailbox
```

The active mailbox is empty. The old mailbox is a sibling directory away. If the agent decides tomorrow that the cleared context was load-bearing, it's one `ls` and one `cat` away.

### Session logs live forever

Every session logs its commands, its tool calls, its file reads and writes. Those logs are never rotated out. They are compressed after 30 days. They are indexed for search. They are backed up. They are not, under any circumstance, deleted.

The cost of this is storage. The cost is astonishingly small. A year of session logs for a heavily-used agent fits in a few gigabytes. Storage is cheap; provenance is expensive. Pay for the cheap thing to buy the expensive one.

### Commit history is not rewritten

No `git push --force`. No `git rebase -i` that drops commits. No `--amend` on anything that has been shared.

The Git log is the closest thing software has to a time machine for code, and every rewrite of it is a deletion. Small rewrites on your own unpushed branch are fine — they're scratch paper. But the moment history has left your machine, it is evidence, and evidence is not for editing.

This sounds like hygiene pedantry until the day a bisect reveals that a commit everyone remembers does not exist in the log, because someone squash-rewrote three weeks ago to make the PR look cleaner. The bug is reproducible in production. The fix is a line that was in the rewritten commit. You can't cherry-pick it because it doesn't exist. You have to reconstruct it from memory — at which point the system is no longer the authoritative source; humans are. That's a silent regression in how you can operate.

## The Costs of "Nothing Is Deleted"

Let's be honest about what this costs.

**It costs disk space.** Ten years of retrospectives, all session logs, every version of every mailbox — it adds up. For a personal agent, trivial. For a heavily-used multi-agent system, it's real — but it remains a small number of gigabytes, which is a rounding error in any modern storage budget.

**It costs navigation.** A directory with 400 retrospectives is harder to scan than a directory with 12. Tooling has to compensate — search by date, filter by tag, summarize by week. If you don't build the tooling, archival turns into a junk drawer.

**It costs discipline.** You have to resist the urge to clean. You have to teach new contributors that `rm` is not a normal tool in this codebase. You have to write scripts that refuse to delete without an archival target.

**It costs speed in the first five seconds of wanting to be tidy.** The tidy instinct is real and it is not wrong in the small. You just have to redirect it from "destroy" to "relocate."

None of these costs approach the cost of losing a week of provenance at exactly the moment you need to prove something.

## Archival Levels

Not all archival is the same shape. I think about it in three tiers.

**Tier 1 — Hot archive.** The old file is moved to a sibling directory in the same repo/vault. `mailbox/` → `mailbox-archive/TIMESTAMP/`. Still visible to the agent if it reads. Still indexed by whatever search infrastructure you have. This is the default — the one you reach for when you'd otherwise reach for `rm`.

**Tier 2 — Cold archive.** Monthly or quarterly, you tar up hot archives that have aged past a threshold. You compress them. You move them to a separate location — `archive/2025-Q4.tar.zst` — that's not in the agent's normal path. Still retrievable. Still indexed if you care to index it. Out of the way.

**Tier 3 — Legal archive.** For systems with compliance needs: encrypted, immutable storage, off-site. I've used S3 with object-lock for this. Bucket writes are WORM (write once, read many). You can't delete if you wanted to. This is overkill for a personal agent and exactly right for an agent system that touches customer data.

Most individual developers need only Tier 1. Teams start to need Tier 2 after about six months. Tier 3 is for when the lawyers show up.

## What About Secrets?

The obvious objection: what if the archived content is a leaked API key, a customer's PII, a token that should have been redacted?

Short answer: archival is not the problem. Redaction is.

The principle is not "never remove anything from the vault." It is "don't remove the *record*." A leaked secret should be rotated first (because it's leaked regardless of what happens to the file) and then, yes, the file can be scrubbed — but the scrub replaces the secret with a placeholder and a note:

```
[REDACTED 2026-04-13: contained rotated GitHub PAT, original in encrypted archive X]
```

The record remains. What the record contains is edited with a visible edit, not a silent one. You can still answer "what was in this file last week" — the answer is "a secret, which we rotated, and which is stored elsewhere for legal hold." You have not lied to your future self. You have not pretended the history is something it isn't.

This also catches the common mistake where someone tries to "fix" a leaked secret by force-pushing the commit out of Git history. That doesn't work — the secret is already in clones, already in CI caches, already indexed by GitHub's search. The only real fix is to rotate and accept the leak as an event in the record. Silent rewrites give you a false sense of safety.

## Deletion Is Not Always Forbidden — It Is Exceptional

"Nothing is deleted" is a discipline, not a religion. There are legitimate deletions:

- A user exercises their right to be forgotten under GDPR. You delete, and you record the deletion in a "deletions" log that notes what was removed and why, without naming the person.
- A test fixture was generated with a bad random seed and is bit-rotting builds. You delete and record a note: `deleted fixtures/*.bin 2026-04-13 — regenerated deterministically`.
- A junk file — the `.DS_Store`, the accidental `nul.txt`, the 2 GB core dump — slipped in. You delete, because the file was never content, just noise.

What makes these legitimate is that they are *exceptional and acknowledged*. The system still answers "what happened here" with something better than silence. The deletion itself is a recorded event.

Contrast this with the casual `rm -rf` in a cleanup script, run on cron at 3am, wiping files that nobody decided to wipe, leaving no breadcrumb. That is the pattern to refuse.

## How to Enforce This in Code

Principles without enforcement are aspirations. A few concrete ways I've wired "Nothing Is Deleted" into actual systems:

**A pre-commit hook that blocks `rm` in vault-touching scripts.** Any script in the vault that calls `rm` without an `--archive` wrapper fails commit. If you really need to remove something, you call `archive_then_remove`, which does a timestamped `mv` and then, if you insist, deletes the moved copy after 30 days — giving you a recovery window.

**A `clear` command that cannot actually clear.** Every "clear mailbox" operation is a move. The command doesn't expose a "really delete" flag. If someone wants to delete, they have to do it manually, out of band, with full awareness that they are leaving policy.

**A filesystem watcher that complains about unlinked files in ψ/.** Not a blocker, just a log line. When someone does delete something in the vault, the log notes it. An audit once a week flags anything that shouldn't have gone.

**Retrospective archival that is not a command.** The retrospective system doesn't ask "should I archive?" It writes a new file every time. Archival is not a choice; it is the shape of the operation.

The pattern across all four: make archival the path of least resistance. The easiest thing to do should be the right thing to do. If deletion requires ceremony and archival requires none, people will do the right thing ninety-five percent of the time by default.

## The Generic Takeaway

If you only carry one sentence from this chapter into your own agent system, make it this:

> Delete is a weapon. Archive is a choice you can reverse.

Weapons have their uses. A weapon in the hand of a disciplined operator, aimed at a known target, is fine. A weapon sitting on every desk by default, labeled "tidy," is how you end up with evidence vanishing for reasons nobody remembers.

Treat deletion as exceptional. Treat archival as default. Build your tooling so the cheap action is the safe action. Ten months later, when you need to answer a question about what the system knew at a specific moment in the past, the answer will be *yes, we still have that* — and you will be able to move forward instead of guessing.

Everything else in this book — the mailbox schema, the ritual commands, the lineage model — assumes this principle is in force. Without it, state is an illusion. With it, state is a resource you can draw on when you need to, for as long as you keep the discipline.

The next principle — patterns over intentions — will tell you what to *do* with all that preserved state. This chapter told you why you have it at all.

## A Worked Example: The Mailbox Clear That Wasn't

Let me make this concrete. A few months into running the multi-agent system I draw from, one of the agents developed a habit of accumulating stale context. Every session, its `mailbox/context.md` grew a little — not pruned between tasks, just stacked. After a while the context file had become tens of kilobytes of barely-relevant notes. Reading it at session start was expensive, confusing, and often led the agent to chase threads that had been closed weeks ago.

The obvious move was "clear the mailbox." The tempting version was:

```bash
rm ψ/agents/that-agent/mailbox/context.md
echo "" > ψ/agents/that-agent/mailbox/context.md
```

Done. Clean. Fresh.

What I did instead:

```bash
ts=$(date +%Y-%m-%d-%H%M)
mkdir -p ψ/agents/that-agent/mailbox/archive/$ts
mv ψ/agents/that-agent/mailbox/context.md ψ/agents/that-agent/mailbox/archive/$ts/
cat > ψ/agents/that-agent/mailbox/context.md <<EOF
# Context — as of $(date -Iseconds)

(fresh start; previous context archived to archive/$ts/)

## Current task
(to be set by next session)
EOF
```

The active context was now a clean slate. The old context was a directory over. Nothing lost.

Two weeks later I needed to answer: *what was this agent working on the day before the auth migration broke?* I `cd`d into `mailbox/archive/`, found the right timestamp, and the answer was right there — a note I'd forgotten writing about a subtle retry condition. That note was the clue I needed to fix the regression in under an hour. If I'd run the tempting `rm`, I would have spent a full day rebuilding context from git blame and commit messages.

The five extra lines of shell the first time saved most of a day of reconstruction the second time. That's the exchange rate archival pays, and it pays it repeatedly.

## The Cultural Half Of The Principle

So far the chapter has focused on mechanics — commands, directories, hooks. But a principle that only lives in scripts is brittle. It has to live in the habits of the people (and agents) working on the system.

The cultural version of "nothing is deleted" is a few small commitments:

- When you talk about removing something, say "archive" not "delete" — even if the mechanics are technically deletion in a disposable scratch directory. The vocabulary shapes the reflex.
- When you review code, flag `rm` in vault-adjacent paths the way you'd flag a missing null check. Not hostile; just "did you mean archive?"
- When you onboard someone new, the principle goes in the first-day briefing. Not as a rule to memorize, but as a worldview to adopt: *in this system, the past is a resource.*
- When something goes wrong and the logs save you, say so out loud. Post-incidents should name the preserved evidence that made the fix possible. That's how the team learns, viscerally, that archival is not overhead — it's insurance they've already cashed in.

Culture is slower to build than scripts but lasts longer. A team that has internalized "nothing is deleted" will keep the principle alive through framework rewrites, tool changes, and the natural churn of who's in the room. A team that only has the scripts will lose the principle the first time the scripts get in the way of a deadline.

## When Archives Become Archaeology

A final thought, looking further ahead. The archival discipline you set up today is making a bet with your future self: *the record will be useful.* Most days the bet pays off modestly — a finding recovered, a context reconstructed, a commit traced. Occasionally, months or years later, the bet pays off in a way you could not have predicted.

One of the retrospectives in the system I draw from, written during an idle evening in 2025, casually mentioned a design choice that at the time was tangential. Ten months later, during an unrelated investigation, I re-read that retrospective while digging for something else. The design choice turned out to be the missing link in understanding a behavior I'd been confused about for weeks. I had no memory of the original decision. The file did.

That's the deep payoff. Archival is not just "occasionally useful for debugging." It is *the mechanism by which a system can surprise its creator with something the creator already knew.* Delete the files and you delete the capacity. Keep them and the past stays available to help — in forms you can't predict from where you're standing now.
