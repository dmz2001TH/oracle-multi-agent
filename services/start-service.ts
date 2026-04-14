/**
 * Start Agent Service
 * From MAW Guide - Auto-register every 10s
 */

import { AgentService } from './agent-service';

async function main() {
  const service = new AgentService(4000);
  await service.start();
  console.log('[StartService] AgentService started on port 4000');
}

main().catch(console.error);
