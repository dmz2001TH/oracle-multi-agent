# Framework Comparison - Oracle Multi-Agent Upgrade

## Overview
This document compares 5 key sources for upgrading oracle-multi-agent to an Autonomous Multi-Agent Framework.

## Sources Compared

| Source | URL | Focus | Key Concepts |
|--------|-----|-------|--------------|
| **Superpowers** | https://github.com/obra/superpowers | Workflow & Skills | brainstorm → write-plan → execute, TDD, YAGNI, Critique Loop |
| **LangGraph** | https://github.com/langchain-ai/langgraph | Orchestration Engine | StateGraph, Checkpoint, Command pattern, stateful agents |
| **PyAgentSpec** | https://github.com/oracle/agent-spec | Agent Definition | YAML-based agent config, framework-agnostic, runtime adapters |
| **Soul-Brews-Studio** | https://soul-brews-studio.github.io/multi-agent-orchestration-book/ | Orchestration Pattern + UI | Hierarchical Pattern, Dashboard WebSocket, battle-tested patterns |
| **oracle-maw-guide** | https://github.com/the-oracle-keeps-the-human-human/oracle-maw-guide | Memory + Safety | MAW Lifecycle, Circuit Breaker, 3-layer Memory, crash recovery |

## Detailed Comparison

### 1. Superpowers - Workflow & Skills

**Phase 0 Findings:**
- Agentic skills framework with mandatory workflows
- 7-step workflow: brainstorming → using-git-worktrees → writing-plans → subagent-driven-development → test-driven-development → requesting-code-review → finishing-a-development-branch
- Skills library for reusable capabilities
- Philosophy: Convenience for AI, Visibility for human

**Phase 1+ Application:**
- Must use brainstorm → write-plan → execute before coding
- TDD (RED-GREEN-REFACTOR) mandatory
- YAGNI principle - only build what's needed
- Critique Loop for quality assurance
- New features must create skill in `core/skills/` first

**Relevance to Oracle Multi-Agent:**
- Provides structured workflow for agent development
- Ensures quality through mandatory testing and code review
- Skills system aligns with agent capabilities

---

### 2. LangGraph - Orchestration Engine

**Phase 0 Findings:**
- Low-level orchestration framework for building stateful agents
- StateGraph pattern for managing agent state
- Checkpoint mechanism for state persistence
- Command pattern for agent communication
- Trusted by Klarna, Replit, Elastic, etc.
- Both Python and JS/TS versions available

**Phase 1+ Application:**
- Orchestrator MUST be StateGraph, not while loops
- Use `SqliteSaver` or create `OracleCheckpointer` for state storage
- Agents communicate via State, not direct function calls
- Enables long-running, stateful agent workflows

**Relevance to Oracle Multi-Agent:**
- Replaces current orchestration with StateGraph
- Enables proper state persistence for crash recovery
- Provides battle-tested orchestration foundation

---

### 3. PyAgentSpec - Agent Definition

**Phase 0 Findings:**
- Framework-agnostic declarative language for agents
- YAML/JSON format for agent definitions
- Python SDK (PyAgentSpec) for building agents
- Runtime adapters: WayFlow (reference), LangGraph, AutoGen, CrewAI
- Enables component-based agent composition

**Phase 1+ Application:**
- Every agent MUST have `.yaml` file in `agents/` directory
- NO hardcoded agent configurations
- Use PyAgentSpec to load agents, not `new Agent()`
- Enables consistent agent definition across frameworks

**Relevance to Oracle Multi-Agent:**
- Standardizes agent configuration
- Enables framework-agnostic agent definitions
- Aligns with current persistent agent service architecture

---

### 4. Soul-Brews-Studio - Orchestration Pattern + UI

**Phase 0 Findings:**
- Practitioner's guide from 100 hours of building multi-agent systems
- Three tiers of orchestration: in-process subagents, coordinated teams, independent federation
- Battle-tested patterns with real metrics
- Hierarchical Pattern: CEO → Planner → Worker
- Hybrid Pattern alternative
- Dashboard design: Goal input, Realtime log, Agent status card, Approve button
- WebSocket for streaming logs (not polling)

**Phase 1+ Application:**
- Choose Hierarchical Pattern for oracle-multi-agent
- CEO agent manages overall strategy
- Planner agent breaks down tasks
- Worker agents execute specific tasks
- Dashboard on port 3456 with WebSocket streaming
- Human visibility and control through UI

**Relevance to Oracle Multi-Agent:**
- Provides proven orchestration pattern
- Dashboard aligns with current port 3456 setup
- WebSocket streaming improves real-time monitoring
- Hierarchical pattern fits team-based agent architecture

---

### 5. oracle-maw-guide - Memory + Safety

**Phase 0 Findings:**
- CLI tool for orchestrating multiple Oracle agents
- MAW (Multi-Agent Workflow) Lifecycle
- Circuit Breaker for safety
- 3-layer Memory system
- Fleet management: wake, peek, status
- Task & Project tracking
- Loops for scheduled tasks
- Crash recovery from Checkpoint

**Phase 1+ Application:**
- Implement MAW Lifecycle for agent management
- Add Circuit Breaker to prevent runaway agents
- Store 3-layer Memory in Oracle DB (not in-memory)
- Enable crash recovery from Checkpoint (no restart from scratch)
- Auto-register Agent Service every 10 seconds
- Backend crash → agents resume from saved state

**Relevance to Oracle Multi-Agent:**
- Critical for persistent agent service (port 4000)
- Solves current issue: agents don't persist state across restarts
- Provides safety mechanisms (Circuit Breaker)
- Aligns with Oracle DB requirement

---

## Integration Strategy for Oracle Multi-Agent

### Orchestration Pattern Selection
**Choice: Hierarchical Pattern from Soul-Brews**
- CEO (Manager agent) → Planner → Workers (Coder, Researcher, etc.)
- Fits current Mother agent role as manager
- Enables task distribution and coordination
- Proven in 100-hour production system

### State Management
**Choice: LangGraph StateGraph + OracleCheckpointer**
- Replace current while-loop orchestration
- Store state in Oracle DB for crash recovery
- Enable agents to resume after backend restart
- Aligns with MAW Guide checkpoint requirement

### Agent Definition
**Choice: PyAgentSpec YAML files**
- Move agent configs to `agents/*.yaml`
- No hardcoded configurations
- Use PyAgentSpec SDK for loading
- Enables framework-agnostic agent definitions

### Workflow
**Choice: Superpowers brainstorm → write-plan → execute**
- Mandatory planning before coding
- TDD with pytest
- YAGNI principle
- Critique Loop for quality

### Memory & Safety
**Choice: MAW Guide 3-layer Memory + Circuit Breaker**
- Store episodic, semantic, procedural memory in Oracle DB
- Add Circuit Breaker for safety
- Enable crash recovery from Checkpoint
- Auto-register persistent agents

### Dashboard
**Choice: Soul-Brews WebSocket Dashboard**
- Port 3456 (already in use)
- Goal input, Realtime log, Agent status cards, Approve button
- WebSocket streaming (not polling)
- Human visibility and control

---

## Implementation Phases

### Phase 0: RESEARCH ✅
- Read 5 sources
- Create comparison document
- Identify integration strategy

### Phase 1: PLANNING (requires OK)
- Design StateGraph orchestrator
- Design agent YAML structure
- Design OracleCheckpointer
- Plan MAW Lifecycle integration
- Plan Dashboard WebSocket upgrade

### Phase 2: EXECUTION (requires OK)
- Implement LangGraph StateGraph
- Implement OracleCheckpointer
- Convert agents to PyAgentSpec YAML
- Implement MAW Lifecycle
- Implement Circuit Breaker
- Upgrade Dashboard to WebSocket

### Phase 3: VALIDATION (requires OK)
- Test crash recovery
- Test auto-registration
- Test hierarchical orchestration
- Test memory persistence
- Test dashboard real-time updates

---

## Key Decisions

1. **Orchestration**: Use Hierarchical Pattern (CEO→Planner→Worker) from Soul-Brews
2. **State Engine**: Use LangGraph StateGraph with OracleCheckpointer
3. **Agent Config**: Use PyAgentSpec YAML files in `agents/` directory
4. **Workflow**: Use Superpowers brainstorm→write-plan→execute with TDD
5. **Memory**: Use MAW Guide 3-layer Memory in Oracle DB
6. **Dashboard**: Use Soul-Brews WebSocket design on port 3456
7. **Safety**: Implement Circuit Breaker from MAW Guide

---

## Open Questions

1. Should we use Python LangGraph or JS/TS LangGraph? (Current system is TypeScript)
2. How to integrate PyAgentSpec with TypeScript backend? (May need adapter)
3. Oracle DB schema for 3-layer memory?
4. Migration strategy for existing agents to YAML format?
