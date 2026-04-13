# Appendix C: Federation Topology Templates

> Three topologies that cover every multi-agent federation we have seen in practice, with WireGuard snippets for each and the tradeoffs written down.

---

## C.1 How to Pick a Topology

Before writing any config, answer three questions about your fleet. The answers decide the topology.

**How many peers today, and how many in twelve months?** Under five peers, full mesh is fine. Five to fifteen, still fine but annoying to edit. Above fifteen, you need hubs.

**How many peers live on home internet vs. static IPs?** Peers on home internet cannot receive incoming connections reliably unless the router is friendly or a port is forwarded. Those peers need a *rendezvous* — a peer with a static endpoint they can connect *out* to. One peer with a static IP is enough for a whole fleet of home-network peers.

**How often do you add or remove peers?** Mesh requires config touch on every existing peer when you add a new one. Hub-and-satellite requires only the hub and the new satellite. Over many adds, the hub model amortises into a small fraction of the mesh's config churn.

With those answers in hand:

- Small fleet, everyone on static or friendly-NAT: **full mesh**.
- Mixed fleet, at least one static peer: **hub-with-satellites**.
- Fleet scaling toward "too many to think about": **star** (one central hub, pure spoke-and-hub).

The rest of this appendix is the three templates.

---

## C.2 Full Mesh

Every peer has a direct tunnel to every other peer. No rendezvous. No relay. Best possible latency; worst possible config overhead.

### C.2.1 When To Use

- Three to five peers, all with static or reliably dyn-DNS'd endpoints.
- Every peer needs to reach every other peer equally often.
- No operator willing to maintain a hub.

### C.2.2 Template (three peers)

`boonkeeper` (10.7.0.7):

```ini
[Interface]
PrivateKey = <boon-private>
Address    = 10.7.0.7/24
ListenPort = 51820

[Peer]
PublicKey  = <white-public>
AllowedIPs = 10.7.0.3/32
Endpoint   = white.example.net:51820
PersistentKeepalive = 25

[Peer]
PublicKey  = <colab-public>
AllowedIPs = 10.7.0.9/32
Endpoint   = colab.example.net:51820
PersistentKeepalive = 25
```

`whitekeeper` (10.7.0.3):

```ini
[Interface]
PrivateKey = <white-private>
Address    = 10.7.0.3/24
ListenPort = 51820

[Peer]
PublicKey  = <boon-public>
AllowedIPs = 10.7.0.7/32
Endpoint   = boon.example.net:51820
PersistentKeepalive = 25

[Peer]
PublicKey  = <colab-public>
AllowedIPs = 10.7.0.9/32
Endpoint   = colab.example.net:51820
PersistentKeepalive = 25
```

`colab` (10.7.0.9) follows the same pattern, with `boon` and `white` as peers.

### C.2.3 Tradeoffs

- **Latency:** Best. One hop between any two peers.
- **Failure modes:** Independent. A dead peer does not affect any other pair's reachability.
- **Config cost:** O(N²). Adding peer N touches N-1 existing configs.
- **Privacy:** All traffic direct, encrypted; no third party ever sees it.

### C.2.4 Gotcha

If a peer is behind NAT without `PersistentKeepalive`, its NAT mapping will expire and the *other* peer cannot initiate to it. The keepalive must be set on the NATed side. A common failure mode is forgetting this on a laptop peer; the fleet "worked yesterday" and mysteriously stops working after the laptop slept. `PersistentKeepalive = 25` everywhere is a cheap blanket fix.

---

## C.3 Hub-With-Satellites

One peer — the hub — has a reliably reachable endpoint. Every other peer connects out to the hub. Peers can still reach each other through the hub (by routing, if the hub allows forwarding) *or* directly, if their NATs permit after the hub has introduced them.

### C.3.1 When To Use

- Fleet has a mix of home-internet laptops and at least one always-on server or VPS.
- Config-edit discipline is limited; you add peers frequently.
- The hub can be a cheap VPS (< $5/mo) or an existing home server.

### C.3.2 Template

`hub` (10.7.0.1, static endpoint `hub.example.net`):

```ini
[Interface]
PrivateKey = <hub-private>
Address    = 10.7.0.1/24
ListenPort = 51820

# Hub needs packet forwarding if satellites should route through it.
# echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.d/99-wg.conf
# sysctl -p

PostUp   = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o wg0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o wg0 -j MASQUERADE

[Peer]
PublicKey  = <boon-public>
AllowedIPs = 10.7.0.7/32

[Peer]
PublicKey  = <white-public>
AllowedIPs = 10.7.0.3/32

[Peer]
PublicKey  = <colab-public>
AllowedIPs = 10.7.0.9/32
```

Each satellite (example: `whitekeeper`, 10.7.0.3):

```ini
[Interface]
PrivateKey = <white-private>
Address    = 10.7.0.3/24

[Peer]
PublicKey  = <hub-public>
AllowedIPs = 10.7.0.0/24            # route the whole overlay through the hub
Endpoint   = hub.example.net:51820
PersistentKeepalive = 25
```

Note the `AllowedIPs = 10.7.0.0/24` on the satellite — this routes the entire overlay CIDR through the tunnel to the hub, which forwards to other satellites.

### C.3.3 Tradeoffs

- **Latency:** Adds one hop (via the hub) between any two satellites. On a colocated hub that is a few milliseconds; on a remote hub it can be 50–100 ms. Tolerable for most agent traffic; noticeable for chatty coordination.
- **Failure modes:** Hub is a single point of failure for inter-satellite traffic. Satellites can still reach the hub itself. If the hub is down, the fleet is partitioned into islands of one.
- **Config cost:** O(N). Adding a new peer touches only the hub's config and the new satellite's.
- **Privacy:** Hub sees all inter-satellite traffic's headers (encrypted payload, but it can observe who talks to whom). If the hub is yours, this is fine. If the hub is a rented VPS, accept the metadata exposure.

### C.3.4 Gotcha

If you forget to enable IP forwarding on the hub, satellites can talk to the hub but not to each other — and the failure is silent on the wg side, because the packets reach the hub and are simply dropped. Check:

```bash
$ sysctl net.ipv4.ip_forward
net.ipv4.ip_forward = 1
```

If this says `0`, no amount of config will route.

---

## C.4 Star

Every peer connects only to the hub. Peers do **not** talk to each other, even through the hub. All coordination is mediated by a service on the hub.

### C.4.1 When To Use

- Fleet of ten or more peers where most communication is peer-to-hub, not peer-to-peer.
- You want the hub to be the authoritative bus — maybe running a scheduler, a shared inbox, a lockbox.
- You care about bounded blast radius: compromising one satellite does not give the attacker access to any other satellite.

### C.4.2 Template

Hub config is identical to the hub-with-satellites template above, except:

- Do **not** enable IP forwarding.
- `AllowedIPs` on the hub's peer entries is the single `/32` of that satellite (no broader CIDR).

Each satellite config looks like this (note the narrow `AllowedIPs`):

```ini
[Peer]
PublicKey  = <hub-public>
AllowedIPs = 10.7.0.1/32            # only the hub
Endpoint   = hub.example.net:51820
PersistentKeepalive = 25
```

Agents on satellites address only the hub; the hub's services route to other satellites on behalf of the caller via higher-level protocol (e.g., a shared inbox on the hub that every satellite polls).

### C.4.3 Tradeoffs

- **Latency:** One hop to the hub, then whatever the hub's app-level routing costs.
- **Failure modes:** Hub is the entire point. If the hub is down, the fleet is entirely offline from itself.
- **Config cost:** O(N) on the hub, O(1) on satellites. Easy to scale.
- **Privacy:** Hub sees everything. This is intentional in a star.

### C.4.4 Gotcha

The star is easy to *misuse* as a substitute for hub-with-satellites. If you actually want direct satellite-to-satellite traffic later, you will tear down and rebuild. Pick star only when you genuinely want the hub as the one source of truth for coordination — usually because you are running an application-layer broker or scheduler on it and do not want to change that model.

---

## C.5 Dynamic DNS and Friends

Every template above assumes each peer's endpoint is resolvable. Options, in decreasing order of ease:

**Static IP.** A VPS, a business-tier home connection, or a known-stable cellular route. Ideal for hubs.

**DuckDNS / Dynu / similar free dyn-DNS.** A small cron on each home peer updates its TXT record with the current public IP. WireGuard peers resolve the name, not the IP. Reliable in practice.

**Cloudflare dynamic DNS via API.** Heavier, but you probably already have a Cloudflare zone. Same mechanism — a tiny script keeps a subdomain pointed at the current public IP.

**IPv6 prefix with stable address.** If your ISP supports it, IPv6 addresses are often stable for months, and the peer's /64 prefix changes rarely. Works well for peers inside one residential ISP; awkward across ISPs if carrier-grade NAT is involved.

Avoid: third-party "WireGuard management" SaaS. They solve dyn-DNS by reintroducing the hosted-service dependency we spent Part IV rejecting. If you want managed WireGuard, the self-hosted `wg-access-server` or a Netbird / Tailscale deployment is a more honest compromise — but for a fleet of four machines, a cron and a dyn-DNS provider is plenty.

---

## C.6 Systemd Wiring

Whichever topology you choose, bake the interface into systemd on every peer so that a reboot restores the overlay:

```bash
sudo cp wg0.conf /etc/wireguard/wg0.conf
sudo systemctl enable --now wg-quick@wg0
```

Verify:

```bash
$ sudo wg show
interface: wg0
  public key: ...
  private key: (hidden)
  listening port: 51820

peer: ...
  endpoint: hub.example.net:51820
  allowed ips: 10.7.0.0/24
  latest handshake: 23 seconds ago
  transfer: 4.31 MiB received, 2.17 MiB sent
```

The `latest handshake` field is the most useful diagnostic. A handshake within the last 2 minutes means the tunnel is alive. Older than 3 minutes and the peer is probably gone; older than 10 minutes and it is certainly gone.

---

## C.7 Migrating Between Templates

Topologies are not prisons. A fleet can start as a full mesh and migrate to hub-with-satellites when it crosses the five-peer line, and later evolve to a star if the hub becomes an application-level bus. The migration pattern that has worked:

1. Stand up the new topology in parallel on a second interface (`wg1`) on every peer.
2. Point application services at the new interface once all peers are up.
3. Tear down `wg0`.

This takes a day of work for a fleet of ten. It costs one brief window of two overlays running at once. Worth it when the topology no longer fits.

---

## C.8 What Not To Do

- **Don't share private keys across machines.** Every peer gets its own keypair. A peer's private key lives only on that peer.
- **Don't reuse the same overlay CIDR across unrelated fleets.** `10.7.0.0/24` is a convention, not a reservation — pick a different subnet for each distinct fleet.
- **Don't put a password-protected private key where an automated `wg-quick` needs to read it.** Systemd boot flows don't prompt; the tunnel won't come up.
- **Don't expose WireGuard's ListenPort to the public internet from a hub unless you mean to.** `ufw allow 51820/udp from <satellite-ips>` is fine; the world does not need to scan you.

These are small habits. Observed across the fleet's life, they are the difference between "the overlay just works" and "why did the tunnel go down overnight again".
