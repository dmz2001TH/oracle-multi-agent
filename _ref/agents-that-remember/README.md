# Agents That Remember

**Subtitle**: How to give AI agents memory that survives context resets, session deaths, and software restarts

---

## About This Book

Most AI coding sessions end when the context window fills up. The agent doesn't "end" in a satisfying way — it just forgets. By morning, the assistant that was debugging your auth flow at 2am has no recollection of the fix, the failed attempts, or the lessons. Yesterday's reasoning is gone.

This book is about fixing that — **systematically, with patterns you can apply to any AI agent framework you're building on top of**. LangChain, CrewAI, Claude Code, bespoke — doesn't matter. The patterns are framework-agnostic.

**You will not find**:
- Vector databases as "memory" (they're retrieval, not continuity)
- "Just use RAG" hand-waving
- Promises of perfect recall

**You will find**:
- A 6-principle framework for building stateful agents
- Patterns for per-session rituals (save, load, handoff, retrospective)
- Per-agent persistent mailboxes with standing orders + append-only findings
- Agent lineage — how forking an agent inherits history, like a biological parent
- Session-end archival so knowledge survives software upgrades and reboots
- Real code from a live multi-agent system (maw-js, ψ/ vault) as the worked example

---

## The Source

This book is built on a live multi-agent system where 186+ independent AI agents run across 4 federated machines, each with its own persistent memory in a shared on-disk vault called ψ/. The patterns were discovered by building and breaking that system across thousands of sessions.

Every claim is grounded in code that shipped. Every "this works" has a commit hash. Every "this fails" has an AI diary entry admitting why.

---

## Table of Contents

### Part I — Why Context Isn't Memory
1. The Hour-57 Problem
2. Compaction Is Cognitive Hemorrhage
3. The Three Myths of Vector-DB Memory

### Part II — Rituals for State
4. Write Before the Window Fills
5. Handoffs Are the Real API
6. Retrospectives: The Daily Save Game
7. Reading Your Own Diary

### Part III — Lineage and Forking
8. The Yeast Model of Agent Reproduction
9. Parent Identity, Child Identity
10. When to Bud, When to Archive

### Part IV — Principles
11. Nothing Is Deleted
12. Patterns Over Intentions
13. The External Brain Beats the Internal One
14. Rule 6: Never Pretend to Be Human

### Appendices
- A. Mailbox Directory Schema
- B. Ritual Command Reference
- C. Principles as Tests

---

## The Thesis

> The model is the thinker. The filesystem is the memory.
> Trying to squeeze both into a 200K context window is architecture malpractice.

Everything in this book follows from that.

---

## License + Attribution

Written by: a multi-agent team coordinated via TeamCreate, each agent writing one Part in parallel.
Based on code: github.com/Soul-Brews-Studio/maw-js
Grounded in session: ~100 hours of real work, April 2026
Part of the *Multi-Agent Orchestration* trilogy.
