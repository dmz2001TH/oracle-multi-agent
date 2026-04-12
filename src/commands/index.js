/**
 * Oracle Commands Registry
 * Inspired by maw-js 49-command CLI system
 * Each command is a module with: name, description, handler, aliases
 */

const commands = new Map();

export function registerCommand(cmd) {
  commands.set(cmd.name, cmd);
  if (cmd.aliases) {
    for (const alias of cmd.aliases) {
      commands.set(alias, cmd);
    }
  }
}

export function getCommand(name) {
  return commands.get(name);
}

export function listCommands() {
  const seen = new Set();
  const result = [];
  for (const [, cmd] of commands) {
    if (!seen.has(cmd.name)) {
      seen.add(cmd.name);
      result.push({ name: cmd.name, description: cmd.description, category: cmd.category || 'general' });
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

// === Command Definitions ===

// -- Status & Health --
registerCommand({
  name: 'status',
  description: 'Hub health + stats',
  category: 'status',
  aliases: ['st'],
  handler: async (api, args) => {
    const [health, stats] = await Promise.all([api('/api/health'), api('/api/stats')]);
    console.log(`\n🧠 ARRA Office — Oracle Hub`);
    console.log(`   Status: ${health.status} | Version: ${health.version} | Provider: ${health.provider}`);
    console.log(`   Uptime: ${Math.floor(health.uptime / 60)}m | Port: ${health.port}`);
    console.log(`\n   🤖 Agents: ${stats.agents} (${stats.activeAgents} active)`);
    console.log(`   💾 Memories: ${stats.memories} | 💬 Messages: ${stats.messages}`);
    console.log(`   📋 Tasks: ${stats.pendingTasks} pending, ${stats.completedTasks} done`);
    console.log(`   📥 Inbox: ${stats.inbox} open | ✍️ Writing: ${stats.writing} docs`);
    console.log(`   🔬 Lab: ${stats.lab} running`);
    console.log(`   📡 Feed: ${stats.feedEvents} events | 🌐 Peers: ${stats.peers || 0}\n`);
  }
});

registerCommand({
  name: 'health',
  description: 'Agent health check',
  category: 'status',
  handler: async (api, args) => {
    const agent = args[0];
    if (agent) {
      const data = await api(`/api/agents/${agent}/health`);
      console.log(`\n🤖 ${agent}: ${data.status} (last active: ${Math.floor(data.idle / 1000)}s ago)`);
    } else {
      const data = await api('/api/agents');
      console.log('\n🤖 Agent Health:');
      for (const a of data.agents) {
        const idle = Math.floor((Date.now() - a.lastActive) / 1000);
        console.log(`   ${a.status === 'active' ? '🟢' : a.status === 'working' ? '🟡' : '⚪'} ${a.name} (${a.role}) — ${a.status}, idle ${idle}s`);
      }
    }
  }
});

// -- Memory & Learning --
registerCommand({
  name: 'recap',
  description: 'Session recap — what happened',
  category: 'memory',
  handler: async (api) => {
    const data = await api('/api/slash', 'POST', { command: '/recap' });
    console.log(data.response);
  }
});

registerCommand({
  name: 'rrr',
  description: 'Retrospective — learnings',
  category: 'memory',
  handler: async (api) => {
    const data = await api('/api/slash', 'POST', { command: '/rrr' });
    console.log(data.response);
  }
});

registerCommand({
  name: 'standup',
  description: 'Daily standup',
  category: 'memory',
  handler: async (api) => {
    const data = await api('/api/slash', 'POST', { command: '/standup' });
    console.log(data.response);
  }
});

registerCommand({
  name: 'fyi',
  description: 'Remember something',
  category: 'memory',
  usage: 'fyi <information>',
  handler: async (api, args) => {
    const info = args.join(' ');
    if (!info) { console.log('❌ Usage: oracle fyi <information>'); return; }
    const data = await api('/api/slash', 'POST', { command: `/fyi ${info}` });
    console.log(data.response);
  }
});

registerCommand({
  name: 'trace',
  description: 'Search everything',
  category: 'memory',
  usage: 'trace <query>',
  handler: async (api, args) => {
    const query = args.join(' ');
    if (!query) { console.log('❌ Usage: oracle trace <query>'); return; }
    const data = await api(`/api/memory/search?q=${encodeURIComponent(query)}`);
    if (data.results?.length) {
      console.log(`\n🔍 Found ${data.results.length} results:\n`);
      data.results.forEach((r, i) => {
        console.log(`${i + 1}. [${r.type}] ${r.preview}`);
      });
    } else {
      console.log('🔍 No results found.');
    }
  }
});

registerCommand({
  name: 'learn',
  description: 'Explore knowledge on a topic',
  category: 'memory',
  usage: 'learn <topic>',
  handler: async (api, args) => {
    const topic = args.join(' ');
    if (!topic) { console.log('❌ Usage: oracle learn <topic>'); return; }
    const data = await api('/api/slash', 'POST', { command: `/learn ${topic}` });
    console.log(data.response);
  }
});

registerCommand({
  name: 'memories',
  description: 'List/search memories',
  category: 'memory',
  aliases: ['mem'],
  handler: async (api, args) => {
    const query = args.join(' ');
    const url = query ? `/api/memory/search?q=${encodeURIComponent(query)}` : '/api/memory/all';
    const data = await api(url);
    const items = data.results || data.memories || [];
    if (items.length) {
      console.log(`\n🧠 ${items.length} memories:\n`);
      items.slice(0, 20).forEach((m, i) => {
        console.log(`${i + 1}. ${m.preview || m.content?.slice(0, 80)}`);
      });
    } else {
      console.log('🧠 No memories found.');
    }
  }
});

// -- Team & Agents --
registerCommand({
  name: 'agents',
  description: 'List all agents',
  category: 'agents',
  aliases: ['who-are-you'],
  handler: async (api) => {
    const data = await api('/api/agents');
    console.log('\n🤖 Agents:');
    for (const a of data.agents) {
      console.log(`   ${a.icon || '🤖'} ${a.name} — ${a.role} (${a.status})`);
    }
  }
});

registerCommand({
  name: 'chat',
  description: 'Chat with an agent',
  category: 'agents',
  usage: 'chat <agent> <message>',
  handler: async (api, args) => {
    if (args.length < 2) { console.log('❌ Usage: oracle chat <agent> <message>'); return; }
    const [agent, ...rest] = args;
    const message = rest.join(' ');
    const data = await api(`/api/agents/${agent}/chat`, 'POST', { message });
    console.log(`\n💬 ${agent}: ${data.response}`);
  }
});

registerCommand({
  name: 'team',
  description: 'Team operations: spawn, status, task',
  category: 'agents',
  usage: 'team <spawn|status|task> [args]',
  handler: async (api, args) => {
    const [subcmd, ...rest] = args;
    switch (subcmd) {
      case 'spawn': {
        const template = rest[0] || 'default';
        const data = await api('/api/team/spawn', 'POST', { template });
        console.log(`\n👥 Team spawned: ${data.team?.name} (${data.team?.members?.length} members)`);
        break;
      }
      case 'status': {
        const data = await api('/api/team/status');
        console.log('\n👥 Team Status:', JSON.stringify(data, null, 2));
        break;
      }
      case 'task': {
        const task = rest.join(' ');
        if (!task) { console.log('❌ Usage: oracle team task <description>'); return; }
        const data = await api('/api/team/task', 'POST', { task });
        console.log(`📋 Task broadcast: ${task}`);
        break;
      }
      default:
        console.log('❌ Sub-commands: spawn, status, task');
    }
  }
});

registerCommand({
  name: 'broadcast',
  description: 'Broadcast message to all agents',
  category: 'agents',
  usage: 'broadcast <message>',
  handler: async (api, args) => {
    const msg = args.join(' ');
    if (!msg) { console.log('❌ Usage: oracle broadcast <message>'); return; }
    const data = await api('/api/broadcast', 'POST', { message: msg });
    console.log(`📢 Broadcast sent to ${data.recipients} agents`);
  }
});

// -- Tasks --
registerCommand({
  name: 'tasks',
  description: 'List all tasks',
  category: 'tasks',
  handler: async (api) => {
    const data = await api('/api/tasks');
    console.log('\n📋 Tasks:');
    for (const t of data.tasks || []) {
      const icon = t.status === 'done' ? '✅' : t.status === 'active' ? '🔄' : '⏳';
      console.log(`   ${icon} ${t.description} [${t.status}]`);
    }
  }
});

registerCommand({
  name: 'task',
  description: 'Create a new task',
  category: 'tasks',
  usage: 'task <description>',
  handler: async (api, args) => {
    const desc = args.join(' ');
    if (!desc) { console.log('❌ Usage: oracle task <description>'); return; }
    const data = await api('/api/tasks', 'POST', { description: desc });
    console.log(`📋 Task created: ${desc}`);
  }
});

// -- Feed --
registerCommand({
  name: 'feed',
  description: 'Recent activity feed',
  category: 'status',
  handler: async (api, args) => {
    const limit = parseInt(args[0]) || 20;
    const data = await api(`/api/feed?limit=${limit}`);
    console.log(`\n📡 Recent Activity (${data.events?.length || 0} events):\n`);
    for (const e of data.events || []) {
      const time = new Date(e.timestamp).toLocaleTimeString();
      console.log(`   [${time}] ${e.type}: ${e.agent || e.teamId || ''}`);
    }
  }
});

// -- Inbox --
registerCommand({
  name: 'inbox',
  description: 'View/add inbox items',
  category: 'workflow',
  handler: async (api, args) => {
    if (args.length) {
      const item = args.join(' ');
      const data = await api('/api/inbox', 'POST', { content: item });
      console.log(`📥 Added to inbox: ${item}`);
    } else {
      const data = await api('/api/inbox');
      console.log('\n📥 Inbox:');
      for (const item of data.items || []) {
        console.log(`   ${item.status === 'open' ? '📬' : '📭'} ${item.content}`);
      }
    }
  }
});

// -- Session Handoffs --
registerCommand({
  name: 'handoff',
  description: 'Create session handoff',
  category: 'workflow',
  aliases: ['forward'],
  handler: async (api) => {
    const data = await api('/api/handoff', 'POST', {});
    console.log(`🔀 Handoff created: ${data.handoff?.id}`);
  }
});

registerCommand({
  name: 'feel',
  description: 'Log energy/mood level',
  category: 'workflow',
  usage: 'feel <mood>',
  handler: async (api, args) => {
    const mood = args[0] || 'neutral';
    const data = await api('/api/slash', 'POST', { command: `/feel ${mood}` });
    console.log(`🎭 Mood logged: ${mood}`);
  }
});

// -- Vault --
registerCommand({
  name: 'vault',
  description: 'Vault operations: status, list',
  category: 'vault',
  handler: async (api, args) => {
    const [subcmd] = args;
    if (subcmd === 'status' || !subcmd) {
      const data = await api('/api/vault/status');
      console.log('\n🔐 Vault Status:');
      for (const [section, count] of Object.entries(data)) {
        if (section !== 'initialized' && section !== 'path' && section !== 'total') {
          console.log(`   ${section}: ${count} items`);
        }
      }
      console.log(`   Total: ${data.total} items`);
    }
  }
});

// -- Fleet --
registerCommand({
  name: 'fleet',
  description: 'Fleet management: ls, health, doctor',
  category: 'federation',
  usage: 'fleet <ls|health|doctor>',
  handler: async (api, args) => {
    const [subcmd] = args;
    switch (subcmd) {
      case 'ls':
      case undefined: {
        const data = await api('/api/fleet');
        console.log('\n🌐 Fleet:');
        for (const node of data.nodes || []) {
          console.log(`   ${node.status === 'online' ? '🟢' : '🔴'} ${node.name} — ${node.url} (${node.latency}ms)`);
        }
        break;
      }
      case 'health': {
        const data = await api('/api/fleet/health', 'POST');
        console.log('\n🌐 Fleet Health:');
        for (const r of data.results || []) {
          console.log(`   ${r.ok ? '🟢' : '🔴'} ${name}: ${r.ok ? `${r.latency}ms` : r.error}`);
        }
        break;
      }
      case 'doctor': {
        console.log('🩺 Running fleet diagnostics...');
        const data = await api('/api/fleet/doctor');
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      default:
        console.log('❌ Sub-commands: ls, health, doctor');
    }
  }
});

registerCommand({
  name: 'ping',
  description: 'Ping federation peers',
  category: 'federation',
  handler: async (api) => {
    const data = await api('/api/fleet/ping', 'POST');
    console.log('\n🏓 Ping Results:');
    for (const r of data.results || []) {
      console.log(`   ${r.ok ? '🟢' : '🔴'} ${r.name}: ${r.ok ? `${r.latency}ms` : r.error}`);
    }
  }
});

// -- Costs --
registerCommand({
  name: 'costs',
  description: 'API usage costs',
  category: 'status',
  handler: async (api) => {
    const data = await api('/api/costs');
    console.log('\n💰 API Costs:');
    console.log(JSON.stringify(data, null, 2));
  }
});

// -- Overview --
registerCommand({
  name: 'overview',
  description: 'System overview',
  category: 'status',
  aliases: ['ov'],
  handler: async (api) => {
    const [health, stats, agents, vault] = await Promise.all([
      api('/api/health'),
      api('/api/stats'),
      api('/api/agents'),
      api('/api/vault/status')
    ]);
    console.log(`\n🧠 ARRA Office — Oracle Multi-Agent System`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`Status: ${health.status} | Version: ${health.version}`);
    console.log(`Uptime: ${Math.floor(health.uptime / 60)}m | Provider: ${health.provider}`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`Agents: ${stats.agents} (${stats.activeAgents} active)`);
    console.log(`Memories: ${stats.memories} | Messages: ${stats.messages}`);
    console.log(`Tasks: ${stats.pendingTasks}/${stats.pendingTasks + stats.completedTasks}`);
    console.log(`Vault: ${vault.total || 0} items across ${Object.keys(vault).length - 3} sections`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`Feed: ${stats.feedEvents} events | Peers: ${stats.peers || 0}`);
    console.log(`${'═'.repeat(50)}\n`);
  }
});

export { commands };
