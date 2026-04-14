/**
 * Autonomous Orchestrator API — REST endpoints for goal/orchestration
 */
import { Hono } from "hono";
import { AutonomousOrchestrator } from "../orchestrator/index.js";
import { listGoals, getGoal, getGoalProgress, formatGoalStatus, getReadyTasks, getTasksForGoal, mergeGoalResults } from "../goals/index.js";
import { getExperienceStats, getAdvice, learnPatterns } from "../experience/index.js";
import { getHealingStats, learnHealingPatterns } from "../healing/index.js";
import { sendMessage } from "../mailbox/index.js";
import { manager, store } from "./agent-bridge.js";

export const orchestratorApi = new Hono();

// Initialize orchestrator singleton with LLM config from env
const mimoKey = process.env.MIMO_API_KEY || "";
const mimoBase = process.env.MIMO_API_BASE || "https://api.xiaomimimo.com/v1";
const provider = process.env.LLM_PROVIDER || "mimo";
const agentModel = process.env.AGENT_MODEL || "mimo-v2-pro";

const orchestrator = new AutonomousOrchestrator({
  teamName: "default",
  availableAgents: [],
  maxConcurrentTasks: 5,
  autoDecompose: true,
  autoAssign: true,
  learnFromOutcomes: true,
  hubUrl: `http://localhost:${process.env.HUB_PORT || 3456}`,
  llmConfig: mimoKey ? {
    provider: provider as "mimo" | "gemini",
    apiKey: mimoKey,
    apiBase: mimoBase,
    model: agentModel,
    timeoutMs: 30000,
  } : undefined,
});

// ─── Priority 3: Auto-tick via setInterval ───────────────────
const TICK_INTERVAL_MS = parseInt(process.env.ORCHESTRATOR_TICK_MS || "15000"); // default 15s
let tickRunning = false;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let tickStats = { totalTicks: 0, totalGoals: 0, totalTasks: 0, totalFailures: 0, lastTick: "" };

function startAutoTick() {
  if (tickTimer) return;
  console.log(`⏱️ Orchestrator auto-tick every ${TICK_INTERVAL_MS}ms`);
  tickTimer = setInterval(async () => {
    if (tickRunning) return; // skip if previous tick still running
    tickRunning = true;
    try {
      syncAvailableAgents();
      const result = await orchestrator.tick();
      tickStats.totalTicks++;
      tickStats.totalGoals += result.goalsProcessed;
      tickStats.totalTasks += result.tasksCompleted + result.tasksFailed;
      tickStats.totalFailures += result.tasksFailed;
      tickStats.lastTick = new Date().toISOString();

      if (result.goalsProcessed > 0) {
        console.log(`⏱️ Tick #${tickStats.totalTicks}: goals=${result.goalsProcessed} tasks+${result.tasksCompleted} fail=${result.tasksFailed} recoveries=${result.recoveries}`);
      }
    } catch (err: any) {
      console.warn(`⚠️ Tick error: ${err.message}`);
    } finally {
      tickRunning = false;
    }
  }, TICK_INTERVAL_MS);
}

function stopAutoTick() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
    console.log("⏱️ Auto-tick stopped");
  }
}

// ─── Priority 4: Agent Store Cleanup (TTL) ────────────────────
const AGENT_TTL_MS = parseInt(process.env.AGENT_TTL_MS || String(30 * 60 * 1000)); // default 30min
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function cleanupIdleAgents() {
  try {
    const running = manager.getRunningAgents();
    const registered = (store.listAgents() as any[]);
    const now = Date.now();
    let killed = 0;

    for (const agent of registered) {
      // Only cleanup auto-spawned agents
      if (!(agent as any).name?.startsWith("auto-")) continue;

      const runningAgent = running.find((r: any) => r.id === (agent as any).id);
      if (!runningAgent) continue; // not running, skip

      const lastActive = ((agent as any).last_active || (agent as any).created_at || 0) * 1000;
      const idleMs = now - lastActive;

      if (idleMs > AGENT_TTL_MS) {
        console.log(`🧹 TTL cleanup: ${(agent as any).name} (idle ${Math.round(idleMs / 60000)}min)`);
        try {
          manager.stopAgent((agent as any).id);
          killed++;
        } catch {}
      }
    }

    if (killed > 0) {
      console.log(`🧹 Cleaned up ${killed} idle agent(s)`);
    }
  } catch (err: any) {
    console.warn(`⚠️ Cleanup error: ${err.message}`);
  }
}

// Run cleanup every 5 minutes
cleanupTimer = setInterval(cleanupIdleAgents, 5 * 60 * 1000);

// Start auto-tick immediately (can be toggled via API)
startAutoTick();

// ─── Auto-Spawn: Listen for spawn requests from orchestrator ───
orchestrator.on("spawn_request", async ({ role, reason, task }) => {
  const timestamp = Date.now().toString(36);
  const agentName = `auto-${role}-${timestamp}`;
  console.log(`🤖 Orchestrator auto-spawning: ${agentName} (${role}) — ${reason}`);
  try {
    const agent = await manager.spawnAgent(agentName, role);
    console.log(`✅ Auto-spawned ${agentName} (${role})`);
  } catch (err: any) {
    console.warn(`⚠️ Auto-spawn failed for ${agentName}: ${err.message}`);
  }
});

// ─── Sync available agents before each goal/tick ───
function syncAvailableAgents() {
  try {
    const registered = store.listAgents();
    const running = manager.getRunningAgents();
    const runningIds = new Set(running.map((r: any) => r.id));
    orchestrator.updateAvailableAgents(
      registered.map((a: any) => ({
        name: a.name,
        role: a.role || "general",
        status: runningIds.has(a.id) ? "active" : "idle",
      }))
    );
  } catch {}
}

// ─── Goals ───

orchestratorApi.post("/api/orchestrator/goal", async (c) => {
  const b = await c.req.json();
  const result = await orchestrator.pursueGoal(b.title, b.description, {
    priority: b.priority,
    autoDecompose: b.autoDecompose,
  });
  return c.json({ ok: true, goal: result.goal, tasks: result.tasks });
});

orchestratorApi.get("/api/orchestrator/goals", (c) => {
  const status = c.req.query("status") as any;
  return c.json({ ok: true, goals: listGoals(status ? { status } : undefined) });
});

orchestratorApi.get("/api/orchestrator/goals/:id", (c) => {
  const goal = getGoal(c.req.param("id"));
  if (!goal) return c.json({ ok: false, error: "Goal not found" }, 404);
  const progress = getGoalProgress(goal.id);
  const tasks = getTasksForGoal(goal.id);
  return c.json({ ok: true, goal, progress, tasks });
});

orchestratorApi.get("/api/orchestrator/goals/:id/status", (c) => {
  return c.json({ ok: true, formatted: formatGoalStatus(c.req.param("id")) });
});

orchestratorApi.get("/api/orchestrator/goals/:id/ready", (c) => {
  return c.json({ ok: true, tasks: getReadyTasks(c.req.param("id")) });
});

// ── FIX #3: Merge results endpoint ──
orchestratorApi.post("/api/orchestrator/goals/:id/merge", (c) => {
  const goalId = c.req.param("id");
  const merged = mergeGoalResults(goalId);
  return c.json({ ok: true, mergedResult: merged });
});

// ─── Tick (process one cycle) ───

orchestratorApi.post("/api/orchestrator/tick", async () => {
  const result = await orchestrator.tick();
  return new Response(JSON.stringify({ ok: true, ...result }), {
    headers: { "Content-Type": "application/json" },
  });
});

// ─── Execute Task ───

orchestratorApi.post("/api/orchestrator/execute", async (c) => {
  const b = await c.req.json();
  // Look up task description from goal store if not provided
  let description = b.description;
  let agentName = b.agent || "general";
  if (!description && b.goalId) {
    const tasks = getTasksForGoal(b.goalId);
    const task = tasks.find((t: any) => t.id === b.taskId);
    if (task) {
      description = task.description || task.title;
    }
  }
  if (!description) {
    description = b.taskId || "untitled task";
  }
  syncAvailableAgents();
  const result = await orchestrator.executeTask(agentName, b.taskId, b.goalId, description);
  return c.json({ ok: true, ...result });
});

// ─── Status ───

orchestratorApi.get("/api/orchestrator/status", (c) => {
  return c.json({ ok: true, report: orchestrator.getStatusReport(), state: orchestrator.getState() });
});

// ─── Experience ───

orchestratorApi.get("/api/orchestrator/experience/stats", (c) => {
  return c.json({ ok: true, stats: getExperienceStats() });
});

orchestratorApi.get("/api/orchestrator/experience/advice", (c) => {
  const taskType = c.req.query("type") || "general";
  const desc = c.req.query("desc") || "";
  return c.json({ ok: true, advice: getAdvice(taskType, desc) });
});

orchestratorApi.post("/api/orchestrator/learn", () => {
  orchestrator.learn();
  return new Response(JSON.stringify({ ok: true, message: "Patterns learned" }), {
    headers: { "Content-Type": "application/json" },
  });
});

// ─── Healing ───

orchestratorApi.get("/api/orchestrator/healing/stats", (c) => {
  return c.json({ ok: true, stats: getHealingStats() });
});

// ─── Priority 3: Auto-Tick Control ───

orchestratorApi.get("/api/orchestrator/tick/stats", (c) => {
  return c.json({
    ok: true,
    autoTickEnabled: tickTimer !== null,
    intervalMs: TICK_INTERVAL_MS,
    stats: tickStats,
  });
});

orchestratorApi.post("/api/orchestrator/tick/start", (c) => {
  startAutoTick();
  return c.json({ ok: true, message: "Auto-tick started", intervalMs: TICK_INTERVAL_MS });
});

orchestratorApi.post("/api/orchestrator/tick/stop", (c) => {
  stopAutoTick();
  return c.json({ ok: true, message: "Auto-tick stopped" });
});
