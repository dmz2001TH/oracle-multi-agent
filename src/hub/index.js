#!/usr/bin/env node
import 'dotenv/config';
import { HubServer } from './server.js';
import { TeamOrchestrator } from './team.js';

const hub = new HubServer();

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Oracle Hub...');
  await hub.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await hub.stop();
  process.exit(0);
});

hub.start().catch((err) => {
  console.error('❌ Failed to start Hub:', err);
  process.exit(1);
});
