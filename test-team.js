// Test: 2 agents talking to each other
import { HubServer } from './src/hub/server.js';

const hub = new HubServer({ port: 3456, dbPath: './data/test.db', provider: 'promptdee' });
await hub.start();

console.log('\n===== TEAM COMMUNICATION TEST =====\n');

// Step 1: Spawn Manager
console.log('1. Spawning Manager...');
const manager = await hub.agentManager.spawnAgent('Manager', 'manager', 'direct, brief. Team: Coder');
console.log(`   ✅ ${manager.name} (${manager.id.slice(0,8)})`);

// Wait for agent to be ready
await new Promise(r => setTimeout(r, 3000));

// Step 2: Spawn Coder  
console.log('\n2. Spawning Coder...');
const coder = await hub.agentManager.spawnAgent('Coder', 'coder', 'precise, clean code lover');
console.log(`   ✅ ${coder.name} (${coder.id.slice(0,8)})`);

await new Promise(r => setTimeout(r, 3000));

// Step 3: Human gives task to Manager
console.log('\n3. Human → Manager: "Tell Coder to write a Python hello world function"');
try {
  const resp = await hub.agentManager.chatWithAgent(
    manager.id,
    'Tell Coder to write a Python hello world function. Use tell() to send the task.'
  );
  console.log(`   Manager responds: ${resp.response?.slice(0, 200)}`);
} catch (err) {
  console.log(`   Error: ${err.message}`);
}

// Wait for agent communication
await new Promise(r => setTimeout(r, 5000));

// Step 4: Check what happened
console.log('\n4. Checking agent memories...');
const memories = hub.store.getAllMemories(20);
for (const m of memories) {
  const agent = hub.store.getAgent(m.agent_id);
  console.log(`   💾 ${agent?.name || '?'} [${m.category}]: ${m.content.slice(0, 80)}`);
}

console.log('\n5. Checking messages...');
const msgs = hub.store.getMessages('general', 10);
for (const m of msgs) {
  console.log(`   💬 [${m.from_agent}→${m.to_agent || 'all'}]: ${m.content.slice(0, 80)}`);
}

console.log('\n6. Stats:');
const stats = hub.store.getStats();
console.log(`   Agents: ${stats.agents} (${stats.activeAgents} active)`);
console.log(`   Memories: ${stats.memories}`);
console.log(`   Messages: ${stats.messages}`);

console.log('\n===== DONE =====\n');

await hub.stop();
process.exit(0);
