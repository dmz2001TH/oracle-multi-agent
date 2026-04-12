#!/usr/bin/env node
import 'dotenv/config';
import { listCommands, getCommand } from '../commands/index.js';

const HUB = process.env.HUB_URL || `http://localhost:${process.env.HUB_PORT || 3456}`;

async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${HUB}${path}`, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return await res.json();
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
      console.error(`❌ Cannot reach hub at ${HUB}. Is it running?`);
      console.error(`   Start with: npm start  (or: node src/hub/index.js)`);
    } else {
      console.error(`❌ ${err.message}`);
    }
    process.exit(1);
  }
}

const [,, command, ...args] = process.argv;

function help() {
  const cmds = listCommands();
  const categories = {};
  for (const cmd of cmds) {
    if (!categories[cmd.category]) categories[cmd.category] = [];
    categories[cmd.category].push(cmd);
  }

  console.log(`\n🧠 ARRA Office — Oracle Multi-Agent CLI v4.0\n`);
  console.log(`Usage: oracle <command> [args]\n`);

  for (const [cat, cmds] of Object.entries(categories)) {
    console.log(`  ${cat.toUpperCase()}`);
    for (const cmd of cmds) {
      const line = `    ${cmd.name.padEnd(12)} ${cmd.description}`;
      console.log(line);
    }
    console.log('');
  }

  console.log(`  OTHER`);
  console.log(`    ${'help'.padEnd(12)} Show this help`);
  console.log(`    ${'commands'.padEnd(12)} List all commands (JSON)`);
  console.log('');
}

async function main() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    help();
    return;
  }

  if (command === 'commands') {
    const cmds = listCommands();
    console.log(JSON.stringify(cmds, null, 2));
    return;
  }

  // Check command registry first
  const cmd = getCommand(command);
  if (cmd) {
    await cmd.handler(api, args);
    return;
  }

  // Fallback: try as API endpoint
  console.error(`❌ Unknown command: ${command}`);
  console.error(`   Run 'oracle help' for available commands.`);
  process.exit(1);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
