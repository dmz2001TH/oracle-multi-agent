# Appendix D: Debugging Cross-Tier Issues

> A diagnostic ladder for the worst kind of bus bug — the message that left tier 4 and never reached tier 1. Work down the ladder. Do not skip rungs.

---

## D.1 The Shape of a Cross-Tier Bug

A cross-tier bug is any failure that crosses at least two of the four transport tiers between sender and receiver. A message from a remote fleet peer (tier 4) lands as an HTTP call on the local `maw-js` (still tier 4), is dispatched to a tmux pane via `send-keys` (tier 3), is read by the agent whose prompt is running in that pane (tier 1 at that point), which may then write to a team inbox (tier 2) whose consumer is elsewhere. Any rung can drop a message, and the first rule of debugging these is:

> **You will want to blame tier 4. You should start at tier 1.**

The tier closest to the consumer is almost always the cheapest to inspect, and is disproportionately often where the failure actually is. A dead pane looks exactly like a broken network. An unread inbox looks exactly like a missed message. Start from the receiver end and work outward.

The ladder below is deliberately ordered from "cheapest to check, most often wrong" at the top to "most expensive to check, least often wrong" at the bottom.

---

## D.2 Rung 1 — Is the Receiving Pane Alive?

Before anything else: can you `tmux attach` to the pane the message was supposed to reach? Is there a running Claude Code process in it? Is the terminal prompt visible, or has the process died leaving a bare shell?

Commands:

```bash
tmux list-panes -F '#{session_name}:#{window_index}.#{pane_index} #{pane_current_command}'
tmux capture-pane -p -t 105-whitekeeper:oracle | tail -40
```

**What you are looking for:**

- A `node` or `claude` process in `pane_current_command`. If the process is `bash` or `zsh`, the agent is not running; the pane is idle.
- Recent output in the captured buffer. If the last line is from hours ago, the pane is likely hung.
- If the pane does not exist at all, the name may have drifted — see chapter 11 on collisions and chapter 12 on discovery.

**Remedy:** `maw wake <agent>`, `claude -p --resume <session-id>`, or a fresh pane. Most rung-1 failures dissolve here.

Roughly *40% of cross-tier bugs stop at rung 1*. Checking cheap.

---

## D.3 Rung 2 — Is the Inbox JSON Healthy?

If the pane is alive and the agent is polling its inbox, the next place a message goes missing is the inbox file itself.

Commands:

```bash
cat ~/.claude/teams/<team>/inboxes/<agent>.json | jq .
```

**What you are looking for:**

- Does the file parse as JSON? Malformed JSON is the #1 rung-2 failure and usually means a writer crashed mid-write.
- Does `schema_version` match something the reader understands (see Appendix B)?
- Is your message in `messages`? If yes, is `read_at` null? If the message is present and marked read but the agent never acknowledged it, the agent's reader code is at fault, not the transport.
- Is `last_write_at` recent? If the file has not been written in hours but you expect fresh messages, the writer has failed upstream.

**Remedy:**

- Malformed JSON: restore from the most recent `<file>.tmp` if it exists; otherwise `jq -e .` to find the break, and edit manually. Writers should be using atomic-rename (Appendix B); if you see a half-written file, file it as a writer bug.
- Message present, unread, agent alive: the agent is not polling. Check the agent's polling loop.
- Message absent: the writer never got here; move to rung 3.

Another ~25% of cross-tier bugs resolve at rung 2. The inbox is a file; a file tells no lies.

---

## D.4 Rung 3 — Did the `send-keys` Actually Fire?

If the message should have been injected into a pane and wasn't, check whether `tmux send-keys` ran and whether the pane accepted the input.

Commands:

```bash
journalctl --user -u maw-js --since "10 minutes ago" | grep 'send-keys\|hey'
tmux capture-pane -p -t <target> | tail -10
```

**What you are looking for:**

- A recent log line showing `send-keys -t <target>` with the expected target.
- The pane's last lines include the text that was sent, or at least a prompt visible at the time `send-keys` ran.
- No shell errors ("can't find session") in the log.

**Common failures at this rung:**

- **Target mismatch.** The pane name changed, or the session was renamed. `fleet doctor` will catch some of these; `tmux list-panes` catches the rest.
- **Escape quoting.** The message contained a character that broke the `send-keys` argument. In logs this shows up as `send-keys: unknown option -- ...`. Wrap the payload more carefully.
- **Pane in a raw-mode editor.** If the target pane has `vim` open, `send-keys` happily pushes keystrokes into the editor. This is almost never what you want; check that the pane is at a shell/Claude prompt before delivering.

**Remedy:** Fix the target name, fix the quoting, or retry after the pane returns to its expected state.

About 15% of cross-tier bugs live here.

---

## D.5 Rung 4 — Did the Fleet Layer Route Correctly?

If the message crossed machines and went astray, the next suspect is the fleet resolver and the routing it produced. This is where #239-class bugs (chapter 11) live.

Commands:

```bash
maw fleet doctor
journalctl --user -u maw-js --since "10 minutes ago" | grep -i 'route\|resolve\|hey'
```

**What you are looking for:**

- The log line that shows which peer (or local pane) the resolver picked.
- Whether that peer matched your intent.
- Whether `fleet doctor` flags any collisions or potential collisions for the name in question.

**Common failures:**

- **Substring match.** A bare name matched a local pane as a substring. The sender thought they were talking to a peer; the resolver talked to a local window. See chapter 11 for the fix — always use `node:agent`.
- **Stale peer IP.** The fleet entry points at an IP the peer no longer has. `maw fleet doctor` will show `reachable: false` with the address; the remedy is to refresh the endpoint (static DNS, dyn-DNS update, or manual edit).
- **Wrong-node identity.** You sent to `whitekeeper` but `/api/identity` at that address returned `{"node": "boonkeeper"}`. The config says one thing, the peer says another. This is a configuration bug; the peer's `node` field is authoritative.

**Remedy:** Rename, re-IP, re-probe, and re-send with an explicit `node:agent` form.

Around 10% of cross-tier bugs are routing bugs. They are disproportionately high-blast-radius because a misrouted message can produce a *plausible-but-wrong* reply — the kind of failure that goes undetected longest.

---

## D.6 Rung 5 — Is WireGuard Actually Passing Packets?

If the routing layer resolved correctly but the HTTP call never landed on the peer, the transport is at fault. This is the rung where people start, and the rung that is almost always innocent.

Commands:

```bash
sudo wg show
ping -c 3 10.7.0.3
curl -s http://10.7.0.3:51910/api/identity
```

**What you are looking for:**

- `wg show` reports a recent `latest handshake` for the peer (< 3 minutes).
- `ping` succeeds with low, stable latency.
- The `/api/identity` probe returns within ~100 ms with the expected node name.

**Common failures:**

- **Stale handshake.** Last handshake > 10 minutes ago means the tunnel is gone. Common cause: the peer slept, or its public endpoint changed. `wg-quick down wg0 && wg-quick up wg0` on the offline side often resurrects it.
- **Routing table hole.** `ping` succeeds but HTTP hangs. The overlay is up but something is filtering port 51910. Check `iptables -L` and `ufw status`.
- **Endpoint rot.** The peer's public endpoint changed and the dyn-DNS record did not update. `wg show` will report no handshake; `resolvectl query <endpoint-host>` tells you whether the name resolves at all.
- **Clock skew.** Rare but real: WireGuard uses time-based replay protection, and a peer whose clock is more than a few minutes off from real time will fail handshakes silently. `timedatectl` on both sides.

**Remedy:** Restart the interface, repair the endpoint, fix the filter, fix the clock.

About 8% of cross-tier bugs are actual transport bugs. They feel more common because they are alarming when they happen.

---

## D.7 Rung 6 — The Doctor's Opinion

After walking rungs 1–5 without a finding, pull the diagnostic that aggregates them:

```bash
maw fleet doctor
```

`fleet doctor` re-runs identity checks, collision detection, reachability probes, and agent enumeration. It frequently catches things the individual rungs miss, because it cross-references them — a peer that is reachable but has zero agents, for instance, is invisible to rungs 1–5 but obvious to the doctor. See chapter 12 for the full output format.

The remaining ~2% of cross-tier bugs need the doctor *plus* a careful read of `journalctl` across both peers simultaneously. They are rare, and they are almost always interesting; save them for retros.

---

## D.8 A Worked Example

**Symptom.** `maw hey whitekeeper:oracle "status?"` on `boonkeeper` returns `{"delivered":true}` but the oracle pane on whitekeeper shows nothing new.

**Rung 1.** SSH into whitekeeper, `tmux capture-pane -p -t 105-whitekeeper:oracle | tail -10`. Pane is alive, shows "status?" from two minutes earlier. The message *did* arrive; the agent just hasn't responded. Rung-1 diagnosis: the agent is idle or thinking. Wait 30 seconds — answer appears. **Not a bug.** The transport did its job.

Had the rung-1 check shown no "status?" in the buffer at all, we would have moved to rung 3 (tmux log for send-keys on whitekeeper).

Had the target pane been missing entirely, we would have jumped to rung 4 (fleet doctor, agent enumeration).

Had the `/api/hey` POST from boonkeeper's side shown no connection, we would have jumped to rung 5 (wg show, ping, curl).

The ladder is deliberately linear. Work it.

---

## D.9 Tools Worth Aliasing

Three small aliases save more time than they should:

```bash
alias dtr='tmux capture-pane -p -t'                                 # "doctor, tmux, recent"
alias lg='journalctl --user -u maw-js --since "10 minutes ago"'
alias fd='maw fleet doctor'
```

If the fleet is behaving oddly, the investigation almost always looks like `fd; lg | less; dtr <target>`. Making those one- or two-letter invocations keeps the loop tight.

---

## D.10 Post-Mortem Hygiene

Every cross-tier bug that took more than ten minutes to diagnose earns a post-mortem entry. The shape that works:

- **Symptom.** One sentence, user-facing.
- **Expected.** What should have happened.
- **Actual.** What did happen.
- **Rung.** Which rung of the ladder caught it.
- **Root cause.** One paragraph.
- **Prevention.** What changed in code, config, or convention.

Keep these in the repo next to the docs, not in a personal note. The next person who hits the bug — present or future self, or a teammate — should be able to find the write-up before they reach rung 5.

`fleet doctor` was born from post-mortems. The dormant/offline distinction was born from post-mortems. Exact-token name matching (chapter 11) was born from the mother of post-mortems. The discipline pays off, with interest, over any horizon longer than a week.

---

## D.11 A Last Word on Flake

A real cross-tier system has some irreducible flake: a packet drop, a keepalive miss, a brief CPU stall on the receiver that causes a send-keys to land a millisecond after a prompt refresh and show up in the wrong buffer. The ladder above does not pretend to eliminate these; it aims to make them cheap to diagnose.

The distinction worth internalising: **intermittent failures that resolve on retry are the expected behaviour of a peer-to-peer system, and should be handled by the retry logic, not by the human**. A single `fleet doctor` run showing a dormant peer is not a bug. Three runs in a row showing it is a symptom. Six runs in a row, without any external change, is an actual incident. Triangulate on the rhythm, not the single data point.

That last habit — knowing when to shrug and when to open the laptop — is what turns a working federation from a thing that mostly works into a thing you actually trust. The rest of this book is the mechanics. Rung one through six is how you keep the mechanics honest.
