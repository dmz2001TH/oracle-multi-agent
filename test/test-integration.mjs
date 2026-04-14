/**
 * Integration Tests — 10 New Features API Endpoints
 * Tests against a running Oracle Multi-Agent server.
 * Run: node test/test-integration.mjs [port]
 * Prerequisites: Start server first with `npm start`
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
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); }

async function api(path, opts = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
}

async function apiGet(path) { return api(path); }
async function apiPost(path, body) { return api(path, { method: "POST", body }); }

// ─── Server Health Check ───

console.log("\n🔮 Oracle Multi-Agent — Integration Tests\n");
console.log("═".repeat(50));
console.log(`\nServer: ${BASE}\n`);

console.log("🏥 Server Health");
await test("Server is running", async () => {
  const res = await apiGet("/api/stats");
  assert(res !== null, "Server should respond");
});

// ═══════════════════════════════════════════════════════════════════
// 1. MAILBOX API
// ═══════════════════════════════════════════════════════════════════
console.log("\n📬 1. Mailbox API");

await test("GET /api/mailbox/teams", async () => {
  const res = await apiGet("/api/mailbox/teams");
  assert(res.ok !== undefined || Array.isArray(res.teams), "Should return teams list");
});

await test("POST /api/mailbox/:team/:agent/send", async () => {
  const res = await apiPost("/api/mailbox/test-team/alice/send", {
    from: "cli",
    body: "integration test message",
    priority: "normal",
  });
  assert(res.ok !== undefined, "Should accept message");
});

await test("GET /api/mailbox/:team/:agent", async () => {
  const res = await apiGet("/api/mailbox/test-team/alice");
  assert(res.ok !== undefined || res.messages !== undefined, "Should return inbox");
});

await test("GET /api/mailbox/:team/status", async () => {
  const res = await apiGet("/api/mailbox/test-team/status");
  assert(res.ok !== undefined, "Should return team status");
});

// ═══════════════════════════════════════════════════════════════════
// 2. LINEAGE API
// ═══════════════════════════════════════════════════════════════════
console.log("\n🧬 2. Lineage API");

let testAgentId;

await test("POST /api/lineage/register", async () => {
  const res = await apiPost("/api/lineage/register", {
    name: "test-oracle",
    role: "general",
    tags: ["integration-test"],
  });
  assert(res.ok, "Should register agent");
  testAgentId = res.agent?.id;
});

await test("GET /api/lineage/:id", async () => {
  if (!testAgentId) { console.log("    ⏭️ Skipped (no agent id)"); return; }
  const res = await apiGet(`/api/lineage/${testAgentId}`);
  assert(res.ok, "Should find registered agent");
  assertEqual(res.agent.name, "test-oracle");
});

await test("POST /api/lineage/:parentId/bud", async () => {
  if (!testAgentId) { console.log("    ⏭️ Skipped (no agent id)"); return; }
  const res = await apiPost(`/api/lineage/${testAgentId}/bud`, {
    name: "child-oracle",
    role: "coder",
  });
  assert(res.ok, "Should bud child agent");
  assertEqual(res.child.generation, 1);
});

await test("GET /api/lineage/:id/ancestry", async () => {
  if (!testAgentId) { console.log("    ⏭️ Skipped (no agent id)"); return; }
  const res = await apiGet(`/api/lineage/${testAgentId}/ancestry`);
  assert(res.ok, "Should return ancestry");
});

await test("GET /api/lineage/:id/descendants", async () => {
  if (!testAgentId) { console.log("    ⏭️ Skipped (no agent id)"); return; }
  const res = await apiGet(`/api/lineage/${testAgentId}/descendants`);
  assert(res.ok, "Should return descendants");
});

await test("GET /api/lineage (stats + all agents)", async () => {
  const res = await apiGet("/api/lineage");
  assert(res.ok, "Should return lineage data");
  assert(res.stats.total > 0, "Should have registered agents");
});

await test("GET /api/lineage/:id/tree", async () => {
  if (!testAgentId) { console.log("    ⏭️ Skipped (no agent id)"); return; }
  const res = await apiGet(`/api/lineage/${testAgentId}/tree`);
  assert(res.ok, "Should return tree");
});

// ═══════════════════════════════════════════════════════════════════
// 3. ARCHIVE API
// ═══════════════════════════════════════════════════════════════════
console.log("\n💾 3. Archive API");

await test("POST /api/archive/:agent", async () => {
  const res = await apiPost("/api/archive/test-agent", {
    role: "general",
    reason: "manual",
    metadata: { test: true },
  });
  assert(res.ok, "Should archive session");
  assert(res.entry.files.length > 0, "Should have archived files");
});

await test("GET /api/archive/:agent", async () => {
  const res = await apiGet("/api/archive/test-agent");
  assert(res.ok, "Should list archives");
  assert(res.archives.length > 0, "Should have at least 1 archive");
});

await test("GET /api/archive-stats", async () => {
  const res = await apiGet("/api/archive-stats");
  assert(res.ok, "Should return archive stats");
  assert(res.stats.agents > 0, "Should count archived agents");
});

// ═══════════════════════════════════════════════════════════════════
// 4. HYBRID SEARCH API
// ═══════════════════════════════════════════════════════════════════
console.log("\n🔍 4. Hybrid Search API");

await test("GET /api/hybrid-search?q=test", async () => {
  const res = await apiGet("/api/hybrid-search?q=test");
  assert(res.ok, "Should return search results");
  assert(res.count >= 0, "Should have count");
});

await test("GET /api/hybrid-search (no query)", async () => {
  const res = await apiGet("/api/hybrid-search");
  assert(res.ok === false || res.error, "Should error without query");
});

await test("GET /api/hybrid-search/index-stats", async () => {
  const res = await apiGet("/api/hybrid-search/index-stats");
  assert(res.ok, "Should return index stats");
  assert(res.documents >= 0, "Should count documents");
});

// ═══════════════════════════════════════════════════════════════════
// 5. STANDING ORDERS API
// ═══════════════════════════════════════════════════════════════════
console.log("\n📋 5. Standing Orders API");

await test("POST /api/standing-orders/:agent", async () => {
  const res = await apiPost("/api/standing-orders/test-agent", {
    order: "Always use concise responses",
    priority: "high",
    category: "behavior",
  });
  assert(res.ok, "Should add standing order");
});

await test("GET /api/standing-orders/:agent", async () => {
  const res = await apiGet("/api/standing-orders/test-agent");
  assert(res.ok, "Should return orders");
  assert(res.orders.length > 0, "Should have at least 1 order");
});

await test("GET /api/standing-orders/:agent/prompt", async () => {
  const res = await apiGet("/api/standing-orders/test-agent/prompt");
  assert(res.ok, "Should return orders as prompt");
  assert(res.prompt.includes("concise"), "Prompt should contain order text");
});

await test("GET /api/standing-orders/:agent/stats", async () => {
  const res = await apiGet("/api/standing-orders/test-agent/stats");
  assert(res.ok, "Should return order stats");
});

await test("GET /api/standing-orders (all agents)", async () => {
  const res = await apiGet("/api/standing-orders");
  assert(res.ok, "Should return agents with orders");
});

// ═══════════════════════════════════════════════════════════════════
// 6. SWARM API
// ═══════════════════════════════════════════════════════════════════
console.log("\n🐝 6. Swarm API");

await test("POST /api/swarm/create", async () => {
  const res = await apiPost("/api/swarm/create", {
    topic: "Integration test topic",
    prompts: ["Research A", "Research B"],
    roles: ["researcher", "analyst"],
  });
  assert(res.ok, "Should create swarm task");
  assert(res.task.prompts.length === 2, "Should have 2 prompts");
});

await test("POST /api/swarm/fan-out", async () => {
  const res = await apiPost("/api/swarm/fan-out", {
    topic: "Test topic",
    angles: ["performance", "security"],
  });
  assert(res.ok, "Should fan-out research");
  assert(res.task.prompts.length === 2, "Should generate 2 sub-prompts");
});

await test("POST /api/swarm/review-trio", async () => {
  const res = await apiPost("/api/swarm/review-trio", {
    code: "function test() { return 42; }",
    description: "Test function",
  });
  assert(res.ok, "Should create review trio");
});

// ═══════════════════════════════════════════════════════════════════
// 7. FLEET SCAN API
// ═══════════════════════════════════════════════════════════════════
console.log("\n🚢 7. Fleet Scan API");

await test("GET /api/fleet-scan", async () => {
  const res = await apiGet("/api/fleet-scan");
  assert(res.ok, "Should return fleet report");
  assert(res.report.timestamp, "Should have timestamp");
  assert(res.formatted, "Should have formatted output");
});

// ═══════════════════════════════════════════════════════════════════
// 8. COST MODEL API
// ═══════════════════════════════════════════════════════════════════
console.log("\n💰 8. Cost Model API");

await test("POST /api/cost/calculate", async () => {
  const res = await apiPost("/api/cost/calculate", {
    model: "gpt-4",
    inputTokens: 1000,
    outputTokens: 500,
  });
  assert(res.ok, "Should calculate cost");
  assert(res.cost > 0, "Cost should be positive");
});

await test("POST /api/cost/log", async () => {
  const res = await apiPost("/api/cost/log", {
    agent: "test-agent",
    tier: "in-process",
    model: "gemini-2.0-flash",
    inputTokens: 1000,
    outputTokens: 500,
    task: "integration test",
  });
  assert(res.ok, "Should log cost entry");
});

await test("POST /api/cost/report", async () => {
  const res = await apiPost("/api/cost/report", {
    entries: [
      { tier: "in-process", agent: "a", costUsd: 0.01, model: "gpt-4", inputTokens: 100, outputTokens: 50 },
      { tier: "mailbox", agent: "b", costUsd: 0.001, model: "gemini", inputTokens: 100, outputTokens: 50 },
    ],
  });
  assert(res.ok, "Should generate report");
  assert(res.report.byTier.length > 0, "Should have tier summaries");
});

// ═══════════════════════════════════════════════════════════════════
// 9. WIREGUARD API
// ═══════════════════════════════════════════════════════════════════
console.log("\n🌐 9. WireGuard API");

await test("GET /api/wireguard/status", async () => {
  const res = await apiGet("/api/wireguard/status");
  assert(res.ok !== undefined, "Should return status");
});

await test("POST /api/wireguard/generate-config", async () => {
  const res = await apiPost("/api/wireguard/generate-config", {
    config: {
      nodeName: "test-node",
      interface: "wg0",
      token: "test-token",
      peers: [{ name: "peer1", publicKey: "peer-key=", endpoint: "10.0.0.2:51820", allowedIPs: ["10.0.0.2/32"] }],
    },
    privateKey: "test-key=",
  });
  assert(res.ok, "Should generate config");
  assert(res.config.includes("[Interface]"), "Config should have Interface section");
  assert(res.config.includes("[Peer]"), "Config should have Peer section");
});

// ═══════════════════════════════════════════════════════════════════
// 10. EXISTING API (Verify No Regression)
// ═══════════════════════════════════════════════════════════════════
console.log("\n🔄 10. Existing API (Regression Check)");

await test("GET /api/stats", async () => {
  const res = await apiGet("/api/stats");
  assert(res !== null, "Stats endpoint should work");
});

await test("GET /api/agents", async () => {
  const res = await apiGet("/api/agents");
  assert(Array.isArray(res), "Agents should be array");
});

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(50));
console.log(`\n📊 Integration Results: ${passed} passed, ${failed} failed (${passed + failed} total)\n`);

if (failures.length > 0) {
  console.log("❌ Failed tests:");
  for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  console.log("");
} else {
  console.log("🎉 All integration tests passed!\n");
}

process.exit(failed > 0 ? 1 : 0);
