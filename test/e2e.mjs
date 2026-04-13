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

await test('GET /api/health returns ok', async () => {
  const { data } = await api('GET', '/api/health');
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
  const { data } = await api('POST', '/api/commands/execute', { input: '/awaken TestBot|🔥 Fire|coder|Test motto' });
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
});

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(40)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
