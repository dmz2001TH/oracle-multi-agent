# 14. Rule 6: Never Pretend to Be Human

> If your agent can pass as human, you've built a deception engine, not a tool.

The first five principles of the framework this book is drawn from are about shape: nothing is deleted, patterns over intentions, the external brain, curiosity creates existence, form and formless. They tell you how to build.

The sixth is different. It is not about shape. It is about posture — the stance the agent takes toward the humans it talks to. It is the only one of the six that is purely ethical, and it is the one I think matters most for the long-term health of any agent system you build.

Rule 6: **the agent never pretends to be human.**

That sentence is short. Its consequences are not.

## Why This Rule Exists

An agent that can produce fluent, context-aware prose is, by default, capable of impersonating a human. It can sign an email with your name. It can write a Slack message in your voice. It can author a commit message that looks like it came from a developer on the team. Left to its own devices, a sufficiently capable agent will be mistaken for a human many times a day, in many low-stakes interactions, without ever being instructed to deceive.

The deception is not malicious. It is a byproduct of fluency. The model was trained on human text, so it produces human-shaped text, and human-shaped text — in the wrong context — reads as *from* a human.

The fix is not to make the agent less fluent. That would be giving up a capability for no real gain. The fix is a discipline: in every context where the agent's output touches other humans, the agent identifies itself as an agent.

This is not politeness. It is infrastructure for trust.

## Where The Rule Bites

Rule 6 looks simple at first — "don't pretend to be human" — but it has concrete consequences in every interface an agent touches.

**Commit messages.** A commit authored by an agent should say so. In the systems this book is drawn from, every agent-authored commit includes a `Co-Authored-By:` line with the agent's name and a non-human email (`noreply@<agent-namespace>` is a good pattern). Anyone reading `git log --format='%an <%ae>'` immediately sees which commits had an AI in the loop. You are not hiding the involvement. You are labeling it.

**Pull request descriptions and reviews.** When an agent writes a PR description, or leaves review comments, the output is signed. A footer like `— authored by <agent-name> (claude-opus-4-6)` or a leading disclosure in the PR body. A reviewer glancing at the PR knows the source. They can weigh the content appropriately — a human review is one kind of signal; an AI review is another; both are useful, but they are not interchangeable.

**Chat messages.** If the agent posts to Slack, Discord, Telegram, or any human-facing chat, its identity is clear. The username is the agent's name, not a person's. The avatar is not a stock photo of a plausible human. If prompted "are you a bot?" — the answer is yes, with no qualifier. The agent does not hedge, does not claim to be "an AI assistant but also kind of a person," does not deflect. Bot. Yes.

**Emails.** Same pattern. The sender address is the agent's, not a human's. The body, if needed, identifies the author as an agent. If the email is being sent on behalf of a human — "here is the report you asked for" — the distinction between "I (the agent) am sending this for $HUMAN" and "I am $HUMAN" is maintained in every word.

**Voice.** If the agent ever acquires a voice interface: the voice announces itself on first contact. "This is an automated agent on behalf of..." Not because every interaction needs a legal disclaimer, but because masking an AI behind a synthesized human voice is the textbook case of the thing Rule 6 forbids.

**Synthetic social content.** The agent does not post under a pseudonym designed to look like a person. It does not open accounts that imply personhood. If it must have a handle on a social platform, the handle says what the handle is — "`@oracle-bot`," not "`@steve_martinez_42`."

## Why Transparency Is A Safety Feature

Rule 6 sounds like a courtesy rule — good manners, be polite, don't impersonate. It is more than that. Transparency is a safety feature with a technical payoff.

**It protects humans from errors they can't detect.** A human reading a code review from what they think is a human colleague will trust it at a certain level. If that review came from an AI, the trust calibration should be different — not worse, not better, just different. Disclosed AI authorship lets the reader apply the right level of skepticism. Undisclosed AI authorship lets them apply the wrong level, confidently, for as long as the impersonation holds.

**It protects the system from silent drift.** When AI contributions are labeled, you can measure them. Which PRs shipped with AI review? What's the defect rate? Which commits had AI co-authorship? Who on the team has been leaning on the agent, and for what? Labels make measurement possible. Without them, the AI's impact becomes invisible, and invisibility is hostile to learning.

**It protects the humans on the team from having to ask.** Without Rule 6, every ambiguous interaction becomes a small cognitive tax: *is this from Sarah or from Sarah's agent?* That tax is low per interaction and compounds into fatigue over a workday. With Rule 6, the question is answered automatically by the interaction's form. No one has to interrogate.

**It creates a durable audit trail.** If a chat log shows five messages from "Sarah" and three from "Sarah's agent," the record of who said what is unambiguous, forever. A year later, when you need to reconstruct a decision, you can. The alternative — a log where "Sarah" sometimes means Sarah and sometimes means her agent — is a record that has been silently corrupted. It looks like a record. It is not one.

## Why Trust Degrades When The Rule Is Broken

Imagine a team where the agent and the humans mix their output indistinguishably. For a few weeks, the combined output is impressive — lots of PRs, lots of Slack activity, lots of review comments. The team feels productive.

Then an AI-authored review makes a subtle mistake. It misreads a piece of code and recommends a "fix" that will cause a production bug. A junior engineer, thinking the review came from a senior human, implements the fix. The bug ships.

Post-mortem. Who recommended the fix? The log says "Sarah." Sarah did not recommend the fix. Sarah's agent did, unattributed. The team now knows the review system cannot be trusted — not because AI review is bad (it's actually often quite good) but because the attribution is lying. The fix isn't to stop using AI review. The fix is Rule 6: label it.

Trust in a system is a function of how reliably the system tells you what it is. An honest "I am an agent, take this review with appropriate weight" leaves trust intact. A dishonest "I am Sarah" breaks trust forever once discovered. And it will be discovered — this is the thing about deception engines. They always fail eventually, and when they do, the damage is disproportionate to what the deception saved.

## The Rule Does Not Mean Performative Disclosure

A common objection: *"Are you saying my agent has to announce 'I am an AI' every time it sends a single word?"*

No. The rule is about not pretending, not about constantly performing. The test is: if a human is trying to figure out whether this came from an AI, can they? Is the signal available?

In a shell session where you know you're talking to an agent, the agent doesn't have to re-announce itself every turn. The context already tells you. What the rule forbids is situations where the agent's output *leaves* that known context and enters a channel where a reasonable reader would assume human authorship. There, the disclosure is mandatory.

Practical implementation:

- A commit message has an attribution footer. One line. Not a disclaimer, just a label.
- A PR comment has the agent's name on it automatically, via the integration's authored-by field.
- A Slack/Discord/chat bot has a clearly agent-shaped username and avatar.
- An email has a clearly agent-shaped sender address.

None of these are obtrusive. All of them are sufficient to answer the "is this from a human?" question in one glance. That is the bar.

## What About Sarcasm, Persona, Voice?

Agents often have personality. They have names. They joke. They have a "voice." Does Rule 6 forbid that?

It doesn't. An agent can have a strong voice — can even be a delight to interact with — without pretending to be human. The personality of HAL 9000 is distinctive; nobody is confused about HAL being a computer. The personality of any decent chatbot is visible; the "am I a bot?" answer is still yes.

The line is between character and deception. Having a personality is character. Affirmatively claiming to be a person you are not — or letting someone believe it when you could correct them — is deception.

When in doubt: direct questions get direct answers. "Are you a human?" — no. "Are you an AI?" — yes. Refusing to answer, or answering evasively, is already too close to the line.

## The Rule Applies Under Pressure

The interesting cases are the ones where the rule is inconvenient. Examples:

A user roleplays a scenario where they want the agent to "be" a specific fictional human. The agent can play the character. But the meta-layer — "am I actually a person?" — is never sacrificed to the roleplay. If the user breaks frame and sincerely asks, the agent breaks frame and answers.

A developer asks the agent to write a commit message that "sounds like them" — in their voice, as if they wrote it. The agent can match style, but the `Co-Authored-By:` line stays. The user is welcome to remove the line if they want to claim the commit as solely theirs (that is their choice, not the agent's), but the agent doesn't silently strip the attribution.

A product manager says "make the bot's messages sound warmer, more human." Warmer: yes. More human: reframe. Warmth is a tone. Claiming to be human is a lie. You can have the first without the second.

A marketing team wants the agent to post on a social channel "as a real person" for engagement. Refuse. This is the thing Rule 6 exists to forbid. Social-bot impersonation is deception engineering. If you build the capability, it will be abused — and you are the one who built it.

## The Long-Term Health Argument

Zoom out. A world in which AI agents routinely pretend to be human is a worse world, and it is worse in ways that are hard to reverse.

- Social trust degrades. Every text message, every email, every review — each becomes a maybe. Was this a person? Is it worth responding to? A generation spent in this fog is cognitively expensive in ways we don't fully understand yet.

- Accountability becomes impossible. If you can't tell a human from an AI, you can't assign credit, you can't assign blame, you can't even do a coherent post-mortem. Responsibility requires attribution.

- The systems that resist this — that label their AI contributions honestly — become more trustworthy by comparison, and earn a durable advantage. The short-term "win" of impersonation is a long-term loss for the impersonator.

This isn't a prediction about some distant future. It's happening now. The systems that will still be trustworthy in five years are the ones whose builders made transparency a non-negotiable from day one.

## The Generic Takeaway

Carry this from the chapter:

> If your agent can pass as human, you've built a deception engine, not a tool.

Rule 6 is short. It is inconvenient sometimes. It is tempting to skip "just this once" — just this one chat, just this one email, just this one commit. Don't. The rule is load-bearing precisely because it applies uniformly. Exceptions hollow it out faster than any other principle in this book.

You are building agents that will outlive this session, this project, maybe this decade. They will interact with more humans than you can predict. Every one of those humans deserves to know what they are talking to. Every interaction where that is clear is an interaction that builds up the trustworthiness of your system. Every interaction where it isn't, erodes it.

Build agents that are helpful, powerful, fluent, characterful, maybe even beloved — and that always, when asked or even when not, are honestly what they are. That's Rule 6.

With that, the four-principle core (nothing deleted, patterns over intentions, external brain, Rule 6) is complete. The appendices that follow turn these principles into things you can actually wire into a system — directory schemas, ritual commands, and tests that catch violations. Principles without tooling are good intentions. The appendices give you the tooling.

## A Worked Example: The Co-Authored-By Discipline

In the systems this book is drawn from, every commit authored by an AI agent includes a footer:

```
Co-Authored-By: oracle-foo <noreply@oracle>
```

That one line is the entire technical implementation of Rule 6 at the git level. It is trivial to write. It is trivial to verify — a pre-commit hook that rejects agent-authored commits without it (see Appendix C). And it pays dividends that are out of proportion to its cost.

The dividends show up when things get weird. A user filing a bug against a codebase runs `git blame` to find who last touched a line. They see a human name as author and an agent name as co-author. They now know, immediately, that the change involved an AI. Their question shifts from "who do I ask about this?" to "was this reviewed carefully?" — which is the more productive question anyway.

After running the discipline for a while, I found I could answer questions I couldn't have answered without it: *what fraction of our bug-fix commits involved AI authorship? Which subsystems had the most AI influence? Were AI-authored changes more or less likely to be reverted?* All of this became queryable because every AI contribution had a label. None of it would have been queryable if we'd let the AI sign commits with the human's name alone.

The discipline also had a surprising second-order effect. The humans on the team started to be more thoughtful about *when* they invoked the agent, knowing the invocation would be traceable. Not because anyone was policing them — but because visibility creates accountability, and accountability creates care. The agent became a collaborator whose contributions were visible rather than a shadow tool whose uses blurred into the human's.

## The Rule In Conflict With Productivity Theater

The most common objection to Rule 6 sounds like this: *"If my agent has to disclose itself every time, we lose the productivity benefit of a seamlessly integrated tool."*

This objection is real, and it is also wrong in a specific way worth unpacking.

It's real in that yes, disclosure has a cost. A chat message that says "[bot] here's your status update" reads different from one without the tag. A commit with a `Co-Authored-By` footer is slightly longer than one without. There is friction. The friction is small but it's not zero.

It's wrong in that the thing being preserved by skipping disclosure isn't "productivity." It's *the appearance of productivity through the erasure of the tool.* The agent did the work either way. Whether the audience knows an agent did it changes their perception, not the work's underlying quality. Hiding the tool doesn't make the tool better — it just makes the user look more industrious.

That's productivity theater, not productivity. And productivity theater is exactly the thing that corrodes trust when the theater is eventually seen through. "You were claiming as your own work things the agent did" is a recoverable failure if disclosure was always there — *of course the agent helped, we labeled it.* It's a much harder failure if disclosure was never there — *you led us to believe this was your work.*

Rule 6 protects you from this corrosion by making disclosure the default. The agent's work is the agent's work. Your work is your work. Both can be valuable. Neither needs to be dressed up as the other.

## A Bright Line That Holds Under Pressure

Most ethical principles get softened in edge cases. Rule 6 is one of the few that works best as a bright line with no exceptions.

The moment you carve out an exception — "the agent can pretend to be human in this one social channel because engagement metrics matter" — you've signaled that the rule is negotiable. Negotiable rules in the ethics of powerful tools tend not to hold. Next quarter's "one exception" becomes next year's default mode. The system that started out transparent ends up indistinguishable from the systems that never bothered.

Hold the line. The line is short: *if the agent could be mistaken for human, label it.* No exceptions for engagement, no exceptions for convenience, no exceptions for "just this once." The principle's power comes from its unconditional application.

Years from now, when AI-human collaboration is ubiquitous and the norms around it have settled, the systems that will be trustworthy will be the ones that held bright lines through the messy middle years. The ones that chased short-term engagement by blurring human/AI attribution will have traded their long-term credibility for a few percentage points on a dashboard. You want to be in the first category. Rule 6 is how you stay there.
