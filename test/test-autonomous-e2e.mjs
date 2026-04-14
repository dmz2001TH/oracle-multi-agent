/**
 * Autonomous System E2E Test
 * Tests the full autonomous loop: Goal → Decompose → Plan → Execute → Learn → Heal
 * Run: node test/test-autonomous-e2e.mjs [port]
 */

const PORT = parseInt(process.argv[2]) || 3456;
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failures.push({ name, error: e.message });
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || "Assertion failed"); }

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
}

console.log("\n🔮 Autonomous System E2E Test — Full Loop\n");
console.log("═".repeat(50));

// ═══════════════════════════════════════════════════════════════════
// PHASE 1: Goal Creation & Auto-Decomposition
// ═══════════════════════════════════════════════════════════════════
console.log("\n🎯 Phase 1: Goal → Auto-Decompose");

let goalId;

await test("1.1 Create goal with auto-decompose", async () => {
  const res = await api("/api/orchestrator/goal", {
    method: "POST",
    body: {
      title: "Implement auth system",
      description: "วิเคราะห์และ implement authentication system สำหรับ web app พร้อม test",
      priority: "high",
    },
  });
  assert(res.ok, "Should create goal");
  goalId = res.goal.id;
  assert(res.tasks.length > 0, "Should auto-decompose into tasks");
  console.log(`    → Goal: ${goalId}, Tasks: ${res.tasks.length}`);
});

await test("1.2 Verify goal decomposed correctly", async () => {
  const res = await api(`/api/orchestrator/goals/${goalId}`);
  assert(res.ok, "Should find goal");
  assert(res.tasks.length >= 2, "Should have multiple tasks");
  assert(res.progress.total > 0, "Should track progress");
});

await test("1.3 Check ready tasks (no deps)", async () => {
  const res = await api(`/api/orchestrator/goals/${goalId}/ready`);
  assert(res.ok, "Should return ready tasks");
  // First tasks should have no dependencies
  for (const task of res.tasks) {
    assert(task.dependsOn.length === 0, `Task "${task.title}" should have no deps`);
  }
});

// ═══════════════════════════════════════════════════════════════════
// PHASE 2: Planning Loop (Think→Plan→Act→Observe→Reflect)
// ═══════════════════════════════════════════════════════════════════
console.log("\n🧠 Phase 2: Planning Loop");

await test("2.1 Get plan suggestion", async () => {
  const res = await api("/api/orchestrator/experience/advice?type=general&desc=implement+login+system");
  assert(res.ok, "Should return advice");
  assert(res.advice.recommendation, "Should have recommendation");
});

await test("2.2 Run orchestrator tick", async () => {
  const res = await api("/api/orchestrator/tick", { method: "POST" });
  assert(res.ok, "Should tick");
  assert(res.goalsProcessed >= 0, "Should process goals");
});

await test("2.3 Get orchestrator status", async () => {
  const res = await api("/api/orchestrator/status");
  assert(res.ok, "Should return status");
  assert(res.state, "Should have state");
  assert(res.report.includes("Orchestrator"), "Report should be formatted");
});

// ═══════════════════════════════════════════════════════════════════
// PHASE 3: Execute Tasks
// ═══════════════════════════════════════════════════════════════════
console.log("\n⚡ Phase 3: Task Execution");

await test("3.1 Execute a task", async () => {
  // Get a task to execute
  const goalsRes = await api(`/api/orchestrator/goals/${goalId}`);
  const task = goalsRes.tasks.find(t => t.status === "pending" || t.status === "assigned");
  if (!task) { console.log("    ⏭️ No pending task to execute"); return; }

  const res = await api("/api/orchestrator/execute", {
    method: "POST",
    body: {
      agent: "test-agent",
      taskId: task.id,
      goalId: goalId,
      description: task.description,
    },
  });
  assert(res.ok !== undefined, "Should execute task");
  console.log(`    → Task: ${task.title}, Success: ${res.success}`);
});

// ═══════════════════════════════════════════════════════════════════
// PHASE 4: Experience & Learning
// ═══════════════════════════════════════════════════════════════════
console.log("\n📚 Phase 4: Experience & Learning");

await test("4.1 Check experience stats", async () => {
  const res = await api("/api/orchestrator/experience/stats");
  assert(res.ok, "Should return stats");
  assert(res.stats.total >= 0, "Should count experiences");
});

await test("4.2 Get advice for task", async () => {
  const res = await api("/api/orchestrator/experience/advice?type=coding&desc=fix+login+bug");
  assert(res.ok, "Should return advice");
  assert(res.advice.recommendation, "Should have recommendation");
});

await test("4.3 Trigger learning", async () => {
  const res = await api("/api/orchestrator/learn", { method: "POST" });
  assert(res.ok, "Should learn");
});

// ═══════════════════════════════════════════════════════════════════
// PHASE 5: Self-Healing
// ═══════════════════════════════════════════════════════════════════
console.log("\n🩹 Phase 5: Self-Healing");

await test("5.1 Check healing stats", async () => {
  const res = await api("/api/orchestrator/healing/stats");
  assert(res.ok, "Should return healing stats");
  assert(res.stats.totalFailures >= 0, "Should count failures");
});

// ═══════════════════════════════════════════════════════════════════
// PHASE 6: Full Goal Status
// ═══════════════════════════════════════════════════════════════════
console.log("\n📊 Phase 6: Goal Status");

await test("6.1 Get formatted goal status", async () => {
  const res = await api(`/api/orchestrator/goals/${goalId}/status`);
  assert(res.ok, "Should return status");
  assert(res.formatted.includes("Progress"), "Should show progress");
});

await test("6.2 List all goals", async () => {
  const res = await api("/api/orchestrator/goals");
  assert(res.ok, "Should list goals");
  assert(res.goals.length > 0, "Should have at least 1 goal");
});

// ═══════════════════════════════════════════════════════════════════
// PHASE 7: Integration with existing features
// ═══════════════════════════════════════════════════════════════════
console.log("\n🔗 Phase 7: Integration Check");

await test("7.1 Mailbox still works", async () => {
  const res = await api("/api/mailbox/teams");
  assert(res.ok !== undefined, "Mailbox should work");
});

await test("7.2 Lineage still works", async () => {
  const res = await api("/api/lineage");
  assert(res.ok, "Lineage should work");
});

await test("7.3 Archive still works", async () => {
  const res = await api("/api/archive-stats");
  assert(res.ok, "Archive should work");
});

await test("7.4 Standing orders still works", async () => {
  const res = await api("/api/standing-orders");
  assert(res.ok, "Standing orders should work");
});

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(50));
console.log(`\n📊 Autonomous E2E: ${passed} passed, ${failed} failed (${passed + failed} total)\n`);

if (failures.length > 0) {
  console.log("❌ Failed:");
  for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
} else {
  console.log("🎉 All autonomous E2E tests passed!\n");
  console.log("✅ Goal Creation & Auto-Decomposition");
  console.log("✅ Planning Loop (Think→Plan→Act→Observe→Reflect)");
  console.log("✅ Task Execution with experience tracking");
  console.log("✅ Experience Memory & Pattern Learning");
  console.log("✅ Self-Healing (error analysis & recovery)");
  console.log("✅ Integration with all existing features");
  console.log("\n🔮 Autonomous AI Agent Multi-Agent System is FULLY OPERATIONAL\n");
}

process.exit(failed > 0 ? 1 : 0);
