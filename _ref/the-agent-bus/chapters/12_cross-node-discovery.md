# Chapter 12: Cross-Node Discovery and Fleet Health

> "Discovery is the hardest part of federation. Invest in the health-check before you invest in the clever routing."

---

## 12.1 The Two Hard Problems Are Both Discovery

The cliché holds that the two hard problems in distributed systems are cache invalidation, naming, and off-by-one errors. In a multi-agent federation there is a narrower version: the hard problems are *who is out there* and *are they still alive*. Both are discovery problems; the first is structural and the second is temporal.

This chapter is about solving both without a service mesh. By the end you should be able to answer three questions for a running fleet:

- Which peers does this machine believe it can talk to, and where does that belief come from?
- For each peer, is it currently reachable, dormant, or offline — and what do those words mean precisely?
- When discovery is wrong, how do you find out, and how do you fix it without restarting half the fleet?

The answers come out of real operation of a four-machine federation (`boonkeeper`, `whitekeeper`, `colab`, plus whichever laptop happened to be on that day). The patterns generalise to any peer-to-peer agent bus.

---

## 12.2 Fleet Config Is a Directory, Not a File

The first design decision that paid for itself was choosing a *directory* as the source of truth for fleet membership, rather than a single configuration file. Each peer is declared in its own JSON file under `~/.config/maw/fleet/`, named by a numeric prefix and a canonical name:

```
~/.config/maw/fleet/
├── 100-boonkeeper.json
├── 101-mawjs.json
├── 102-mawui.json
├── 105-whitekeeper.json
├── 106-arra_oracle_v3.json
├── 107-boon3.json
└── 108-hello.json
```

One file per peer. Adding a peer is adding a file. Removing a peer is deleting a file. Re-ordering is a filesystem operation. Every diff is local to one peer's block of information; conflicts on one peer's config never collide with edits to another.

The contents of each file are minimal:

```json
{
  "name": "whitekeeper",
  "windows": [
    { "name": "whitekeeper-oracle", "repo": "Soul-Brews-Studio/whitekeeper-oracle" }
  ],
  "sync_peers": ["boonkeeper"],
  "budded_from": "boonkeeper",
  "budded_at": "2026-04-11T03:01:06.196Z"
}
```

Notice what is *not* in there: no IP address, no port, no reachability metadata. The entry describes *identity* and *lineage* — who this peer is, what sessions live on it, where it came from — but not how to reach it in the current network topology. Network identity is resolved separately (often from WireGuard config, often from DNS) and layered on top at runtime. Keeping the two kinds of information separate is the second design decision that paid for itself; it means a peer moving to a new endpoint is a network-layer change, not a config-layer change.

The generic lesson, and it applies far beyond fleet config: **identity is static, reachability is dynamic, and storing them together makes both harder**.

---

## 12.3 The `/api/identity` Probe

Every node that participates in the federation exposes a tiny HTTP endpoint:

```
GET /api/identity → 200 OK
{
  "node": "whitekeeper",
  "version": "maw-js/0.18.3",
  "started_at": "2026-04-12T09:14:22Z",
  "agents": ["oracle", "scanner", "book-writer"]
}
```

Three things make this endpoint load-bearing:

**It is cheap.** A GET on a local Bun server returns in under 5 ms. On the WireGuard overlay, under 10 ms. A probe sweep across ten peers completes in roughly the time a human notices.

**It is authoritative about identity.** The `node` field is what that machine *believes itself to be*. If a local fleet entry says the peer at `10.7.0.3` is `whitekeeper`, and `/api/identity` at that address returns `{"node": "boonkeeper"}`, that is a configuration bug worth loudly flagging — somebody swapped IPs, somebody renamed a machine, somebody pointed at the wrong peer. The probe is the way this is caught within seconds rather than after the first wrong delivery.

**It enumerates agents.** The `agents` array is the authoritative list of what can be addressed on that machine right now. This is what lets `maw hey whitekeeper:scanner` fail fast with "no such agent on that node" when `scanner` has been renamed, shut down, or never existed there.

The probe's design follows a general rule worth internalising: **health-checks should be identity-checks, not ping-checks**. A TCP handshake tells you the port is open. An HTTP identity probe tells you the *right* service is listening on that port *and* believes itself to have the *right* name. The difference is most of the value.

---

## 12.4 Stale-Peer Detection

Fleet membership rots. A peer that was provisioned six months ago gets decommissioned, its config entry lingers, and a year later a new developer onboards and asks "what is `107-oldbox`, nobody on the team has heard of it." The answer is always embarrassing: somebody forgot to delete the file.

The technique that keeps membership honest is *probe-on-load* and *probe-on-schedule*. Both use the same `/api/identity` endpoint.

**Probe on load.** Every time `maw-js` starts, or `fleet list` is called, or a cross-node command is issued, the local side does a fast concurrent probe across every fleet entry. The results annotate the entry in memory:

```
$ maw fleet list
boonkeeper   10.7.0.7:51910   reachable   (agents: 4)
whitekeeper  10.7.0.3:51910   reachable   (agents: 3)
colab        10.7.0.9:51910   dormant     (last seen 2026-04-12T18:04Z)
oldbox       10.7.0.5:51910   offline     (last seen 2026-03-01T08:00Z)
hello        10.7.0.11:51910  reachable   (agents: 1)
```

**Probe on schedule.** A background loop, running every N minutes (N = 5 in the current system), hits the same endpoint and records a `last_seen` timestamp. The scheduler writes to a small JSON sidecar next to the fleet entry — `~/.config/maw/fleet/.state/<name>.json` — so state survives restarts.

The sidecar approach is worth calling out. We tried keeping `last_seen` inside the main fleet entry file, and very quickly the file became a noisy mixture of identity (rarely changes) and state (changes every five minutes). Every `git diff` of the fleet directory was dominated by timestamp churn. Splitting the state into a parallel directory that is *not* version-controlled — and is rebuilt on demand if missing — restored both the readability of the identity files and the correctness of the version control story.

The general pattern: **never mix slow-changing declarative config with fast-changing state**. If you inherit a config format that does, split it at the first opportunity.

---

## 12.5 The Three States: Reachable, Dormant, Offline

The most important thing we got wrong in the first version of fleet health was treating unreachability as a single state. "Can't reach it" is not one condition. It is at least three, and confusing them is the source of the majority of false-positive pages.

**Reachable.** The `/api/identity` probe returned within the timeout and with the expected node name. The peer is alive, it is itself, and a command sent right now has a high probability of delivery.

**Dormant.** The peer has not responded to the most recent probe, but it responded to a probe in the last `DORMANT_WINDOW` minutes (default: 60). The node is likely suspended, the laptop lid is likely closed, the wifi has likely dropped for a moment — all conditions that resolve themselves without human intervention. A command issued against a dormant peer should *wait briefly* for the peer to wake up, rather than fail immediately, because the cost of a wrong dormancy diagnosis is milliseconds and the cost of a wrong offline diagnosis is a human being paged.

**Offline.** The peer has not responded to any probe in `OFFLINE_THRESHOLD` time (default: 24 hours). At this point the assumption that the peer will wake up on its own is no longer defensible; the peer is either genuinely off or misconfigured, and commands against it should fail fast with a clear error, not wait. Offline peers are candidates for manual intervention — power it on, fix the DNS, rotate the WireGuard key — but they are *not* candidates for automatic removal from the fleet.

The three-state model maps directly to a retry strategy:

```
reachable → send now, expect success
dormant   → send with a generous timeout (~30s), allow wake-up
offline   → refuse and explain; operator action required
```

A sharper way to say the same thing: **reachability is a confidence interval, not a boolean**. A fleet health model that encodes that confidence gets the retry policy right by default.

---

## 12.6 What to Do When a Peer Does Not Respond

A missed probe is not, by itself, an interesting event. The interesting question is: *how many in a row, and how recent was the last success?* The decision tree the live system walks on each missed probe:

1. **Single miss, last success within 5 minutes.** Almost certainly a transient blip — a packet drop, a brief overlay reconnection. Log at debug level, continue with the next scheduled probe. Do not change the peer's reported state.
2. **Three consecutive misses, last success within 60 minutes.** Mark the peer `dormant`. Surface in `fleet doctor` but do not page. Continue probing at the normal cadence.
3. **Consecutive misses for more than 60 minutes, last success within 24 hours.** Stay `dormant` but lengthen the probe interval (back off from 5 minutes to 15). Rationale: you are not waking the peer with your probes; the peer is out, and hammering it serves no purpose.
4. **No success in 24 hours.** Mark `offline`. Back off to hourly probes. Add a prominent entry to `fleet doctor`. The next human pass should decide whether this peer is coming back or should be removed from config.

Two features of this ladder are worth explicit attention. First, the ladder does not involve a control plane; each peer's health state is computed locally from local observations, and each local side is free to disagree with another local side about whether a given peer is dormant. This is not a bug — in a partially-partitioned overlay, disagreement is the correct state — and the lack of consensus is exactly what lets the fleet keep working without a central registry.

Second, *the thresholds are tunable and should be tuned*. A fleet of laptops has one natural rhythm; a fleet of always-on servers has another; a fleet mixing both needs a per-peer override. The defaults above (5 min probe, 60 min dormant, 24 h offline) are a reasonable starting point, not a universal truth.

---

## 12.7 Discovery Without Multicast

In traditional LAN discovery, mDNS or Avahi handle "who is out there" with no configuration. Peers advertise themselves, others listen, names propagate. This is lovely and it *does not work over WireGuard*, because WireGuard is a point-to-point overlay, not a broadcast domain. Multicast does not cross the overlay without explicit configuration, and while it is possible to make it work, it is rarely the right investment for a fleet of ten machines.

The live system uses *pre-seeded* discovery: a new peer's fleet directory is initialised by copying from a known good peer (chapter 10 covered the topologies). The peer then probes every entry, learns which are reachable right now, and begins participating in the fleet. When another peer is added, the fleet directory updates propagate through whatever file-sync mechanism the team uses — Syncthing, git, scp — and everyone converges within a polling window.

This is less magical than mDNS and dramatically easier to reason about. The identity of the fleet is a *directory*, and the directory is a *document*, and the document is under the team's control. The cost is that adding a peer is a documented operation, not a zero-touch one. The benefit is that you always know who is in the fleet, because the fleet is the directory.

If you ever want zero-touch discovery, layer it on top: an optional "hi, I exist at this address" POST to a seed peer, which rewrites the fleet entry on receipt. The live system does not do this today because the manual route has not been painful enough to automate. The principle to preserve, whichever route you take, is that **the fleet membership is always derivable from a document you can read**. Discovery mechanisms that rely on transient network state and cannot reconstruct themselves from a file are harder to debug when the network is the problem.

---

## 12.8 `fleet doctor`: The Unified Diagnostic

Every sub-system described in this chapter — probes, stale detection, dormancy, sidecars — feeds into a single command whose output is the one-stop summary of fleet health:

```
$ maw fleet doctor

identity
  4 fleet entries, 4 distinct canonical names, 0 collisions
  2 potential name collisions (see chapter 11): whiter/whitekeeper

reachability
  3 reachable
    boonkeeper   10.7.0.7:51910   4 agents   probe 6ms
    whitekeeper  10.7.0.3:51910   3 agents   probe 9ms
    hello        10.7.0.11:51910  1 agent    probe 11ms
  1 dormant
    colab        last seen 18m ago (within dormant window)
  0 offline

agents
  12 total, 3 shared names across peers
    "oracle" on: boonkeeper, whitekeeper, colab
    (this is expected — each node has its own oracle)
  0 addressing conflicts

sidecars
  state files up to date (last refresh: 2m ago)

recommendations
  - whiter/whitekeeper: prefer node:agent form in scripts
  - colab: dormant > 15m, consider probing endpoint manually
```

Three principles shape this output:

**Group by category, not by peer.** A per-peer view sounds natural and buries the patterns. Grouping by identity / reachability / agents / sidecars / recommendations lets the human see "the reachability layer is healthy, but the identity layer has a warning" at a glance.

**Show numbers and names.** "3 reachable" is a number you can verify against the list below it. The doctor is a tool for operators; operators need to audit the claims, not just believe them.

**End with recommendations.** Every doctor output that surfaces a problem should suggest the next action, or at least the next place to look. A diagnostic that tells you something is wrong but not what to do next is a half-built diagnostic.

---

## 12.9 A War Story: The Colab Peer That Was Never There

In late March 2026 the team added `colab.laris.co` as a fourth federation peer. The fleet entry file was created, keys were exchanged, WireGuard config updated. `maw fleet list` showed `colab` as `reachable`. For three days everything seemed fine.

On the fourth day the team tried to send a real cross-node command: `maw hey colab:oracle "status?"`. It hung for thirty seconds and returned a timeout. A quick `fleet doctor` run showed `colab` as `reachable`. A second `maw hey` also hung. A quick SSH into `colab` showed that the oracle pane had never actually been created — the machine had been provisioned, the daemon had been started, but the session bootstrap step had silently failed and nobody had noticed.

The bug was not in the transport. The bug was in the health model. The `/api/identity` probe was returning `{"node": "colab", "agents": []}`, and the doctor was reporting `reachable` because the probe was succeeding, and an empty `agents` list had not been flagged. The system had a health check for "is the peer alive" but not for "does the peer have the expected agents".

The fix was cheap: extend the health model to include *expected agents per peer*, drawn from the `windows` array in the fleet entry, and flag any discrepancy. New output:

```
colab  reachable  0 agents (expected 1: oracle)   ⚠ agent missing
```

The war-story lesson generalises beyond this specific bug: **health is a function of both the protocol and the payload**. A peer that answers on port 51910 but does not have the agents it is supposed to have is a partially-broken peer, and the diagnostic has to model that state explicitly. Reachable/dormant/offline describes only the transport layer; what lives *on* the peer is a second axis, and a complete fleet health model covers both.

---

## 12.10 The Operator's Loop

Once the three-state model, the probe-on-schedule, and the `fleet doctor` are in place, running a fleet settles into a predictable operator loop:

1. **On arrival at the machine for the day**, run `fleet doctor`. Thirty-second sanity check of who is up, who is dormant, and whether any peer has slipped into `offline` overnight.
2. **Investigate any offline peer** before beginning work that depends on it. The cause is almost always local — a laptop that did not wake, a WireGuard config that drifted, a daemon that crashed — and the fix is a command or two. Running work against an offline peer will fail, slowly, in ways the operator will blame on bad luck rather than bad diagnostics.
3. **Leave `fleet doctor` bound to a short alias** or a tmux key-binding. The diagnostic you run twice a day is worth one keystroke to invoke.
4. **Review `fleet doctor` output after any config change**. Adding a peer, renaming a peer, rotating keys — each is an opportunity for the fleet to be subtly broken in ways that only show up when you need them not to. The operator loop makes those broken states cheap to catch.

This loop looks like devops-discipline advice and it is. The difference in a multi-agent context is that the "infrastructure" is often a couple of laptops and a mini-PC, and the operator is the developer writing the agents. Treating the fleet with the same rigor as a production cluster is not overkill for a five-machine federation; it is what makes a five-machine federation feel as solid as a single machine.

---

## 12.11 When to Invest More

The discovery and health model described here is sized for a fleet of up to roughly thirty peers with a handful of agents each. Below that, the patterns are comfortably lightweight. Above that, a few things start to hurt.

**Probe fan-out**. Sweeping 100 peers every five minutes is not expensive in raw cycles, but it becomes harder to distinguish a real outage from a statistical one. Move to per-peer probe schedules with jitter, and aggregate results centrally.

**Name namespace exhaustion**. With 100 peers, the chance of near-collisions in the `node` namespace is high. Move to a two-level naming scheme: `group/node`. This is a chapter-11 concern colliding with a chapter-12 one.

**Config distribution**. Adding a peer is manual in the current model. Past thirty peers, automate the "copy fleet directory to new peer" step — ideally via a small daemon on one peer that acts as a config seed.

**Observability**. `fleet doctor` output is a human artefact. Past thirty peers, emit the same data to a time-series store (InfluxDB, a Sqlite-backed metrics dir, whatever the team already runs), so that a flapping peer can be seen as a flapping peer rather than a series of unrelated alerts.

None of these investments are needed early. All are predictable; the thresholds above are the ones we watch for. The message of this chapter, and of Part IV overall, is: start with a system you can reason about in one head, and grow it only when the growth is demanded by observed pain.

---

## 12.12 Summary

Discovery is the hardest part of federation, not because the algorithms are hard but because the state space is. Peers go up. Peers go down. Peers wake from suspend. Peers get renamed. Peers get decommissioned and forgotten. A federation that handles all of these gracefully is built on a small stack of concrete choices:

- **Fleet config is a directory**, one file per peer, identity-only.
- **Reachability is dynamic**, computed from a cheap `/api/identity` probe, stored in a separate state sidecar.
- **Peer state is ternary** — reachable, dormant, offline — with explicit thresholds and different retry strategies for each.
- **Health is both transport and payload** — a peer that answers but lacks the expected agents is its own distinct failure mode.
- **The doctor is the operator's best friend** — a single command that summarises identity, reachability, agents, and recommendations.

With these in place, a four-machine federation feels crisp, a ten-machine federation is manageable, and the growth path to thirty is incremental rather than architectural. And crucially, none of it depends on a cloud broker or a hosted service. The fleet is yours, the discovery is local, and the health of the bus is information you can observe directly — the way, in the end, every good piece of infrastructure behaves.
