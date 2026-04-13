/**
 * Oracle Multi-Agent v5.0 — Entry point
 *
 * Starts the Hono HTTP server, initializes the engine,
 * loads plugins, and sets up process management.
 */

import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig } from './config.js';
import { createProcessManager } from './process/auto-detect.js';
import { hasTmux } from './process/auto-detect.js';
import { api } from './api/index.js';
import { mountViews } from './views/index.js';
import { agentBridgeApi } from './api/agent-bridge.js';
import { memoryBridgeApi } from './api/memory-bridge.js';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const config = loadConfig();
const processManager = createProcessManager();
const processType = hasTmux() ? 'tmux' : 'node-pty';

const app = new Hono();
app.use('*', cors());

// API routes — sub-routers already include /api/ prefix
app.route('/', api);

// Agent + Memory bridge (v2 API — the working agent system)
app.route('/', agentBridgeApi);
app.route('/', memoryBridgeApi);

// Views (demo, federation, timemachine)
mountViews(app);

// Dashboard — serve built React app from /dashboard/dist
const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIST = join(__dirname, 'dashboard', 'dist');
const hasDist = existsSync(DASHBOARD_DIST);

if (hasDist) {
  // Serve static assets
  app.get('/assets/*', serveStatic({ root: DASHBOARD_DIST }));
  // Serve HTML pages
  app.get('/', serveStatic({ path: 'index.html', root: DASHBOARD_DIST }));
  app.get('/*.html', serveStatic({ root: DASHBOARD_DIST }));
}

// Health endpoint
app.get('/health', (c) => c.json({
  ok: true,
  version: '5.0.0',
  host: config.host,
  port: config.port,
  process: processType,
  agents: {
    provider: process.env.LLM_PROVIDER || 'gemini',
    model: process.env.AGENT_MODEL || 'gemini-2.0-flash',
    maxConcurrent: Number(process.env.MAX_CONCURRENT_AGENTS || 5),
  },
  v2Api: {
    agents: '/api/v2/agents',
    memory: '/api/v2/memory/search',
    messages: '/api/v2/messages',
  },
}));

const port = Number(process.env.HUB_PORT || config.port || 3456);

console.log(`🧠 Oracle Multi-Agent v5.0`);
console.log(`   host: ${config.host} | port: ${port}`);
console.log(`   process: ${processType}`);
console.log(`   provider: ${process.env.LLM_PROVIDER || 'gemini'}`);
console.log(`   model: ${process.env.AGENT_MODEL || 'gemini-2.0-flash'}`);
console.log(`   pid: ${process.pid}`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`   listening on http://0.0.0.0:${info.port}`);
  if (hasDist) {
    console.log(`   dashboard: http://0.0.0.0:${info.port}`);
  } else {
    console.log(`   dashboard: cd src/dashboard && npx vite (port 5173)`);
  }
  console.log(`\n   📡 v2 API ready:`);
  console.log(`      POST /api/v2/agents/spawn   — spawn agent`);
  console.log(`      GET  /api/v2/agents          — list agents`);
  console.log(`      POST /api/v2/agents/:id/chat — chat`);
  console.log(`      GET  /api/v2/memory/search?q — search memory`);
  console.log(`      GET  /api/v2/memory/stats    — KB stats`);
  console.log(`      POST /api/v2/agents/broadcast — broadcast`);
});
