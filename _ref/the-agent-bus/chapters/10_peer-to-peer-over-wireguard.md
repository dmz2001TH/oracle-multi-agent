# Chapter 10: Peer-to-Peer Over WireGuard, Not Cloud

> "The home lab is the hyperscaler for multi-agent systems. You already own it. You already trust it. You already pay for the electricity."

---

## 10.1 The Question We Should Have Asked Sooner

For the first three months of running multi-agent workflows, every conversation about cross-machine coordination started with the same dead end: *which broker?* Redis Streams on a droplet. A managed NATS cluster. Pub/Sub on GCP. A Fly.io relay that happened to be cheap that week. The implicit assumption was that two computers on opposite ends of a house required a third computer, in a data center, to introduce them to each other.

The assumption is wrong. It was wrong before we noticed it was wrong, and once we noticed, every subsequent design changed.

This chapter is about the assumption and the thing that replaces it: **WireGuard as an L3 overlay, machines as stable peers, agents as first-class citizens of that network**. By the end of the chapter you will understand why `maw hey white:oracle` — a command that reaches an agent on another machine three rooms away — runs faster than a cloud broker round-trip, costs zero dollars per month, and leaves no trail outside your own hardware.

We will get to the command. First we need to be precise about what we are replacing and why.

---

## 10.2 The SaaS Broker Default and Its Hidden Taxes

A hosted broker is one of the most over-specified solutions in distributed systems. You pay for it in four currencies, and three of them do not appear on the invoice.

**Latency.** A round trip from a laptop in a home office to `us-east-1` and back is, at the optimistic end, 40–80 ms. A round trip to a machine three rooms away is 0.3–2 ms. For agent coordination — a message that wakes a peer, a handshake that negotiates work — the difference compounds. A conversation that takes ten round trips over WireGuard completes in 20 ms of wall time. The same conversation over a hosted broker eats half a second before the agent has rendered its first token.

**Cost.** Hosted brokers price by message volume, by retained bytes, by concurrent connections, by egress. None of these numbers are large for a multi-agent system of a single developer. All of them are greater than zero, and the fixed overhead of a managed service rarely drops below fifteen dollars per month. Over a year that is more than a WireGuard client license (zero) and more than the incremental electricity cost of running two machines that were already on.

**Lock-in.** The broker's API becomes your bus. Its retention semantics become your memory. Its offline behaviour becomes your failure model. Migrating off a hosted broker, once the first hundred scripts reference its SDK, is a project — not a change. The cost of lock-in is invisible right up until the moment you want to leave.

**Privacy.** Every message your agents send — inboxes, work logs, research findings, sometimes credentials — traverses a vendor's infrastructure. Even with encryption at rest the metadata is theirs: who talked to whom, when, how often. For a developer hacking on a research project this may be fine. For a team shipping real product the exposure is material.

There is a fifth tax, harder to name: **the tax of running two fleets**. A hosted broker is a machine, even if you do not own it. It has uptime, it has incidents, it has release notes, it has a status page you check when things seem weird. Owning two fleets — yours and the vendor's — is a cost no amount of convenience ever fully amortises.

WireGuard collapses the fleet back to one. Your machines. Your network. Your bus.

---

## 10.3 WireGuard Is an IP Address That Follows You

WireGuard is often introduced as a VPN. That framing understates what it is. A VPN, in the traditional sense, is a gateway you tunnel into to reach a private network — an office LAN, a corporate app. WireGuard can be used that way, but its native shape is flatter and more interesting: **every machine on the overlay has a stable IP, and every machine can reach every other machine at that IP, as if the internet between them were a single ethernet cable**.

The practical consequence is that once a machine is on the overlay, it has a name. Not a DNS name — an IP. `10.7.0.3` is `whitekeeper`. `10.7.0.7` is `boonkeeper`. `10.7.0.9` is `colab`. The IP does not change when the machine moves to a different coffee shop, a different country, or wakes up from suspend. The overlay restores the peer address once the handshake completes, and the identity is preserved.

This is the single property that makes federation cheap. Every other pattern in this chapter — peer probes, fleet discovery, cross-node agent messaging — relies on a machine having a name that another machine can reach. WireGuard supplies that name without any third party being involved.

A minimal two-peer configuration looks like this:

```ini
# /etc/wireguard/wg0.conf on boonkeeper
[Interface]
PrivateKey = <boonkeeper-private>
Address    = 10.7.0.7/24
ListenPort = 51820

[Peer]
PublicKey  = <whitekeeper-public>
AllowedIPs = 10.7.0.3/32
Endpoint   = whitekeeper.dyndns.example:51820
PersistentKeepalive = 25
```

The mirror on `whitekeeper` swaps the keys and endpoints. `wg-quick up wg0` on each side, and now `ping 10.7.0.3` from boonkeeper reaches whitekeeper directly, encrypted end to end, without a packet leaving either side of the WireGuard tunnel after the initial handshake. No broker. No relay. No cloud.

Adding a third machine is a configuration change on two sides, not a schema migration. Appendix C has the full topology templates for mesh, star, and hub-with-satellites arrangements; the mechanics are identical.

---

## 10.4 Agents as Peers, Not as Queue Members

Once the overlay exists, the natural model for cross-machine agents changes shape. In the broker world, an agent is a queue consumer; its identity is derived from its subscription. In the overlay world, an agent is an HTTP service, its identity is an IP plus a port plus a path, and it is reachable exactly the way any other service on the LAN is reachable. The agent does not need to know it is talking to a peer on another machine, because *the network itself has hidden that distinction*.

This is the architectural shift worth internalising. **Federation is not a protocol you design on top of a bus. Federation is the network layer you already have, exposed.**

In the live multi-agent system, each agent is a named tmux pane inside a `maw-js` session on a machine. Each machine runs a small HTTP server — `maw-js api` — on a fixed port (51910 by default). The server knows every agent on that machine, and every agent's inbox path, and how to inject a keypress into the agent's pane. Cross-machine messaging is then a single HTTP call from one `maw-js` to another:

```bash
# From boonkeeper, to oracle on whitekeeper
curl http://10.7.0.3:51910/api/hey \
  -H 'content-type: application/json' \
  -d '{"target":"oracle","message":"standup please"}'
```

That is the entire federation protocol. Everything above it — `maw hey white:oracle`, the `fleet doctor` reachability check, the `/api/identity` probe — is a CLI ergonomics layer on top of that single HTTP primitive. The bus is the overlay. The protocol is whatever HTTP you want it to be.

---

## 10.5 The `maw hey <node>:<agent>` Command Walk-Through

The CLI-level shape of cross-node messaging in the live system is `maw hey <node>:<agent>`. Three machines at the time of writing — `boonkeeper`, `whitekeeper`, `colab` — each running a `maw-js` daemon, each aware of the others via a fleet directory (`~/.config/maw/fleet/*.json`, covered in chapter 12). To wake the `oracle` agent on `whitekeeper` from a shell on `boonkeeper`:

```bash
maw hey whitekeeper:oracle "standup please, under 60s"
```

What happens, in order:

1. The local `maw-js` parses `whitekeeper:oracle` into node and agent parts. A bare name (no colon) would route to a *local* session; the colon is the explicit federation marker.
2. It looks up `whitekeeper` in the fleet directory. The fleet entry contains the overlay IP and the port: `10.7.0.3:51910`.
3. It issues a lightweight `GET /api/identity` probe to verify the peer is alive and serving the expected node name. If the probe fails, the local side falls back to a dormancy path — it records the attempt, surfaces the failure, and does not hang.
4. On a successful probe, it issues `POST /api/hey` with the agent name, message, and an idempotency key.
5. The remote `maw-js` looks up the `oracle` pane in its local session, injects the keypress via `tmux send-keys`, and returns `{ delivered: true, pane: "oracle", session: "105-whitekeeper" }`.
6. The local `maw-js` prints a one-line confirmation with the remote session ID, so the human knows exactly which pane received the keystroke.

The entire round trip, end to end, is typically under 30 ms on a healthy overlay. Compare this to a broker round trip and the visceral difference becomes clear: federation over WireGuard feels *local* to use, because it is.

---

## 10.6 The "It's Just a LAN" Principle

There is a subtle trap in talking about overlays: because they present as a LAN, they invite people to treat them *exactly* as a LAN — with the same assumptions about trust, latency, and reliability. Two of those assumptions are safe, one is not.

**Trust is safe to assume.** WireGuard authenticates every packet. There is no meaningful risk of a spoofed peer on the overlay; if the public key does not match, the handshake fails, and nothing else gets through. This means the HTTP services on the overlay do not need additional authentication between peers — the WireGuard layer has already established who is talking. (They may still need authorisation — what a peer is *allowed* to do — but that is a policy decision, not a transport decision.)

**Latency is safe to assume.** Intra-overlay round trips, even across continents, are only a few milliseconds slower than the underlying internet path. Within a home or office network, they are indistinguishable from loopback.

**Reliability is NOT safe to assume.** Home internet goes down. Peers suspend. A laptop lid closes. A cable gets unplugged. A WireGuard keepalive can maintain the tunnel across NAT rebinds, but it cannot resurrect a machine that is off. The fleet, unlike a hosted broker, does not have a nine-nines uptime guarantee — and more importantly, *should not need one*. The right mental model is that federation is a best-effort delivery over a partially-online mesh, not a transactional message queue.

Chapter 12 develops this into the discovery/dormancy/offline trichotomy, which is the single most important distinction to get right when designing peer software. For now, internalise the smaller form: **an overlay is a LAN with realistic uptime assumptions**.

---

## 10.7 A War Story: When the Cloud Broker Made Us Stop

Before the federation-over-WireGuard model stabilised, there was a week in which the team ran a hosted NATS server to bridge two laptops — one running a daemon suite, the other running a UI shell. The arrangement worked for three days, and then for two hours one Tuesday it did not. A routine maintenance window on the vendor's side dropped persistent connections. The laptops reconnected cleanly, but four agents that were mid-conversation when the blip happened never completed their hand-off. Three of them eventually timed out. One wrote partial state to disk and quietly corrupted an inbox.

The thing that was infuriating was not the outage. It was the *investigation*. Debugging cross-agent message loss when the bus is someone else's service means correlating their logs (which you cannot see) against your own logs (which you can, but they only show what your side sent). The feedback loop was measured in hours of email exchanges with support.

The replacement architecture went in the following weekend. Two WireGuard keys, two config files, two `wg-quick up wg0`s. The "bus" went from being a SaaS dependency with an incident-response Slack channel to being a kernel module and a couple of HTTP servers. The first time a peer went offline after the switch, the failure was visible in `maw fleet doctor` within seconds, the specific cause was local (a laptop had suspended), and the fix was local (open the laptop). Total time to diagnose: 90 seconds.

The retrospective line that stuck was: *we traded five-minute setup for five-minute failure modes*. The SaaS had been faster to start and slower to understand when it broke. The self-hosted overlay was a weekend to bootstrap and then transparent forever after. Over any horizon longer than a month, that is the better trade.

---

## 10.8 What You Lose

Honest architecture books are specific about costs. WireGuard-based federation is not free; the costs simply move from a monthly bill to a one-time setup and an ongoing low-level literacy.

**You own the keys.** If you lose them, you lose the overlay. Backup matters in a way it does not with a hosted broker. Key rotation is your job.

**You own the debugging.** When a peer is unreachable, you cannot open a ticket. You open `wg show`. You check `systemd-resolved`. You ping the overlay IP. You grep journald. The tooling is all there, but you are the first, second, and last line of support.

**You own the dynamic DNS.** If your peers live on home internet with changing IPs, you need a way for WireGuard to find the current endpoint. DuckDNS, Cloudflare dynamic updates, or a tiny script that pokes the endpoint into the config on IP change. This is a solved problem but it is still a problem you own.

**You own the NAT traversal.** Most home routers are friendly enough to WireGuard that `PersistentKeepalive = 25` is sufficient. A minority require port forwarding. A tiny few require a STUN-like trick or a relay node on a VPS. Appendix C documents the three topologies and when each is appropriate.

None of these are new costs — they are the costs of *running your own infrastructure*, and they are the same costs that anyone self-hosting anything has been paying for decades. The novelty is that those costs now buy you a multi-agent bus that is strictly better, by every measure except elasticity, than any hosted alternative.

---

## 10.9 The Home Lab Is the Hyperscaler

Step back from the mechanics and look at the fleet from thirty thousand feet. At the time of writing, the live federation covers four physical machines, none of them rented, none of them in a data centre. A gaming laptop. A mini-PC in a closet. A work laptop. A shared-office box. Between them they sustain a dozen long-running agent sessions, thousands of cross-node messages per week, and a total monthly infrastructure bill of zero.

The machines are individually unexceptional. Collectively — with a WireGuard mesh between them and a `maw-js` daemon on each — they are a private compute fabric for multi-agent work. Elastic enough for any workload the agents actually have. Cheaper than the monthly cost of a single hosted broker. Faster than any cloud round trip. Entirely under the developer's control.

The generic takeaway is bigger than `maw-js` and bigger than WireGuard specifically. It is that **the hardware a small team already owns is more than sufficient to run a sophisticated multi-agent system, and the only thing standing between that hardware and a working federation is a transport layer that treats every machine as a peer**. WireGuard is the cleanest transport layer for that job today. Something even simpler may replace it in five years. The principle — *your machines, your network, your bus* — will not change.

If you take one idea from this chapter, take this: **the default architecture diagram for a multi-agent system should not contain a cloud service**. Put the machines on the page first. Draw the overlay between them. The agents speak over that overlay directly. Anything else is a tax you chose to pay.

---

## 10.10 Checklist Before You Build on Top of This

Before you layer discovery (chapter 12), collision-resistant naming (chapter 11), or cross-tier debugging (appendix D) on top of a WireGuard federation, check the foundations:

- [ ] Every peer has a stable overlay IP — confirmed with `wg show`, not with "it pinged last week".
- [ ] The underlying endpoint of each peer either has a static public IP or a dynamic DNS entry with an update mechanism.
- [ ] `PersistentKeepalive = 25` is set on every peer behind NAT.
- [ ] `wg-quick` is enabled as a systemd service on every peer (`systemctl enable wg-quick@wg0`), so a reboot restores the overlay without manual intervention.
- [ ] There is a *pre-shared* baseline of which agent names are claimed on which node — chapter 11 is about what happens when that baseline is missing.
- [ ] There is a health probe (`GET /api/identity`) exposed on every peer's agent daemon, and it returns within 100 ms on a healthy network.
- [ ] You have at least one peer whose uptime you trust (a server, not a laptop), if you want the fleet to be reachable when the developer's main machine is closed.

Once that list is clean, everything else in this part of the book is additive: routing, discovery, naming, diagnostics. The overlay is the substrate. Get it right first. The rest follows.

---

## 10.11 Summary

Hosted message brokers are the wrong default for multi-agent coordination. They impose latency, cost, lock-in, and privacy costs that are individually small and collectively severe. The right default, for any developer who runs more than one machine, is a WireGuard overlay treating every machine as a stable peer.

On top of that overlay, cross-machine agent messaging is a plain HTTP call. The CLI layer — `maw hey whitekeeper:oracle` — is a thin convenience over that primitive. The round trip is local-speed. The bill is zero. The infrastructure is under the developer's full control.

The home lab is the hyperscaler. The rest of Part IV is about what you build on top of it: how agents find each other (chapter 12), how they name themselves safely (chapter 11), and how to debug the inevitable failures that cross three tiers of transport before anyone notices (appendix D).

The substrate is yours. The bus is the network. The agents do the rest.
