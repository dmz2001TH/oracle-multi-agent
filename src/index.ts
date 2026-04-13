/**
 * Oracle Multi-Agent v5.0 — Entry point
 *
 * Starts the Hono HTTP server, initializes the engine,
 * loads plugins, and sets up process management.
 */

import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig } from './config.js';
import { createProcessManager } from './process/auto-detect.js';
import { hasTmux } from './process/auto-detect.js';
import { api } from './api/index.js';
import { mountViews } from './views/index.js';

const config = loadConfig();
const processManager = createProcessManager();
const processType = hasTmux() ? 'tmux' : 'node-pty';

const app = new Hono();
app.use('*', cors());

// API routes — sub-routers already include /api/ prefix
app.route('/', api);
// Views (demo, federation, timemachine)
mountViews(app);

// Health endpoint
app.get('/health', (c) => c.json({
  ok: true,
  version: '5.0.0',
  host: config.host,
  port: config.port,
  process: processType,
}));

const port = Number(process.env.HUB_PORT || config.port || 3456);

console.log(`🧠 Oracle Multi-Agent v5.0`);
console.log(`   host: ${config.host} | port: ${port}`);
console.log(`   process: ${processType}`);
console.log(`   pid: ${process.pid}`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`   listening on http://0.0.0.0:${info.port}`);
  console.log(`   dashboard: cd src/dashboard && npx vite (port 5173)`);
});
