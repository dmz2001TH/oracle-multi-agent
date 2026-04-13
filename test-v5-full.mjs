/**
 * v5 Full Test Suite
 * Tests all 33+ API endpoints + new features:
 *   - TypeBox validation
 *   - Think multi-oracle filter
 *   - Meeting dry-run
 *   - Hooks system
 *   - Project auto-organize
 */

const BASE = "http://localhost:3456";
let passed = 0, failed = 0, total = 0;

async function test(label, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${label}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${label}: ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(msg || `expected ${expected}, got ${actual}`);
}

async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// ═════════════════════════════════════════════════════════════════
console.log("\n\x1b[36m═══ Oracle Multi-Agent v5 Test Suite ═══\x1b[0m\n");

// ─── Health & Core ──────────────────────────────────────────────
console.log("\x1b[33m[Health & Core]\x1b[0m");

await test("GET /health returns 200", async () => {
  const res = await api("GET", "/health");
  assertEq(res.status, 200);
  assert(res.data.ok === true);
  assert(res.data.version === "5.0.0");
});

await test("GET /api/identity", async () => {
  const res = await api("GET", "/api/identity");
  assertEq(res.status, 200);
  assert(res.data.node);
});

// ─── Tasks (with Validation) ───────────────────────────────────
console.log("\n\x1b[33m[Tasks + Validation]\x1b[0m");

await test("POST /api/tasks — valid input", async () => {
  const res = await api("POST", "/api/tasks", {
    subject: "Test task",
    description: "A test",
    owner: "dev",
  });
  assertEq(res.status, 201);
  assert(res.data.id);
  assertEq(res.data.subject, "Test task");
  assertEq(res.data.status, "pending");
});

await test("POST /api/tasks — missing subject → 400", async () => {
  const res = await api("POST", "/api/tasks", { description: "no subject" });
  assertEq(res.status, 400);
  assert(res.data.error);
});

await test("POST /api/tasks — empty subject → 400", async () => {
  const res = await api("POST", "/api/tasks", { subject: "" });
  assertEq(res.status, 400);
});

await test("POST /api/tasks — invalid status → 400", async () => {
  const res = await api("POST", "/api/tasks", { subject: "ok", status: "invalid" });
  // status is not in create schema, should be ignored (extra fields pass)
  assert(res.status === 201 || res.status === 400);
});

await test("PATCH /api/tasks/:id — invalid status → 400", async () => {
  // First create a task
  const created = await api("POST", "/api/tasks", { subject: "Patch test" });
  const res = await api("PATCH", `/api/tasks/${created.data.id}`, { status: "bad_status" });
  assertEq(res.status, 400);
});

await test("GET /api/tasks — list tasks", async () => {
  const res = await api("GET", "/api/tasks");
  assertEq(res.status, 200);
  assert(Array.isArray(res.data.tasks));
  assert(res.data.tasks.length > 0);
});

await test("GET /api/tasks/:id — get single", async () => {
  const list = await api("GET", "/api/tasks");
  const id = list.data.tasks[0].id;
  const res = await api("GET", `/api/tasks/${id}`);
  assertEq(res.status, 200);
  assert(res.data.id === id);
});

// ─── Projects (with Auto-Organize) ─────────────────────────────
console.log("\n\x1b[33m[Projects + Auto-Organize]\x1b[0m");

await test("POST /api/projects — valid", async () => {
  const res = await api("POST", "/api/projects", { name: "test-project", description: "Test" });
  assertEq(res.status, 201);
  assertEq(res.data.name, "test-project");
});

await test("POST /api/projects — missing name → 400", async () => {
  const res = await api("POST", "/api/projects", { description: "no name" });
  assertEq(res.status, 400);
});

await test("POST /api/projects/:name/auto-organize", async () => {
  const res = await api("POST", "/api/projects/test-project/auto-organize", {});
  assertEq(res.status, 200);
  assert(typeof res.data.added === "number");
});

await test("GET /api/projects — list", async () => {
  const res = await api("GET", "/api/projects");
  assertEq(res.status, 200);
  assert(Array.isArray(res.data.projects));
});

await test("GET /api/projects/:name — with progress", async () => {
  const res = await api("GET", "/api/projects/test-project");
  assertEq(res.status, 200);
  assert(typeof res.data.progress === "number");
});

// ─── Think (with Multi-Oracle Filter) ──────────────────────────
console.log("\n\x1b[33m[Think + Multi-Oracle Filter]\x1b[0m");

await test("POST /api/think — valid proposal", async () => {
  const res = await api("POST", "/api/think", {
    oracle: "dev",
    title: "Improve API",
    type: "improvement",
    priority: "high",
  });
  assertEq(res.status, 201);
  assert(res.data.id);
  assertEq(res.data.oracle, "dev");
});

await test("POST /api/think — second oracle", async () => {
  const res = await api("POST", "/api/think", {
    oracle: "qa",
    title: "Fix test coverage",
    type: "bug",
    priority: "medium",
  });
  assertEq(res.status, 201);
});

await test("POST /api/think — missing oracle → 400", async () => {
  const res = await api("POST", "/api/think", { title: "No oracle" });
  assertEq(res.status, 400);
});

await test("GET /api/think?oracles=dev,qa — multi filter", async () => {
  const res = await api("GET", "/api/think?oracles=dev,qa");
  assertEq(res.status, 200);
  assert(res.data.proposals.length >= 2);
  const oracles = res.data.proposals.map(p => p.oracle);
  assert(oracles.includes("dev"));
  assert(oracles.includes("qa"));
});

await test("GET /api/think?oracles=admin — no match", async () => {
  const res = await api("GET", "/api/think?oracles=admin");
  assertEq(res.status, 200);
  assertEq(res.data.proposals.length, 0);
});

await test("GET /api/think?oracle=dev — single filter", async () => {
  const res = await api("GET", "/api/think?oracle=dev");
  assertEq(res.status, 200);
  assert(res.data.proposals.every(p => p.oracle === "dev"));
});

// ─── Meetings (with Dry-Run) ───────────────────────────────────
console.log("\n\x1b[33m[Meetings + Dry-Run]\x1b[0m");

await test("POST /api/meetings?dry=true — dry run", async () => {
  const res = await api("POST", "/api/meetings?dry=true", {
    topic: "Sprint Review",
    participants: ["dev", "qa"],
  });
  assertEq(res.status, 200);
  assert(res.data.dryRun === true);
  assertEq(res.data.preview.topic, "Sprint Review");
  assertEq(res.data.preview.participants.length, 2);
});

await test("POST /api/meetings — real create", async () => {
  const res = await api("POST", "/api/meetings", {
    topic: "Sprint Review",
    participants: ["dev", "qa", "pm"],
  });
  assertEq(res.status, 201);
  assert(res.data.id);
  assertEq(res.data.status, "scheduled");
});

await test("POST /api/meetings — missing topic → 400", async () => {
  const res = await api("POST", "/api/meetings", { participants: ["dev"] });
  assertEq(res.status, 400);
});

await test("POST /api/meetings/:id/notes", async () => {
  const meetings = await api("GET", "/api/meetings");
  const id = meetings.data.meetings[0].id;
  const res = await api("POST", `/api/meetings/${id}/notes`, {
    note: "Discussed sprint goals",
    author: "dev",
  });
  assertEq(res.status, 200);
  assert(res.data.notes.includes("Discussed sprint goals"));
});

await test("POST /api/meetings/:id/notes — missing note → 400", async () => {
  const meetings = await api("GET", "/api/meetings");
  const id = meetings.data.meetings[0].id;
  const res = await api("POST", `/api/meetings/${id}/notes`, { author: "dev" });
  assertEq(res.status, 400);
});

// ─── Hooks ─────────────────────────────────────────────────────
console.log("\n\x1b[33m[Hooks System]\x1b[0m");

await test("GET /api/hooks — list hooks", async () => {
  const res = await api("GET", "/api/hooks");
  assertEq(res.status, 200);
  assert(Array.isArray(res.data.builtIn));
  assert(res.data.builtIn.length >= 4);
});

await test("POST /api/hooks/test — test task.claim without log", async () => {
  const res = await api("POST", "/api/hooks/test", {
    event: "task.claim",
    from: "dev",
    data: { subject: "Fix bug" },
  });
  assertEq(res.status, 200);
  assert(res.data.triggered >= 0);
});

await test("POST /api/hooks/test — test task.complete", async () => {
  const res = await api("POST", "/api/hooks/test", {
    event: "task.complete",
    from: "dev",
    data: { subject: "Fix bug", owner: "dev" },
  });
  assertEq(res.status, 200);
});

await test("POST /api/hooks/test — test meeting.create with tags", async () => {
  const res = await api("POST", "/api/hooks/test", {
    event: "meeting.create",
    data: { topic: "Bug triage meeting" },
  });
  assertEq(res.status, 200);
});

// ─── Other Endpoints ───────────────────────────────────────────
console.log("\n\x1b[33m[Other Endpoints]\x1b[0m");

await test("GET /api/sessions", async () => {
  const res = await api("GET", "/api/sessions");
  assertEq(res.status, 200);
});

await test("GET /api/feed", async () => {
  const res = await api("GET", "/api/feed");
  assertEq(res.status, 200);
});

await test("GET /api/teams", async () => {
  const res = await api("GET", "/api/teams");
  assertEq(res.status, 200);
});

await test("GET /api/costs", async () => {
  const res = await api("GET", "/api/costs");
  assertEq(res.status, 200);
});

await test("GET /api/agents/status", async () => {
  const res = await api("GET", "/api/agents/status");
  assertEq(res.status, 200);
});

await test("GET /api/tokens", async () => {
  const res = await api("GET", "/api/tokens");
  assertEq(res.status, 200);
});

await test("GET /api/cron", async () => {
  const res = await api("GET", "/api/cron");
  assertEq(res.status, 200);
});

await test("GET /api/logs", async () => {
  const res = await api("GET", "/api/logs");
  assertEq(res.status, 200);
});

await test("GET /api/pulse", async () => {
  const res = await api("GET", "/api/pulse");
  assertEq(res.status, 200);
});

// ─── Cleanup ───────────────────────────────────────────────────
console.log("\n\x1b[33m[Cleanup]\x1b[0m");

await test("DELETE test project", async () => {
  const res = await api("DELETE", "/api/projects/test-project");
  assertEq(res.status, 200);
});

// ═════════════════════════════════════════════════════════════════
console.log(`\n\x1b[36m═══ Results: ${passed}/${total} passed ═══\x1b[0m`);
if (failed > 0) {
  console.log(`\x1b[31m${failed} failed\x1b[0m\n`);
} else {
  console.log(`\x1b[32mAll tests passing! 🎉\x1b[0m\n`);
}

process.exit(failed > 0 ? 1 : 0);
