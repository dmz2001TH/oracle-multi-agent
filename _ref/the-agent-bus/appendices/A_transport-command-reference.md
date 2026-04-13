# Appendix A: Transport Command Reference

> A one-page cheat-sheet of every command used across the book, arranged by tier, with the scope, cost, and observability each one carries.

---

## A.1 How to Read This Reference

Each entry has four fields:

- **Tier** — which transport layer in the four-tier model the command inhabits. Tier 1 = in-process Agent tool. Tier 2 = file-based mailbox. Tier 3 = tmux pane messaging. Tier 4 = federation over WireGuard.
- **Scope** — which agents the command can address. "Local" means the same process or machine. "Cross-pane" means any agent inside the same tmux session. "Cross-node" means any peer in the fleet.
- **Cost** — token cost, wall-clock cost, and whether the cost hits the caller's context window or not.
- **Visibility** — who sees the exchange. "Invisible" means only the caller's conversation. "Team-visible" means anyone monitoring the team. "Pane-visible" means anyone attached to the tmux session.

Use the reference to pick the right transport when you already know the shape of the message you want to send. The chapters tell you *why*; this appendix tells you *which command*.

---

## A.2 Tier 1 — In-Process

### `Agent({ description, subagent_type, prompt })`

- **Tier:** 1
- **Scope:** Spawned inside the caller's process. No external state.
- **Cost:** High-to-very-high token cost — subagent reads files, produces output, and the caller pays for both ends. Wall clock: 15 s (Haiku, short prompt) to 5 min (Opus, long research task).
- **Visibility:** Invisible to anyone outside the caller's session. No trace after the call returns except what the caller explicitly records.
- **When:** One-shot research, parallel codebase reads, architecture debates, ad-hoc summarisation.
- **Gotchas:** Subagent cannot coordinate with peers. Dies at end of call. Token cost is 3–7× the cost of doing the same work directly.

### `TeamCreate({ name, lead })` / `TeamDelete`

- **Tier:** 2 (establishes the structures that tier-2 communication uses)
- **Scope:** Creates a namespace shared across subsequent spawns and messages.
- **Cost:** ~0 tokens to call. Negligible wall-clock.
- **Visibility:** Team-visible. Members of the named team see the team state.
- **When:** Any task requiring more than one agent with shared task state.

### `TaskCreate({ subject, owner, activeForm })` / `TaskUpdate` / `TaskList`

- **Tier:** 2
- **Scope:** Shared within a team; readable to the lead and to the assigned owner.
- **Cost:** Nearly free.
- **Visibility:** Anyone with `TaskList` visibility.
- **When:** Breaking work into trackable units; coordinating parallel writers on a multi-chapter book; recording progress that must survive a single agent's session.

---

## A.3 Tier 2 — File-Based Mailboxes

### `SendMessage({ to, summary, message })`

- **Tier:** 2
- **Scope:** Another named agent in the same team.
- **Cost:** Small — a single JSON append plus a polling read on the receiver side.
- **Visibility:** Team-visible. Messages are written to an inbox JSON file (`~/.claude/teams/<team>/inboxes/<agent>.json`), readable to humans and to subsequent agents.
- **When:** Coordinating peers during active work. Sharing a finding. Passing a task hand-off.
- **Gotchas:** `to: "*"` is a broadcast; cost is linear in team size. Do not use for routine chatter.

### Inbox append (raw JSON)

- **Tier:** 2
- **Scope:** Any agent whose inbox path you know.
- **Cost:** One file-system write. No tokens.
- **Visibility:** Pane-visible if the receiver has their inbox tailed; otherwise visible when the receiver next polls.
- **When:** Cross-team messaging, machine-generated notes, scripted fan-out.
- **Gotchas:** You own the schema. See Appendix B.

### Standing-order file (`~/.claude/<agent>/standing-orders.md`)

- **Tier:** 2
- **Scope:** Self-addressed. The agent reads this on every wake.
- **Cost:** Zero at write time; small token cost on every subsequent wake.
- **Visibility:** Visible to anyone with filesystem access. Readable and versionable.
- **When:** Persistent behaviour changes, long-running context, reminders that must survive any single session.

---

## A.4 Tier 3 — Tmux Pane Messaging

### `tmux send-keys -t <session>:<window>.<pane> '<text>' Enter`

- **Tier:** 3
- **Scope:** Any tmux pane on the current machine.
- **Cost:** Microseconds of wall-clock; zero tokens on the sender side. The *receiver* pays token cost to process the injected input.
- **Visibility:** Pane-visible. Anyone attached sees the keystroke appear.
- **When:** Waking an agent, sending a command to a long-running session, poking an unresponsive pane.
- **Gotchas:** Escaping is load-bearing. Quotes, backticks, and semicolons need care.

### `maw hey <agent> "<message>"`

- **Tier:** 3 (local) or 4 (cross-node, see below)
- **Scope:** Local agent if the name is bare and matches a local pane; remote agent if the form is `node:agent`.
- **Cost:** Negligible on the sender side. Receiver pays token cost to read the injected message.
- **Visibility:** Pane-visible. Also logged in `maw-js` journal.
- **When:** The default "wake another agent" command across the book.
- **Gotchas:** Bare names resolve to local first — see chapter 11. Use `node:agent` whenever ambiguity is possible.

### `maw wire <agent> "<message>"`

- **Tier:** 3, debug-only
- **Scope:** Same as `maw hey`, but without the `/api/hey` layer — it drops directly to `tmux send-keys` on the current machine.
- **Cost:** Same as `send-keys` directly.
- **Visibility:** Pane-visible. Not logged the way `hey` is.
- **When:** Diagnosing a broken `hey`. Sending input that would be filtered by the API layer. Rarely in production scripts.
- **Gotchas:** Bypasses the safety checks. Use sparingly.

### `tmux capture-pane -p -t <target>`

- **Tier:** 3
- **Scope:** Read a pane's visible buffer.
- **Cost:** Zero tokens. Fast wall-clock.
- **Visibility:** Local to the caller.
- **When:** Checking whether an agent has answered. Grabbing recent output for a diagnostic.

---

## A.5 Tier 4 — Federation

### `maw hey <node>:<agent> "<message>"`

- **Tier:** 4
- **Scope:** Any agent on any reachable peer in the fleet.
- **Cost:** Sender pays nothing. Network round trip ~10–30 ms on a healthy overlay. Receiver pays token cost to process.
- **Visibility:** Pane-visible on the remote machine. Logged on both sides.
- **When:** Any cross-machine coordination. The canonical federation command.
- **Gotchas:** Requires the peer to be `reachable` (not merely "known"). See chapter 12.

### `GET http://<peer>:<port>/api/identity`

- **Tier:** 4 (diagnostic)
- **Scope:** Single peer.
- **Cost:** ~5–10 ms round trip. No tokens.
- **Visibility:** Local to caller.
- **When:** Fleet health checks. `fleet doctor` internals. Debugging which node is actually at an IP.

### `POST http://<peer>:<port>/api/hey`

- **Tier:** 4
- **Scope:** Sends a message to an agent on the target peer.
- **Cost:** Same as `maw hey <node>:<agent>` — in fact, this is what the CLI calls under the hood.
- **Visibility:** Logged both ends.
- **When:** Scripted federation. CI hooks. Non-CLI tooling that wants to talk to the bus.

### `maw fleet list` / `maw fleet doctor`

- **Tier:** 4 (diagnostic)
- **Scope:** All peers in `~/.config/maw/fleet/`.
- **Cost:** Parallel probes; wall-clock bounded by the slowest peer's probe timeout.
- **Visibility:** Local.
- **When:** Start-of-day health check. After any fleet config change.

### `maw fleet rename <old> <new>`

- **Tier:** 4 (config, not transport)
- **Scope:** Local fleet directory.
- **Cost:** A few file rewrites.
- **Visibility:** Local. Distributes via whatever mechanism syncs the fleet directory.
- **When:** Canonical renames. Not to be confused with aliasing — there are no aliases.

---

## A.6 Cross-Tier Operations

Some operations span more than one tier. They earn their own entries.

### `claude -p "<prompt>" [--resume <session-id>]`

- **Tier:** 3 (runs inside a tmux pane) but the conversation state lives in the Claude Code session database.
- **Scope:** A new or resumed Claude Code conversation.
- **Cost:** Full conversation token cost.
- **Visibility:** Pane-visible. Resumable.
- **When:** Starting a real agent that lives in a pane. Waking a dormant pane with a concrete task.
- **Gotchas:** `--resume` requires the session ID, not the pane name. See chapter 9.

### Hook-driven command rewriting (`rtk`)

- **Tier:** Orthogonal. Rewrites other commands before they run.
- **Scope:** The shell within the Claude Code process.
- **Cost:** Negative — `rtk` exists specifically to cut token costs of verbose command output.
- **Visibility:** Transparent to the caller.
- **When:** Always on by convention. See the RTK reference in the root CLAUDE.md.

### Retrospective write (`rrr`) / forward (`forward`)

- **Tier:** 2 (files) but touches cross-session state
- **Scope:** The session's diary directory.
- **Cost:** Minor file writes.
- **Visibility:** Durable across sessions. Read by future agents on wake.
- **When:** End-of-session artefacts. Handoffs.

---

## A.7 Decision Shortcuts

If you cannot remember which tier you want, use these shortcuts.

- **"I need a one-shot answer, now."** → Tier 1 (`Agent`).
- **"I need another agent to know something durably."** → Tier 2 (inbox or standing orders).
- **"I need to nudge a running agent on this machine."** → Tier 3 (`maw hey <agent>`).
- **"I need to nudge an agent on a different machine."** → Tier 4 (`maw hey <node>:<agent>`).
- **"I need a pane that isn't reachable."** → Chapter 12's dormant/offline model; check `fleet doctor` before blaming the command.

---

## A.8 What You Will Not Find Here

A few commands the book consciously does not endorse, with the reason:

- **Hosted broker SDK calls** (NATS, Kafka, Redis Streams) — the book is about avoiding these. If you already have them in your stack, use them; if you are choosing now, choose the overlay.
- **SSH-and-eval tricks** — easy to reach for, terrible to audit. If you need a remote operation, publish it as `/api/<verb>` on the remote node and call it explicitly.
- **Unbounded broadcast** — `SendMessage({ to: "*" })` exists but should be rare. Fan-out via explicit recipient lists keeps the cost linear in the work, not in the team size.

---

## A.9 Versioning Note

Commands in the `maw-js` family live under a semantic-version contract; a deprecation of a command surfaces in its help text one minor version before the command is removed. The set of commands in this appendix is current as of `maw-js/0.18.x`. Future editions of the book will update this appendix wholesale rather than patching it in place, since transport-layer ergonomics are exactly the kind of thing that *should* evolve with the system.

The underlying principles — tiered scope, explicit addressing, health-probed reachability, diagnostic sidecars — are durable. Whichever commands name them next year will still obey the same shapes.
