#!/usr/bin/env node

/**
 * Oracle CLI — command-line interface for Oracle Multi-Agent System
 * 
 * Usage: oracle <command> [options]
 * 
 * Commands:
 *   status           Show hub health + stats
 *   recap            Last session summary + recent memories
 *   fyi <query>      Search memories (FTS5)
 *   rrr [limit]      Read Recent Recap (messages)
 *   standup          Daily standup summary
 *   chat <agent>     Chat with an agent via CLI
 *   team             Manage team (spawn/status/task/chat/templates)
 *   handoff          Create session handoff
 *   forward          Show next session summary preview
 *   health [agent]   Agent health check
 */

const HUB_URL = process.env.ORACLE_HUB_URL || 'http://localhost:3456';
const API = `${HUB_URL}/api`;

// ─── Helpers ────────────────────────────────────────────────────────

async function api(method, path, body = null) {
  const url = `${API}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

function pad(str, len) {
  return String(str).padEnd(len);
}

function truncate(str, max = 60) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function timeAgo(dateStr) {
  if (!dateStr) return '?';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function header(title) {
  const line = '═'.repeat(50);
  console.log(`\n╔${line}╗`);
  console.log(`║ ${pad(title, 48)}║`);
  console.log(`╚${line}╝`);
}

// ─── Commands ───────────────────────────────────────────────────────

async function cmdStatus() {
  header('Oracle Status');
  try {
    const [health, stats] = await Promise.all([
      api('GET', '/health'),
      api('GET', '/stats'),
    ]);

    const ok = health.status === 'ok';
    console.log(`  Hub:          ${ok ? '✅ Online' : '❌ Down'}`);
    console.log(`  Version:      ${health.version || 'unknown'}`);
    console.log(`  Uptime:       ${health.uptime ? Math.floor(health.uptime / 60) + ' min' : '?'}`);
    console.log(`  Provider:     ${health.provider || '?'}`);
    console.log(`  Memory (RSS): ${Math.round((health.memory?.rss || 0) / 1024 / 1024)} MB`);
    console.log();
    console.log(`  🤖 Agents:     ${stats.agents || 0} (active: ${stats.activeAgents || 0})`);
    console.log(`  🧠 Memories:   ${stats.memories || 0} (superseded: ${stats.superseded || 0})`);
    console.log(`  💬 Messages:   ${stats.messages || 0}`);
    console.log(`  📋 Tasks:      ${stats.pendingTasks || 0} pending / ${stats.completedTasks || 0} done`);
    console.log(`  🧵 Threads:    ${stats.threads || 0}`);
    console.log(`  🔍 Traces:     ${stats.traces || 0}`);
  } catch (err) {
    console.error(`  ❌ Cannot reach hub: ${err.message}`);
    console.error(`  → Is the server running? (cd oracle-multi-agent && npm start)`);
    process.exit(1);
  }
}

async function cmdRecap() {
  header('Session Recap');
  try {
    const [handoffs, recent, agents] = await Promise.all([
      api('GET', '/memory/search?q=handoff&limit=5'),
      api('GET', '/memory/all?limit=10'),
      api('GET', '/agents'),
    ]);

    // Active agents
    if (agents.length > 0) {
      console.log('  🤖 Active Agents:');
      for (const a of agents) {
        const ago = timeAgo(a.last_active);
        console.log(`     • ${a.name} (${a.role}) — ${a.status} [${ago}]`);
      }
      console.log();
    }

    // Recent memories
    if (recent.length > 0) {
      console.log('  📝 Recent Memories:');
      for (const m of recent.slice(0, 8)) {
        const ago = timeAgo(m.created_at);
        console.log(`     [${ago}] ${pad(m.category || 'general', 10)} ${truncate(m.content, 55)}`);
      }
      console.log();
    }

    // Handoffs
    if (handoffs.length > 0) {
      console.log('  🔀 Recent Handoffs:');
      for (const h of handoffs) {
        console.log(`     • ${truncate(h.content, 70)} (${timeAgo(h.created_at)})`);
      }
    }

    if (agents.length === 0 && recent.length === 0) {
      console.log('  No activity yet. Start the hub and spawn some agents!');
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

async function cmdFyi(query) {
  if (!query) {
    console.error('Usage: oracle fyi <search-query>');
    process.exit(1);
  }

  header(`FYI: "${query}"`);
  try {
    const results = await api('GET', `/memory/search?q=${encodeURIComponent(query)}`);

    if (results.length === 0) {
      console.log('  No memories found.');
      return;
    }

    console.log(`  Found ${results.length} result(s):\n`);
    for (const r of results) {
      const stars = '⭐'.repeat(Math.min(r.importance || 1, 5));
      console.log(`  📌 [${r.category || 'general'}] ${r.content}`);
      console.log(`     agent: ${r.agent_id?.slice(0, 8) || '—'} | ${stars} | ${timeAgo(r.created_at)}`);
      console.log();
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

async function cmdRrr(limit = 20) {
  header('Read Recent Recap');
  try {
    const msgs = await api('GET', `/messages?limit=${limit}`);

    if (msgs.length === 0) {
      console.log('  No messages yet.');
      return;
    }

    console.log(`  📨 Last ${msgs.length} messages:\n`);
    for (const m of msgs) {
      const who = m.from_agent || m.role || 'system';
      const to = m.to_agent ? ` → ${m.to_agent}` : '';
      const ago = timeAgo(m.created_at);
      const thread = m.thread_id ? ` [T#${m.thread_id}]` : '';
      console.log(`  [${ago}] ${who}${to}${thread}: ${truncate(m.content, 55)}`);
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

async function cmdStandup() {
  header('Daily Standup');
  try {
    const [agents, tasks, messages, analytics] = await Promise.all([
      api('GET', '/agents'),
      api('GET', '/tasks'),
      api('GET', '/messages?limit=50'),
      api('GET', '/analytics/search'),
    ]);

    // Team
    console.log('  🤖 Team:');
    if (agents.length === 0) {
      console.log('     No agents running.');
    } else {
      for (const a of agents) {
        console.log(`     • ${a.name} (${a.role}) — ${a.status} [${timeAgo(a.last_active)}]`);
      }
    }
    console.log();

    // Tasks
    const pending = tasks.filter(t => t.status === 'pending');
    const active = tasks.filter(t => t.status === 'active');
    const done = tasks.filter(t => t.status === 'completed' || t.status === 'done');

    console.log('  📋 Tasks:');
    console.log(`     Pending: ${pending.length} | Active: ${active.length} | Done: ${done.length}`);

    if (active.length > 0) {
      console.log('     In Progress:');
      for (const t of active.slice(0, 5)) {
        console.log(`       ▸ ${truncate(t.title, 50)} [${t.assigned_to || 'unassigned'}]`);
      }
    }
    if (done.length > 0) {
      console.log('     Recently Completed:');
      for (const t of done.slice(0, 5)) {
        console.log(`       ✓ ${truncate(t.title, 50)} (${timeAgo(t.completed_at)})`);
      }
    }
    console.log();

    // Activity
    console.log(`  💬 Recent Activity: ${messages.length} messages in last batch`);
    if (analytics?.total_searches) {
      console.log(`  🔍 Searches: ${analytics.total_searches} total, avg ${(analytics.avg_time_ms || 0).toFixed(1)}ms`);
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

async function cmdChat(agentName, message) {
  if (!agentName || !message) {
    console.error('Usage: oracle chat <agent-name> <message>');
    process.exit(1);
  }

  try {
    const agents = await api('GET', '/agents');
    const agent = agents.find(a => a.name.toLowerCase() === agentName.toLowerCase());

    if (!agent) {
      console.error(`  ❌ Agent "${agentName}" not found.`);
      console.log('  Available agents:', agents.map(a => a.name).join(', ') || 'none');
      process.exit(1);
    }

    console.log(`  💬 You → ${agent.name}: ${message}\n`);

    const result = await api('POST', `/agents/${agent.id}/chat`, { message });

    if (result.response) {
      console.log(`  🤖 ${agent.name}: ${result.response}`);
    } else if (result.message) {
      console.log(`  🤖 ${agent.name}: ${result.message}`);
    } else {
      console.log(`  🤖 ${agent.name}:`, JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

async function cmdTeam(action, ...args) {
  header('Team Manager');
  try {
    switch (action) {
      case 'spawn': {
        const template = args[0] || 'default';
        console.log(`  🚀 Spawning team: ${template}...`);
        const result = await api('POST', '/team/spawn', { template });
        console.log(`  ✅ Team created! Members:`);
        if (result.members) {
          for (const m of result.members) {
            console.log(`     • ${m.name} (${m.role})`);
          }
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }

      case 'status': {
        const status = await api('GET', '/team/status');
        console.log(`  Template: ${status.template || '—'}`);
        console.log(`  Members:  ${status.members?.length || 0}`);
        if (status.members) {
          for (const m of status.members) {
            console.log(`     • ${m.name} (${m.role}) — ${m.status}`);
          }
        }
        break;
      }

      case 'task': {
        const taskMsg = args.join(' ');
        if (!taskMsg) {
          console.error('  Usage: oracle team task <description>');
          process.exit(1);
        }
        console.log(`  📋 Broadcasting task: ${taskMsg}`);
        const result = await api('POST', '/team/task', { task: taskMsg });
        console.log(`  ✅ Task broadcast:`, result.message || 'sent');
        break;
      }

      case 'chat': {
        const chatMsg = args.join(' ');
        if (!chatMsg) {
          console.error('  Usage: oracle team chat <message>');
          process.exit(1);
        }
        console.log(`  💬 Team chat: ${chatMsg}`);
        const result = await api('POST', '/team/chat', { message: chatMsg });
        console.log(`  ✅`, result.message || 'sent');
        break;
      }

      case 'templates': {
        const templates = await api('GET', '/team/templates');
        console.log('  Available team templates:');
        if (templates.templates) {
          for (const [name, desc] of Object.entries(templates.templates)) {
            console.log(`     • ${name}: ${desc}`);
          }
        } else if (Array.isArray(templates)) {
          for (const t of templates) {
            console.log(`     • ${t.name}: ${t.members?.join(', ')}`);
          }
        }
        break;
      }

      default:
        console.log('  Team commands:');
        console.log('    oracle team spawn [template]  — Spawn a team');
        console.log('    oracle team status             — Show team status');
        console.log('    oracle team task <description> — Broadcast task');
        console.log('    oracle team chat <message>     — Team chat');
        console.log('    oracle team templates          — List templates');
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

// Phase 2: Handoff
async function cmdHandoff() {
  header('Session Handoff');
  try {
    console.log('  📄 Creating session handoff...');
    const handoff = await api('POST', '/handoff/create', {});
    console.log(`  ✅ Handoff created!`);
    console.log(`     Title:   ${handoff.title}`);
    console.log(`     Summary: ${truncate(handoff.summary, 80)}`);
    console.log();
    console.log('  💡 Next session: run "oracle recap" to see this handoff');
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

// Phase 2: Forward — preview next session summary
async function cmdForward() {
  header('Forward — Next Session Preview');
  try {
    const summary = await api('GET', '/handoff/summary');
    console.log(`  📋 Title: ${summary.title}`);
    console.log();
    console.log('  Context:');
    if (summary.context?.agents) {
      console.log('    Agents:', summary.context.agents.map(a => `${a.name}(${a.role})`).join(', '));
    }
    if (summary.context?.stats) {
      const s = summary.context.stats;
      console.log(`    Stats: ${s.memories} memories, ${s.messages} messages, ${s.pendingTasks} pending tasks`);
    }
    console.log();
    if (summary.context?.recentMessages?.length > 0) {
      console.log('  Recent Messages:');
      for (const m of summary.context.recentMessages.slice(0, 5)) {
        console.log(`    [${m.from}]: ${truncate(m.content, 60)}`);
      }
    }
    console.log();
    if (summary.context?.recentMemories?.length > 0) {
      console.log('  Key Memories:');
      for (const m of summary.context.recentMemories.slice(0, 5)) {
        console.log(`    [${m.category}]: ${truncate(m.content, 60)}`);
      }
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

// Phase 5: Health check
async function cmdHealth(agentName) {
  header('Agent Health Check');
  try {
    const agents = await api('GET', '/agents');

    if (agentName) {
      const agent = agents.find(a => a.name.toLowerCase() === agentName.toLowerCase());
      if (!agent) {
        console.error(`  ❌ Agent "${agentName}" not found`);
        return;
      }
      const health = await api('GET', `/agents/${agent.id}/health`);
      console.log(`  ${health.name} (${health.role})`);
      console.log(`    Running:    ${health.running ? '✅' : '❌'}`);
      console.log(`    DB Status:  ${health.dbStatus}`);
      console.log(`    PID:        ${health.pid || 'N/A'}`);
      console.log(`    Last Active: ${timeAgo(health.lastActive)}`);
    } else {
      // Show all
      for (const a of agents) {
        try {
          const h = await api('GET', `/agents/${a.id}/health`);
          const icon = h.running ? '✅' : '❌';
          console.log(`  ${icon} ${h.name} (${h.role}) — ${h.dbStatus} [${timeAgo(h.lastActive)}]`);
        } catch {
          console.log(`  ❓ ${a.name} (${a.role}) — health check failed`);
        }
      }
      if (agents.length === 0) {
        console.log('  No agents registered.');
      }
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────

function usage() {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║         Oracle Multi-Agent CLI  v2.0            ║
  ╚══════════════════════════════════════════════════╝

  Usage: oracle <command> [options]

  Commands:
    status              Hub health + stats
    recap               Last session summary + recent memories
    fyi <query>         Search memories (FTS5)
    rrr [limit]         Read Recent Recap (default: 20)
    standup             Daily standup summary
    chat <agent> <msg>  Chat with an agent
    team <action>       Manage team (spawn|status|task|chat|templates)
    handoff             Create session handoff (Phase 2)
    forward             Preview next session summary (Phase 2)
    health [agent]      Agent health check (Phase 5)

  Environment:
    ORACLE_HUB_URL      Hub URL (default: http://localhost:3456)
`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h') {
    usage();
    return;
  }

  switch (cmd) {
    case 'status': await cmdStatus(); break;
    case 'recap': await cmdRecap(); break;
    case 'fyi': await cmdFyi(args.slice(1).join(' ')); break;
    case 'rrr': await cmdRrr(parseInt(args[1]) || 20); break;
    case 'standup': await cmdStandup(); break;
    case 'chat': await cmdChat(args[1], args.slice(2).join(' ')); break;
    case 'team': await cmdTeam(args[1], ...args.slice(2)); break;
    case 'handoff': await cmdHandoff(); break;
    case 'forward': await cmdForward(); break;
    case 'health': await cmdHealth(args[1]); break;
    default:
      console.error(`  Unknown command: ${cmd}`);
      usage();
      process.exit(1);
  }
}

main().catch(err => {
  console.error(`\n  ❌ Fatal: ${err.message}`);
  process.exit(1);
});
