#!/usr/bin/env node
import 'dotenv/config';

const HUB = process.env.HUB_URL || `http://localhost:${process.env.HUB_PORT || 3456}`;

async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${HUB}${path}`, opts);
    return await res.json();
  } catch (err) {
    console.error(`❌ Cannot reach hub at ${HUB}. Is it running?`);
    process.exit(1);
  }
}

const [,, command, ...args] = process.argv;

function help() {
  console.log(`
🧠 Oracle CLI — ARRA Office v3.0

Commands:
  status                  Hub health + stats
  recap                   Session recap (what happened)
  rrr                     Retrospective (learnings)
  standup                 Daily standup
  fyi <info>              Remember something
  trace <query>           Search everything
  learn <topic>           Explore knowledge
  feel <mood>             Log energy level
  forward                 Create session handoff
  who-are-you             List all agents
  inbox [item]            View/add to inbox
  chat <agent> <msg>      Chat with an agent
  team spawn [template]   Spawn a team (default/full/dev/minimal)
  team status             Team status
  team task <task>        Broadcast task to team
  health [agent]          Agent health check
  fleet                   List fleet configs
  handoff                 Create handoff
  memories [query]        List/search memories
  tasks                   List tasks
  agents                  List agents
  `);
}

async function main() {
  switch (command) {
    case 'status': {
      const [health, stats] = await Promise.all([api('/api/health'), api('/api/stats')]);
      console.log(`\n🧠 ARRA Office — Oracle Hub`);
      console.log(`   Status: ${health.status}`);
      console.log(`   Version: ${health.version}`);
      console.log(`   Provider: ${health.provider}`);
      console.log(`   Uptime: ${Math.floor(health.uptime / 60)}m`);
      console.log(`\n   Agents: ${stats.agents} (${stats.activeAgents} active)`);
      console.log(`   Memories: ${stats.memories}`);
      console.log(`   Messages: ${stats.messages}`);
      console.log(`   Tasks: ${stats.pendingTasks} pending, ${stats.completedTasks} done`);
      console.log(`   Inbox: ${stats.inbox} open`);
      console.log(`   Writing: ${stats.writing} docs`);
      console.log(`   Lab: ${stats.lab} running\n`);
      break;
    }

    case 'recap': {
      const result = await api('/api/slash', 'POST', { command: '/recap' });
      console.log(result.response);
      break;
    }

    case 'rrr': {
      const result = await api('/api/slash', 'POST', { command: '/rrr' });
      console.log(result.response);
      break;
    }

    case 'standup': {
      const result = await api('/api/slash', 'POST', { command: '/standup' });
      console.log(result.response);
      break;
    }

    case 'fyi': {
      const info = args.join(' ');
      if (!info) { console.log('Usage: oracle fyi <information to remember>'); break; }
      const result = await api('/api/slash', 'POST', { command: `/fyi ${info}` });
      console.log(result.response);
      break;
    }

    case 'trace': {
      const query = args.join(' ');
      if (!query) { console.log('Usage: oracle trace <query>'); break; }
      const result = await api('/api/slash', 'POST', { command: `/trace ${query}` });
      console.log(result.response);
      break;
    }

    case 'learn': {
      const topic = args.join(' ');
      if (!topic) { console.log('Usage: oracle learn <topic>'); break; }
      const result = await api('/api/slash', 'POST', { command: `/learn ${topic}` });
      console.log(result.response);
      break;
    }

    case 'feel': {
      const mood = args.join(' ');
      if (!mood) { console.log('Usage: oracle feel <mood>'); break; }
      const result = await api('/api/slash', 'POST', { command: `/feel ${mood}` });
      console.log(result.response);
      break;
    }

    case 'forward': {
      const result = await api('/api/slash', 'POST', { command: '/forward' });
      console.log(result.response);
      break;
    }

    case 'who-are-you': {
      const result = await api('/api/slash', 'POST', { command: '/who-are-you' });
      console.log(result.response);
      break;
    }

    case 'inbox': {
      const item = args.join(' ');
      const result = await api('/api/slash', 'POST', { command: `/inbox ${item}` });
      console.log(result.response);
      break;
    }

    case 'chat': {
      const [agentName, ...msgParts] = args;
      const message = msgParts.join(' ');
      if (!agentName || !message) { console.log('Usage: oracle chat <agent> <message>'); break; }
      const agents = await api('/api/agents');
      const agent = agents.find(a => a.name.toLowerCase() === agentName.toLowerCase());
      if (!agent) {
        console.log(`Agent "${agentName}" not found. Available: ${agents.map(a => a.name).join(', ')}`);
        break;
      }
      console.log(`💬 Chatting with ${agent.name}...`);
      const result = await api(`/api/agents/${agent.id}/chat`, 'POST', { message });
      console.log(`\n${agent.name}: ${result.response}\n`);
      break;
    }

    case 'team': {
      const [sub, ...subArgs] = args;
      switch (sub) {
        case 'spawn': {
          const template = subArgs[0] || 'default';
          console.log(`🏢 Spawning team (${template})...`);
          const result = await api('/api/team/spawn', 'POST', { template });
          if (result.error) { console.error('❌', result.error); break; }
          console.log(`✅ Team ${result.teamId} spawned!`);
          for (const m of result.members) {
            console.log(`   ${m.name} (${m.role}) — ${m.status}`);
          }
          break;
        }
        case 'status': {
          const status = await api('/api/team/status');
          console.log(`\n🏢 Team Status:`);
          for (const team of status.teams) {
            console.log(`   Team ${team.id}:`);
            for (const m of team.members) {
              console.log(`     ${m.name} (${m.role}) — ${m.status}`);
            }
          }
          console.log(`\n   Pending tasks: ${status.stats.pendingTasks}`);
          console.log(`   Memories: ${status.stats.memories}\n`);
          break;
        }
        case 'task': {
          const task = subArgs.join(' ');
          if (!task) { console.log('Usage: oracle team task <task description>'); break; }
          const result = await api('/api/team/task', 'POST', { task });
          if (result.error) { console.error('❌', result.error); break; }
          console.log(`\n${result.response}\n`);
          break;
        }
        default:
          console.log('Team commands: spawn [template], status, task <desc>');
      }
      break;
    }

    case 'health': {
      const agentName = args[0];
      if (agentName) {
        const agents = await api('/api/agents');
        const agent = agents.find(a => a.name.toLowerCase() === agentName.toLowerCase());
        if (!agent) { console.log(`Agent "${agentName}" not found`); break; }
        const health = await api(`/api/agents/${agent.id}/health`);
        console.log(`\n${health.name} (${health.role})`);
        console.log(`   Running: ${health.running}`);
        console.log(`   Status: ${health.dbStatus}`);
        console.log(`   PID: ${health.pid || 'N/A'}\n`);
      } else {
        const agents = await api('/api/agents');
        for (const a of agents) {
          const h = await api(`/api/agents/${a.id}/health`);
          console.log(`${h.name} (${h.role}) — ${h.running ? '🟢 running' : '🔴 stopped'} [${h.dbStatus}]`);
        }
      }
      break;
    }

    case 'fleet': {
      const configs = await api('/api/fleet');
      if (configs.length === 0) { console.log('No fleet configs saved.'); break; }
      for (const c of configs) {
        console.log(`📋 ${c.name} (updated: ${new Date(c.updated_at * 1000).toLocaleDateString()})`);
      }
      break;
    }

    case 'handoff': {
      const result = await api('/api/slash', 'POST', { command: '/forward' });
      console.log(result.response);
      break;
    }

    case 'memories': {
      const query = args.join(' ');
      if (query) {
        const results = await api(`/api/memory/search?q=${encodeURIComponent(query)}&limit=10`);
        if (results.length === 0) { console.log('No results.'); break; }
        for (const m of results) {
          console.log(`[${m.category}] ${m.content.slice(0, 120)}`);
        }
      } else {
        const memories = await api('/api/memory/all?limit=15');
        if (memories.length === 0) { console.log('No memories yet.'); break; }
        for (const m of memories) {
          console.log(`#${m.id} [${m.category}] ${m.content.slice(0, 100)}`);
        }
      }
      break;
    }

    case 'tasks': {
      const tasks = await api('/api/tasks');
      if (tasks.length === 0) { console.log('No tasks.'); break; }
      for (const t of tasks) {
        const icon = t.status === 'completed' ? '✅' : t.status === 'active' ? '🔄' : '⬜';
        console.log(`${icon} ${t.title}${t.assigned_to ? ` → ${t.assigned_to}` : ''} [${t.status}]`);
      }
      break;
    }

    case 'agents': {
      const agents = await api('/api/agents');
      if (agents.length === 0) { console.log('No agents running.'); break; }
      for (const a of agents) {
        console.log(`${a.status === 'active' ? '🟢' : '🔴'} ${a.name} (${a.role}) — ${a.status}`);
      }
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    case undefined:
      help();
      break;

    default:
      console.log(`Unknown command: ${command}`);
      help();
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
