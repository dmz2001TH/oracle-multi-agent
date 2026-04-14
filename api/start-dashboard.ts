/**
 * Start Dashboard Server
 * From Soul-Brews WebSocket Dashboard + MAW Guide
 */

import { DashboardServer } from './server';

async function main() {
  const server = new DashboardServer(3460);
  await server.start();
  console.log('[StartDashboard] Dashboard server started on port 3460');
}

main().catch(console.error);
