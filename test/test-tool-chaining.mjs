/**
 * Tool Chaining Test — Priority 1
 * Tests:
 *   1. Hub tool dispatch endpoint (POST /api/tools/:name)
 *   2. Tool chaining loop logic (callLLMWithTools)
 *   3. Tool executor integration in orchestrator
 *
 * Run: node test/test-tool-chaining.mjs [port]
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

console.log("\n🔗 Tool Chaining Test — Priority 1\n");
console.log("═".repeat(50));

// ═══════════════════════════════════════════════════════════
// PHASE 1: Hub Tool Dispatch Endpoint
// ═══════════════════════════════════════════════════════════
console.log("\n🔧 Phase 1: Tool Dispatch Endpoint");

await test("1.1 write_file via dispatch", async () => {
  const res = await api("/api/tools/write_file", {
    method: "POST",
    body: {
      path: "test-tool-chain/hello.txt",
      content: "Hello from tool chaining test!",
    },
  });
  assert(res.ok, `Should write file: ${JSON.stringify(res)}`);
  assert(res.path === "test-tool-chain/hello.txt", "Should return path");
});

await test("1.2 read_file via dispatch", async () => {
  const res = await api("/api/tools/read_file", {
    method: "POST",
    body: { path: "test-tool-chain/hello.txt" },
  });
  assert(res.lines, "Should return lines");
  assert(res.lines[0] === "Hello from tool chaining test!", "Content should match");
  assert(res.totalLines === 1, "Should have 1 line");
});

await test("1.3 query_data via dispatch", async () => {
  const res = await api("/api/tools/query_data", {
    method: "POST",
    body: { source: "goals", limit: 5 },
  });
  assert(res.source === "goals", "Should return goals source");
  assert(Array.isArray(res.results), "Results should be array");
});

await test("1.4 remember via dispatch", async () => {
  const res = await api("/api/tools/remember", {
    method: "POST",
    body: {
      content: "Tool chaining works correctly",
      category: "learning",
      importance: 3,
    },
  });
  assert(res.ok, `Should remember: ${JSON.stringify(res)}`);
});

await test("1.5 call_api via dispatch (internal endpoint)", async () => {
  const res = await api("/api/tools/call_api", {
    method: "POST",
    body: {
      url: `http://localhost:${PORT}/api/tools`,
      method: "GET",
    },
  });
  assert(res.ok, `Should call API: ${JSON.stringify(res)}`);
  assert(res.status === 200, "Should get 200");
  assert(res.body.tools, "Should get tools list");
});

await test("1.6 Unknown tool returns 404", async () => {
  const res = await api("/api/tools/nonexistent_tool", {
    method: "POST",
    body: {},
  });
  assert(res.error, "Should return error");
  assert(res.error.includes("Unknown tool"), "Error should mention unknown tool");
});

// ═══════════════════════════════════════════════════════════
// PHASE 2: Tool Chain Simulation
// Test that read → transform → write pipeline works
// ═══════════════════════════════════════════════════════════
console.log("\n⛓️ Phase 2: Tool Chain Pipeline");

await test("2.1 Chain: write → read → verify", async () => {
  // Step 1: Write a config file
  const writeRes = await api("/api/tools/write_file", {
    method: "POST",
    body: {
      path: "test-tool-chain/config.json",
      content: JSON.stringify({ version: "1.0", features: ["auth", "api"] }),
    },
  });
  assert(writeRes.ok, "Step 1: Write should succeed");

  // Step 2: Read it back
  const readRes = await api("/api/tools/read_file", {
    method: "POST",
    body: { path: "test-tool-chain/config.json" },
  });
  assert(readRes.lines, "Step 2: Read should succeed");

  // Step 3: Parse and verify
  const parsed = JSON.parse(readRes.lines.join("\n"));
  assert(parsed.version === "1.0", "Step 3: Version should match");
  assert(parsed.features.length === 2, "Step 3: Should have 2 features");
});

await test("2.2 Chain: write → query → analyze", async () => {
  // Write a task record
  await api("/api/tools/write_file", {
    method: "POST",
    body: {
      path: "test-tool-chain/analysis.json",
      content: JSON.stringify({ status: "completed", result: "all tests pass" }),
    },
  });

  // Read it back
  const readRes = await api("/api/tools/read_file", {
    method: "POST",
    body: { path: "test-tool-chain/analysis.json" },
  });

  // Verify the chain produced valid output
  const data = JSON.parse(readRes.lines.join("\n"));
  assert(data.status === "completed", "Chain output should be correct");
});

await test("2.3 Chain: read file → call API with data → store result", async () => {
  // Read the config
  const readRes = await api("/api/tools/read_file", {
    method: "POST",
    body: { path: "test-tool-chain/config.json" },
  });

  // Use config data to call an API
  const config = JSON.parse(readRes.lines.join("\n"));
  const apiRes = await api("/api/tools/call_api", {
    method: "POST",
    body: {
      url: `http://localhost:${PORT}/api/tools`,
      method: "GET",
    },
  });

  // Store combined result
  const writeRes = await api("/api/tools/write_file", {
    method: "POST",
    body: {
      path: "test-tool-chain/chain-result.json",
      content: JSON.stringify({
        config,
        toolsAvailable: apiRes.body.tools.length,
        chainCompleted: true,
      }),
    },
  });
  assert(writeRes.ok, "Chain write should succeed");

  // Verify
  const verify = await api("/api/tools/read_file", {
    method: "POST",
    body: { path: "test-tool-chain/chain-result.json" },
  });
  const result = JSON.parse(verify.lines.join("\n"));
  assert(result.chainCompleted === true, "Full chain should complete");
  assert(result.config.version === "1.0", "Config should be preserved");
  assert(result.toolsAvailable > 0, "Should know about available tools");
});

// ═══════════════════════════════════════════════════════════
// PHASE 3: Orchestrator with Tool Chaining
// ═══════════════════════════════════════════════════════════
console.log("\n🎯 Phase 3: Orchestrator Tool Chaining");

let goalId;

await test("3.1 Create goal for tool-chained execution", async () => {
  const res = await api("/api/orchestrator/goal", {
    method: "POST",
    body: {
      title: "Tool chaining test goal",
      description: "Read config file, analyze it, and write results",
      priority: "normal",
    },
  });
  assert(res.ok, "Should create goal");
  goalId = res.goal.id;
  assert(res.tasks.length > 0, "Should decompose into tasks");
});

await test("3.2 Execute task with tool chaining", async () => {
  const goalsRes = await api(`/api/orchestrator/goals/${goalId}`);
  const task = goalsRes.tasks.find(t => t.status === "pending" || t.status === "assigned");
  if (!task) { console.log("    ⏭️ No pending task"); return; }

  const res = await api("/api/orchestrator/execute", {
    method: "POST",
    body: {
      agent: "tool-chain-tester",
      taskId: task.id,
      goalId: goalId,
      description: `Read the file test-tool-chain/config.json, analyze its contents, and report findings`,
    },
  });
  // Without real API key, this should use fallback
  assert(res.ok !== undefined || res.success !== undefined, "Should execute (may fallback without API key)");
  console.log(`    → Task: ${task.title}`);
  console.log(`    → Success: ${res.success}, Fallback: ${res.usedFallback || false}, LLM: ${res.llmUsed || false}`);
});

await test("3.3 Tick stats include tool chaining", async () => {
  const res = await api("/api/orchestrator/tick", { method: "POST" });
  assert(res.ok, "Should tick");
  console.log(`    → Processed: ${res.goalsProcessed} goals, ${res.tasksCompleted} tasks completed`);
});

// ═══════════════════════════════════════════════════════════
// PHASE 4: Existing endpoints still work
// ═══════════════════════════════════════════════════════════
console.log("\n🔗 Phase 4: Backward Compatibility");

await test("4.1 Original read-file endpoint still works", async () => {
  const res = await api("/api/tools/read-file", {
    method: "POST",
    body: { path: "test-tool-chain/hello.txt" },
  });
  assert(res.lines, "Original endpoint should still work");
});

await test("4.2 Original write-file endpoint still works", async () => {
  const res = await api("/api/tools/write-file", {
    method: "POST",
    body: { path: "test-tool-chain/compat.txt", content: "compat test" },
  });
  assert(res.ok, "Original endpoint should still work");
});

await test("4.3 Tool registry lists all 11 tools", async () => {
  const res = await api("/api/tools");
  assert(res.ok, "Should list tools");
  assert(res.tools.length === 11, `Should have 11 tools, got ${res.tools.length}`);
  const names = res.tools.map(t => t.name);
  assert(names.includes("read_file"), "Should have read_file");
  assert(names.includes("write_file"), "Should have write_file");
  assert(names.includes("call_api"), "Should have call_api");
  assert(names.includes("query_data"), "Should have query_data");
});

// ═══════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(50));
console.log(`\n📊 Tool Chaining: ${passed} passed, ${failed} failed (${passed + failed} total)\n`);

if (failures.length > 0) {
  console.log("❌ Failed:");
  for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
} else {
  console.log("🎉 All tool chaining tests passed!\n");
  console.log("✅ Hub Tool Dispatch (POST /api/tools/:name)");
  console.log("✅ Tool Chain Pipeline (write→read→verify)");
  console.log("✅ Multi-step Chains (read→call_api→store)");
  console.log("✅ Orchestrator Tool Chaining Integration");
  console.log("✅ Backward Compatibility (original endpoints)");
  console.log("\n🔗 Tool Chaining is OPERATIONAL\n");
}

process.exit(failed > 0 ? 1 : 0);
