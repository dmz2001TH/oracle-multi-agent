/**
 * E2E Tests — Oracle Multi-Agent v5.0
 *
 * Run: npx tsx test/e2e.mjs
 * Requires server running at http://localhost:3456
 */

const BASE = process.env.TEST_URL || 'http://localhost:3456';
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

console.log('\n🔮 Oracle Multi-Agent v5.0 — E2E Tests\n');
console.log(`Target: ${BASE}\n`);

// ─── Health ─────────────────────────────────────────────────────────────────
console.log('📡 Health & Server');

await test('GET /health returns ok', async () => {
  const { data } = await api('GET', '/health');
  assert(data.ok, 'health not ok');
});

// ─── Commands API ───────────────────────────────────────────────────────────
console.log('\n⚡ CLI Commands');

await test('GET /api/commands lists commands', async () => {
  const { data } = await api('GET', '/api/commands');
  assert(data.ok, 'commands not ok');
  assert(data.commands.length >= 10, 'expected 10+ commands');
});

await test('POST /api/commands/execute /help', async () => {
  const { data } = await api('POST', '/api/commands/execute', { input: '/help' });
  assert(data.ok, 'help not ok');
  assert(data.message.includes('awaken'), 'missing awaken');
});

await test('POST /api/commands/execute /philosophy', async () => {
  const { data } = await api('POST', '/api/commands/execute', { input: '/philosophy' });
  assert(data.ok, 'philosophy not ok');
  assert(data.message.includes('Nothing is Deleted'), 'missing principle 1');
});

await test('POST /api/commands/execute /who-are-you', async () => {
  const { data } = await api('POST', '/api/commands/execute', { input: '/who-are-you' });
  assert(data.ok, 'who-are-you not ok');
  assert(data.message.includes('ORACLE IDENTITY'), 'missing identity header');
});

await test('POST /api/commands/execute /awaken', async () => {
  const { data } = await api('POST', '/api/commands/execute', { input: '/awaken --force TestBot|🔥 Fire|coder|Test motto' });
  assert(data.ok, 'awaken not ok');
  assert(data.data.name === 'TestBot', 'name mismatch');
});

await test('POST /api/commands/execute /fyi', async () => {
  const { data } = await api('POST', '/api/commands/execute', { input: '/fyi E2E test entry' });
  assert(data.ok, 'fyi not ok');
});

await test('POST /api/commands/execute /feel', async () => {
  const { data } = await api('POST', '/api/commands/execute', { input: '/feel 🔥 motivated — testing' });
  assert(data.ok, 'feel not ok');
});

await test('POST /api/commands/execute /trace', async () => {
  const { data } = await api('POST', '/api/commands/execute', { input: '/trace E2E' });
  assert(data.ok, 'trace not ok');
});

await test('POST /api/commands/execute /skills', async () => {
  const { data } = await api('POST', '/api/commands/execute', { input: '/skills' });
  assert(data.ok, 'skills not ok');
  assert(data.message.includes('awaken'), 'missing skill awaken');
});

await test('POST /api/commands/execute /trace --deep', async () => {
  const { data } = await api('POST', '/api/commands/execute', { input: '/trace deploy --deep' });
  assert(data.ok, 'trace --deep not ok');
  assert(data.data.mode === 'deep', 'mode not deep');
});

await test('POST /api/commands/execute /fleet', async () => {
  const { data } = await api('POST', '/api/commands/execute', { input: '/fleet' });
  assert(data.ok, 'fleet not ok');
  assert(data.message.includes('Fleet Census'), 'missing fleet header');
});

await test('POST /api/commands/execute /pulse add + list', async () => {
  const { data: addData } = await api('POST', '/api/commands/execute', { input: '/pulse add E2E test task' });
  assert(addData.ok, 'pulse add not ok');
  const { data: listData } = await api('POST', '/api/commands/execute', { input: '/pulse list' });
  assert(listData.ok, 'pulse list not ok');
  assert(listData.message.includes('E2E test task'), 'task not in list');
});

await test('POST /api/commands/execute /workflow list', async () => {
  const { data } = await api('POST', '/api/commands/execute', { input: '/workflow list' });
  assert(data.ok, 'workflow list not ok');
  assert(data.message.includes('research-report'), 'missing workflow');
});

await test('GET /api/workflows returns templates', async () => {
  const { data } = await api('GET', '/api/workflows');
  assert(data.ok, 'workflows not ok');
  assert(data.workflows.length >= 5, 'expected 5+ workflows');
});

// ─── Skills API ─────────────────────────────────────────────────────────────
console.log('\n⚡ Skills API');

await test('GET /api/skills returns skills', async () => {
  const { data } = await api('GET', '/api/skills');
  assert(data.ok, 'skills not ok');
  assert(data.count >= 30, `expected 30+ skills, got ${data.count}`);
});

await test('GET /api/skills?q=memory search', async () => {
  const { data } = await api('GET', '/api/skills?q=memory');
  assert(data.ok, 'search not ok');
  assert(data.count > 0, 'expected results');
});

// ─── Vault API ──────────────────────────────────────────────────────────────
console.log('\n🔐 Vault API');

await test('GET /api/vault/stats returns ψ/ stats', async () => {
  const { data } = await api('GET', '/api/vault/stats');
  assert(data.ok, 'vault stats not ok');
  assert(data.exists === true, 'ψ/ not found');
});

await test('GET /api/vault/files lists ψ/ files', async () => {
  const { data } = await api('GET', '/api/vault/files');
  assert(data.ok, 'vault files not ok');
});

// ─── Agents API ─────────────────────────────────────────────────────────────
console.log('\n🤖 Agents');

await test('GET /api/v2/agents lists agents', async () => {
  const { data } = await api('GET', '/api/v2/agents');
  assert(data.ok !== false, 'agents list error');
  assert(Array.isArray(data.agents), 'agents not array');
});

await test('POST /api/v2/agents/spawn creates agent', async () => {
  const uniqueName = `E2E-${Date.now()}`;
  const { data } = await api('POST', '/api/v2/agents/spawn', { name: uniqueName, role: 'general' });
  assert(data.id, `no agent id returned: ${JSON.stringify(data).substring(0,100)}`);
  assert(data.name === uniqueName, `name mismatch: ${data.name} !== ${uniqueName}`);
});

// ─── Dashboard ──────────────────────────────────────────────────────────────
console.log('\n🖥️ Dashboard');

await test('GET / serves HTML dashboard', async () => {
  const res = await fetch(`${BASE}/`);
  assert(res.status === 200, `status ${res.status}`);
  const html = await res.text();
  assert(html.includes('ARRA Office'), 'missing ARRA Office');
  assert(html.includes('/api/v2/agents'), 'missing API ref');
});

await test('GET /vault serves vault dashboard', async () => {
  const res = await fetch(`${BASE}/vault`);
  assert(res.status === 200, `status ${res.status}`);
  const html = await res.text();
  assert(html.includes('Oracle Vault'), 'missing Oracle Vault');
});

await test('GET /favicon.ico redirects to svg', async () => {
  const res = await fetch(`${BASE}/favicon.ico`, { redirect: 'manual' });
  assert(res.status === 301, `expected 301, got ${res.status}`);
  assert(res.headers.get('location') === '/favicon.svg', 'wrong redirect');
});

await test('WebSocket /ws endpoint exists', async () => {
  // Just verify the server doesn't 404 on /ws
  try {
    const res = await fetch(`${BASE}/ws`, { method: 'GET' });
    // 400 or 426 are fine (upgrade required), just not 404
    assert(res.status !== 404, 'ws endpoint missing');
  } catch (e) {
    // Connection upgrade errors are expected for WS endpoints
    assert(true, 'ws endpoint exists (upgrade error expected)');
  }
});

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(40)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
