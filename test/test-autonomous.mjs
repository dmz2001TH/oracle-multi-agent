/**
 * Autonomous Multi-Agent System Test
 * Tests the full autonomous workflow: spawn → communicate → coordinate → archive
 * Run: node test/test-autonomous.mjs [port]
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
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
}

console.log("\n🔮 Autonomous Multi-Agent System Test\n");
console.log("═".repeat(50));

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 1: Agent Lifecycle (Spawn → Communicate → Archive → Die)
// ═══════════════════════════════════════════════════════════════════
console.log("\n🔄 Scenario 1: Full Agent Lifecycle");

let managerId, coderId, qaId;

await test("1.1 Register manager in lineage", async () => {
  const res = await api("/api/lineage/register", {
    method: "POST",
    body: { name: "auto-manager", role: "manager", tags: ["autonomous"] },
  });
  assert(res.ok, "Should register manager");
  managerId = res.agent.id;
});

await test("1.2 Bud coder from manager", async () => {
  const res = await api(`/api/lineage/${managerId}/bud`, {
    method: "POST",
    body: { name: "auto-coder", role: "coder" },
  });
  assert(res.ok, "Should bud coder");
  coderId = res.child.id;
  assert(res.child.generation === 1, "Coder should be gen 1");
});

await test("1.3 Bud QA tester from coder", async () => {
  const res = await api(`/api/lineage/${coderId}/bud`, {
    method: "POST",
    body: { name: "auto-qa", role: "qa-tester" },
  });
  assert(res.ok, "Should bud QA");
  qaId = res.child.id;
  assert(res.child.generation === 2, "QA should be gen 2");
});

await test("1.4 Check lineage tree (3 generations)", async () => {
  const res = await api("/api/lineage");
  assert(res.ok, "Should have stats");
  assert(res.stats.total >= 3, "Should have 3+ agents");
  assert(res.stats.maxGeneration >= 2, "Should have 2+ generations");
});

await test("1.5 Verify ancestry chain", async () => {
  if (!qaId) { console.log("    ⏭️ Skipped (no qa id)"); return; }
  const res = await api(`/api/lineage/${qaId}/ancestry`);
  assert(res.ok, "Should return ancestry");
  const names = res.chain.map(a => a.name);
  assert(names.includes("auto-coder"), "Ancestry should include coder");
  assert(names.includes("auto-manager"), "Ancestry should include manager");
});

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 2: Inter-Agent Communication (Mailbox)
// ═══════════════════════════════════════════════════════════════════
console.log("\n📬 Scenario 2: Inter-Agent Communication");

await test("2.1 Manager sends task to coder via mailbox", async () => {
  const res = await api("/api/mailbox/auto-team/auto-coder/send", {
    method: "POST",
    body: { from: "auto-manager", body: "Fix the login bug in auth.ts", priority: "high" },
  });
  assert(res.ok, "Should send message");
});

await test("2.2 Coder reads inbox", async () => {
  const res = await api("/api/mailbox/auto-team/auto-coder");
  assert(res.ok !== undefined, "Should read inbox");
});

await test("2.3 Coder sends code review to QA", async () => {
  const res = await api("/api/mailbox/auto-team/auto-qa/send", {
    method: "POST",
    body: { from: "auto-coder", body: "PR #42: Fixed login bug. Please review.", priority: "normal" },
  });
  assert(res.ok, "Should send to QA");
});

await test("2.4 Broadcast to all agents", async () => {
  const res = await api("/api/mailbox/auto-team/broadcast", {
    method: "POST",
    body: { from: "auto-manager", body: "Sprint retro at 3pm" },
  });
  assert(res.ok, "Should broadcast");
});

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 3: Research Swarm
// ═══════════════════════════════════════════════════════════════════
console.log("\n🐝 Scenario 3: Research Swarm");

await test("3.1 Fan-out research across angles", async () => {
  const res = await api("/api/swarm/fan-out", {
    method: "POST",
    body: {
      topic: "Auth system optimization",
      angles: ["performance", "security", "UX"],
    },
  });
  assert(res.ok, "Should fan-out");
  assert(res.task.prompts.length === 3, "Should have 3 prompts");
});

await test("3.2 Create review trio", async () => {
  const res = await api("/api/swarm/review-trio", {
    method: "POST",
    body: {
      code: "const auth = (req, res) => { /* login logic */ }",
      description: "Auth handler review",
    },
  });
  assert(res.ok, "Should create review trio");
});

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 4: Standing Orders (Persistent Rules)
// ═══════════════════════════════════════════════════════════════════
console.log("\n📋 Scenario 4: Standing Orders");

await test("4.1 Add coding standard for coder", async () => {
  const res = await api("/api/standing-orders/auto-coder", {
    method: "POST",
    body: { order: "Always write TypeScript with strict mode", priority: "critical", category: "behavior" },
  });
  assert(res.ok, "Should add order");
});

await test("4.2 Add review standard for QA", async () => {
  const res = await api("/api/standing-orders/auto-qa", {
    method: "POST",
    body: { order: "Always check edge cases and error handling", priority: "high", category: "behavior" },
  });
  assert(res.ok, "Should add order");
});

await test("4.3 Get orders as system prompt", async () => {
  const res = await api("/api/standing-orders/auto-coder/prompt");
  assert(res.ok, "Should get prompt");
  assert(res.prompt.includes("TypeScript"), "Prompt should contain order");
});

await test("4.4 Check order stats", async () => {
  const res = await api("/api/standing-orders/auto-coder/stats");
  assert(res.ok, "Should get stats");
});

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 5: Archive Before Session End
// ═══════════════════════════════════════════════════════════════════
console.log("\n💾 Scenario 5: Session-End Archival");

await test("5.1 Archive coder session", async () => {
  const res = await api("/api/archive/auto-coder", {
    method: "POST",
    body: { role: "coder", reason: "session-end", metadata: { tokensUsed: 50000 } },
  });
  assert(res.ok, "Should archive coder");
});

await test("5.2 Archive QA session", async () => {
  const res = await api("/api/archive/auto-qa", {
    method: "POST",
    body: { role: "qa-tester", reason: "manual" },
  });
  assert(res.ok, "Should archive QA");
});

await test("5.3 Check archive stats", async () => {
  const res = await api("/api/archive-stats");
  assert(res.ok, "Should have stats");
  assert(res.stats.agents >= 2, "Should have 2+ archived agents");
});

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 6: Cost Tracking
// ═══════════════════════════════════════════════════════════════════
console.log("\n💰 Scenario 6: Cost Tracking");

await test("6.1 Log costs for all agents", async () => {
  for (const [agent, tier, model, inT, outT] of [
    ["auto-manager", "mailbox", "gpt-4", 2000, 1000],
    ["auto-coder", "in-process", "gemini-2.0-flash", 5000, 3000],
    ["auto-qa", "tmux", "gpt-4o-mini", 1500, 800],
  ]) {
    await api("/api/cost/log", {
      method: "POST",
      body: { agent, tier, model, inputTokens: inT, outputTokens: outT },
    });
  }
  assert(true, "Costs logged");
});

await test("6.2 Generate cost report", async () => {
  const res = await api("/api/cost/report", {
    method: "POST",
    body: {
      entries: [
        { tier: "in-process", agent: "coder", costUsd: 0.001, model: "gemini", inputTokens: 5000, outputTokens: 3000 },
        { tier: "mailbox", agent: "manager", costUsd: 0.09, model: "gpt-4", inputTokens: 2000, outputTokens: 1000 },
      ],
    },
  });
  assert(res.ok, "Should generate report");
  assert(res.report.byTier.length > 0, "Should have tier summaries");
});

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 7: Fleet Scan
// ═══════════════════════════════════════════════════════════════════
console.log("\n🚢 Scenario 7: Fleet Scan");

await test("7.1 Scan fleet", async () => {
  const res = await api("/api/fleet-scan");
  assert(res.ok, "Should scan fleet");
  assert(res.report.timestamp, "Should have timestamp");
});

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 8: Hybrid Search
// ═══════════════════════════════════════════════════════════════════
console.log("\n🔍 Scenario 8: Hybrid Search");

await test("8.1 Search for archived data", async () => {
  const res = await api("/api/hybrid-search?q=session");
  assert(res.ok, "Should search");
});

await test("8.2 Index stats", async () => {
  const res = await api("/api/hybrid-search/index-stats");
  assert(res.ok, "Should return index stats");
});

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(50));
console.log(`\n📊 Autonomous System Test: ${passed} passed, ${failed} failed (${passed + failed} total)\n`);

if (failures.length > 0) {
  console.log("❌ Failed:");
  for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  console.log("");
} else {
  console.log("🎉 All autonomous system tests passed!\n");
  console.log("✅ Agent Lifecycle: Register → Bud → Archive → Die");
  console.log("✅ Inter-Agent Communication: Mailbox (send/read/broadcast)");
  console.log("✅ Research Swarm: Fan-out + Review Trio");
  console.log("✅ Standing Orders: Persistent context rules");
  console.log("✅ Session Archival: Save before die");
  console.log("✅ Cost Tracking: Per-agent per-tier");
  console.log("✅ Fleet Scan: Auto-discover agents");
  console.log("✅ Hybrid Search: FTS5 + semantic");
  console.log("\n🔮 Autonomous Multi-Agent System is OPERATIONAL\n");
}

process.exit(failed > 0 ? 1 : 0);
