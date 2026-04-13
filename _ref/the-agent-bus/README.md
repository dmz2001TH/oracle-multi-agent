# The Agent Bus

**Subtitle**: How AI agents talk — in-process, across panes, across machines — without a single cloud service

---

## About This Book

When you have more than one AI agent, you have a transport problem. How does agent A wake up agent B? How does a team of agents share findings without a central broker? How do you let the agents running on your laptop talk to the ones running on your home server three rooms away — without sending everything to a cloud?

The hosted-SaaS answer is "use our orchestrator." The honest answer is: **your laptop already has everything you need**. Files, tmux, SSH, WireGuard. Compose them correctly and you have a four-tier bus that carries messages from a function call to a cross-continent agent federation.

This book shows you how to compose them.

**You will not find**:
- Kafka, RabbitMQ, or any hosted broker
- Dependency on a specific LLM provider's orchestration API
- "Just use an agent framework" hand-waving

**You will find**:
- The Four Tiers of agent transport, with cost/coordination/visibility tradeoffs for each
- File-based mailboxes — JSON append + polling harness = zero-dependency IPC
- Tmux as a shared agent runtime, not just a terminal multiplexer
- Federation over WireGuard — peer-to-peer agent messaging with no hub
- War stories: naming collisions, ghost agents, substring bugs, fire-and-forget vs dialog
- Real code from a live multi-agent system (`maw hey`, `claude -p`, `~/.claude/teams/`) as the worked example

---

## The Source

This book is built on a live multi-agent system where four tiers of transport are routinely used in a single session:
- Tier 1: in-process Agent tool calls
- Tier 2: file-based mailbox messaging (`~/.claude/teams/<team>/inboxes/*.json`)
- Tier 3: tmux pane messaging (`maw hey` wrapping `tmux send-keys`)
- Tier 4: federation over WireGuard (`maw hey <node>:<agent>`)

Every pattern in this book has code that shipped. Every failure has a git commit. Every "this works" has a reproducible setup.

---

## Table of Contents

### Part I — The Four Tiers
1. Pick Your Substrate
2. The Cost Model of Talking to Agents
3. When to Fire-and-Forget, When to Dialog

### Part II — File-Based Mailboxes
4. JSON Append + Polling: The Zero-Dependency IPC
5. Inbox Schemas and Delivery Receipts
6. Standing Orders and Persistent Context

### Part III — Tmux + Subprocess Runtime
7. Panes Are Processes
8. `tmux send-keys` and Its Abstractions
9. The `claude -p` Pattern

### Part IV — Federation
10. Peer-to-Peer Over WireGuard, Not Cloud
11. Naming, Collisions, and the #239 Class
12. Cross-Node Discovery and Fleet Health

### Appendices
- A. Transport Command Reference
- B. Mailbox JSON Schema
- C. Federation Topology Templates
- D. Debugging Cross-Tier Issues

---

## The Thesis

> The best multi-agent bus is the one your operating system already built for you.
> Your laptop is a cluster. Your home server is a peer. WireGuard is the fabric.
> Everything else is unnecessary.

Everything in this book follows from that.

---

## License + Attribution

Written by: a multi-agent team coordinated via TeamCreate, each agent writing one Part in parallel.
Based on code: github.com/Soul-Brews-Studio/maw-js
Grounded in session: ~100 hours of real work, April 2026
Part of the *Multi-Agent Orchestration* trilogy.
