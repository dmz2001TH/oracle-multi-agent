/**
 * Fleet Management — Agent lifecycle: wake/sleep/peek/overview
 *
 * Inspired by maw's fleet system:
 *   - maw wake / maw sleep / maw peek
 *   - maw oracle ls — status of all agents
 *   - maw overview — war room view
 *   - maw stop — graceful shutdown
 */

import { EventEmitter } from "events";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type AgentLifecycle = "sleeping" | "waking" | "awake" | "working" | "idle" | "stopping";

export interface FleetAgent {
  name: string;
  role: string;
  lifecycle: AgentLifecycle;
  currentTask?: string;
  lastActivity: number;
  spawnedAt: number;
  worktree?: string; // git worktree path for isolation
  metadata?: Record<string, any>;
}

export interface FleetOverview {
  agents: FleetAgent[];
  totalAwake: number;
  totalWorking: number;
  totalIdle: number;
  totalSleeping: number;
}

// ═══════════════════════════════════════════════════════════
// Fleet Registry
// ═══════════════════════════════════════════════════════════

const fleet: Map<string, FleetAgent> = new Map();
const fleetBus = new EventEmitter();

/**
 * Register an agent in the fleet
 */
export function registerAgent(params: {
  name: string;
  role: string;
  worktree?: string;
  metadata?: Record<string, any>;
}): FleetAgent {
  const agent: FleetAgent = {
    name: params.name,
    role: params.role,
    lifecycle: "sleeping",
    lastActivity: Date.now(),
    spawnedAt: Date.now(),
    worktree: params.worktree,
    metadata: params.metadata,
  };
  fleet.set(params.name, agent);
  fleetBus.emit("fleet:registered", agent);
  return agent;
}

/**
 * Wake an agent — transition sleeping → awake
 */
export function wakeAgent(name: string, task?: string): FleetAgent | undefined {
  const agent = fleet.get(name);
  if (!agent) return undefined;
  agent.lifecycle = task ? "working" : "awake";
  agent.currentTask = task;
  agent.lastActivity = Date.now();
  fleet.set(name, agent);
  fleetBus.emit("fleet:wake", agent);
  return agent;
}

/**
 * Sleep an agent — transition awake/working → sleeping
 */
export function sleepAgent(name: string): FleetAgent | undefined {
  const agent = fleet.get(name);
  if (!agent) return undefined;
  agent.lifecycle = "sleeping";
  agent.currentTask = undefined;
  agent.lastActivity = Date.now();
  fleet.set(name, agent);
  fleetBus.emit("fleet:sleep", agent);
  return agent;
}

/**
 * Mark agent as idle (between tasks)
 */
export function idleAgent(name: string): FleetAgent | undefined {
  const agent = fleet.get(name);
  if (!agent) return undefined;
  agent.lifecycle = "idle";
  agent.currentTask = undefined;
  agent.lastActivity = Date.now();
  fleet.set(name, agent);
  fleetBus.emit("fleet:idle", agent);
  return agent;
}

/**
 * Assign task to agent — transition idle/awake → working
 */
export function assignWork(name: string, task: string): FleetAgent | undefined {
  const agent = fleet.get(name);
  if (!agent) return undefined;
  agent.lifecycle = "working";
  agent.currentTask = task;
  agent.lastActivity = Date.now();
  fleet.set(name, agent);
  fleetBus.emit("fleet:working", agent);
  return agent;
}

/**
 * Peek — see what an agent is doing
 */
export function peekAgent(name: string): FleetAgent | undefined {
  return fleet.get(name);
}

/**
 * List all agents — maw oracle ls
 */
export function listFleet(): FleetAgent[] {
  return [...fleet.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get fleet overview — war room view
 */
export function getFleetOverview(): FleetOverview {
  const agents = [...fleet.values()];
  return {
    agents,
    totalAwake: agents.filter(a => a.lifecycle !== "sleeping").length,
    totalWorking: agents.filter(a => a.lifecycle === "working").length,
    totalIdle: agents.filter(a => a.lifecycle === "idle").length,
    totalSleeping: agents.filter(a => a.lifecycle === "sleeping").length,
  };
}

/**
 * Format fleet status — maw oracle ls style
 */
export function formatFleet(): string {
  const agents = listFleet();
  if (agents.length === 0) return "No agents registered. Spawn one to begin.";

  const lines: string[] = [
    "🚢 Fleet Status",
    "═".repeat(50),
  ];

  for (const agent of agents) {
    const icon = agent.lifecycle === "working" ? "🔄"
      : agent.lifecycle === "idle" ? "💤"
      : agent.lifecycle === "awake" ? "🟢"
      : agent.lifecycle === "sleeping" ? "⭕"
      : "⏳";
    const task = agent.currentTask ? ` — ${agent.currentTask}` : "";
    const idleTime = Math.round((Date.now() - agent.lastActivity) / 60000);
    lines.push(`${icon} ${agent.name} (${agent.role}) [${agent.lifecycle}]${task} — idle ${idleTime}m`);
  }

  const overview = getFleetOverview();
  lines.push(`\n📊 ${overview.totalAwake} awake | ${overview.totalWorking} working | ${overview.totalIdle} idle | ${overview.totalSleeping} sleeping`);

  return lines.join("\n");
}

/**
 * Stop all agents gracefully
 */
export function stopAll(): string[] {
  const stopped: string[] = [];
  for (const [name, agent] of fleet) {
    if (agent.lifecycle !== "sleeping") {
      agent.lifecycle = "stopping";
      agent.lastActivity = Date.now();
      fleetBus.emit("fleet:stopping", agent);
      // After a moment, transition to sleeping
      setTimeout(() => {
        sleepAgent(name);
      }, 1000);
      stopped.push(name);
    }
  }
  return stopped;
}

/**
 * Wake all sleeping agents
 */
export function wakeAll(): string[] {
  const awoken: string[] = [];
  for (const [name, agent] of fleet) {
    if (agent.lifecycle === "sleeping") {
      wakeAgent(name);
      awoken.push(name);
    }
  }
  return awoken;
}

/**
 * Deregister an agent from fleet
 */
export function deregisterAgent(name: string): boolean {
  const existed = fleet.delete(name);
  if (existed) fleetBus.emit("fleet:deregistered", { name });
  return existed;
}

// ═══════════════════════════════════════════════════════════
// Event Bus
// ═══════════════════════════════════════════════════════════

export function onFleetEvent(event: string, handler: (...args: any[]) => void): () => void {
  fleetBus.on(event, handler);
  return () => fleetBus.off(event, handler);
}
