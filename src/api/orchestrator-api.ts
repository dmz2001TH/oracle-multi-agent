/**
 * Autonomous Orchestrator API — REST endpoints for goal/orchestration
 */
import { Hono } from "hono";
import { AutonomousOrchestrator } from "../orchestrator/index.js";
import { listGoals, getGoal, getGoalProgress, formatGoalStatus, getReadyTasks, getTasksForGoal } from "../goals/index.js";
import { getExperienceStats, getAdvice, learnPatterns } from "../experience/index.js";
import { getHealingStats, learnHealingPatterns } from "../healing/index.js";
import { sendMessage } from "../mailbox/index.js";
import { manager, store } from "./agent-bridge.js";

export const orchestratorApi = new Hono();

// Initialize orchestrator singleton
const orchestrator = new AutonomousOrchestrator({
  teamName: "default",
  availableAgents: [],
  maxConcurrentTasks: 5,
  autoDecompose: true,
  autoAssign: true,
  learnFromOutcomes: true,
});

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
  const result = await orchestrator.executeTask(b.agent, b.taskId, b.goalId, b.description);
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
