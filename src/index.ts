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
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';

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
  // Serve all static files from dashboard dist
  app.get('/*', (c) => {
    let reqPath = new URL(c.req.url).pathname;
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = join(DASHBOARD_DIST, reqPath);
    if (!existsSync(filePath)) return c.notFound();
    const content = readFileSync(filePath);
    const ext = reqPath.split('.').pop() || '';
    const mimeTypes: Record<string, string> = {
      'html': 'text/html', 'js': 'application/javascript', 'css': 'text/css',
      'json': 'application/json', 'svg': 'image/svg+xml', 'png': 'image/png',
      'jpg': 'image/jpeg', 'ico': 'image/x-icon', 'woff2': 'font/woff2', 'woff': 'font/woff',
    };
    return c.body(content, 200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  });
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

// ─── Dashboard state routes ──────────────────────

// In-memory UI state store
const uiStateStore: Record<string, any> = {};
const pinnedItems: { id: string; type: string; label: string; ts: number }[] = [];
let tokenUsage = { totalTokens: 0, totalRequests: 0, ratePerHour: 0, windowStart: Date.now() };

// GET /api/ui-state — return current UI state
app.get('/api/ui-state', (c) => c.json({
  theme: uiStateStore.theme || 'dark',
  sidebarOpen: uiStateStore.sidebarOpen ?? true,
  activeView: uiStateStore.activeView || 'overview',
  soundEnabled: uiStateStore.soundEnabled ?? true,
  compactMode: uiStateStore.compactMode ?? false,
  lastViewed: uiStateStore.lastViewed || null,
  custom: uiStateStore.custom || {},
  ts: Date.now(),
}));

// POST /api/ui-state — update UI state (merge)
app.post('/api/ui-state', async (c) => {
  try {
    const body = await c.req.json();
    Object.assign(uiStateStore, body);
    return c.json({ ok: true, state: uiStateStore });
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
});

// GET /api/pin-info — dashboard pinned items
app.get('/api/pin-info', (c) => c.json({ locked: false, pinned: pinnedItems }));

// POST /api/pin-info — pin/unpin items
app.post('/api/pin-info', async (c) => {
  try {
    const body = await c.req.json();
    if (body.action === 'pin' && body.id) {
      pinnedItems.push({ id: body.id, type: body.type || 'agent', label: body.label || body.id, ts: Date.now() });
    } else if (body.action === 'unpin' && body.id) {
      const idx = pinnedItems.findIndex(p => p.id === body.id);
      if (idx >= 0) pinnedItems.splice(idx, 1);
    }
    return c.json({ ok: true, pinned: pinnedItems });
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
});

// GET /api/tokens/rate — token rate limit info
app.get('/api/tokens/rate', (c) => {
  const elapsed = (Date.now() - tokenUsage.windowStart) / 1000;
  tokenUsage.ratePerHour = elapsed > 0 ? Math.round(tokenUsage.totalTokens / (elapsed / 3600)) : 0;
  return c.json({
    totalTokens: tokenUsage.totalTokens,
    totalRequests: tokenUsage.totalRequests,
    ratePerHour: tokenUsage.ratePerHour,
    window: 3600,
    remaining: Infinity,
  });
});

// GET /favicon.svg — serve favicon from dashboard public dir
const FAVICON_PATH = join(DASHBOARD_DIST, 'favicon.svg');
const FAVICON_PUBLIC = join(__dirname, 'dashboard', 'public', 'favicon.svg');
const faviconFile = existsSync(FAVICON_PATH) ? FAVICON_PATH : existsSync(FAVICON_PUBLIC) ? FAVICON_PUBLIC : null;
if (faviconFile) {
  app.get('/favicon.svg', (c) => {
    const svg = readFileSync(faviconFile, 'utf-8');
    return c.body(svg, 200, { 'Content-Type': 'image/svg+xml' });
  });
} else {
  // Fallback: simple SVG favicon
  app.get('/favicon.svg', (c) => {
    return c.body('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#6366f1"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="16" font-family="sans-serif">🧠</text></svg>', 200, { 'Content-Type': 'image/svg+xml' });
  });
}

// GET /api/maw-log — alias for /api/logs (dashboard expects maw-log)
app.get('/api/maw-log', (c) => {
  // Redirect query params to /api/logs
  const qs = new URL(c.req.url).search;
  return c.redirect(`/api/logs${qs}`, 307);
});

// GET /api/plugins — list loaded plugins
app.get('/api/plugins', async (c) => {
  const pluginDir = join(process.cwd(), 'plugins');
  const plugins: { name: string; hooks: string[]; hasInit: boolean; loaded: boolean }[] = [];

  // List built-in plugins
  plugins.push(
    { name: 'logger', hooks: ['feed_event', 'agent_spawn', 'shutdown'], hasInit: false, loaded: true },
    { name: 'stats', hooks: ['agent_message', 'agent_spawn', 'task_create'], hasInit: false, loaded: true },
  );

  // Scan plugins directory
  try {
    const { readdirSync } = await import('fs');
    const files = readdirSync(pluginDir).filter(f => f.endsWith('.js') || f.endsWith('.mjs'));
    for (const file of files) {
      plugins.push({
        name: file.replace(/\.(js|mjs)$/, ''),
        hooks: ['*'],
        hasInit: false,
        loaded: true,
      });
    }
  } catch {
    // plugins dir doesn't exist yet — that's fine
  }

  return c.json({ plugins, total: plugins.length });
});

const port = Number(process.env.HUB_PORT || config.port || 3456);

console.log(`🧠 Oracle Multi-Agent v5.0`);
console.log(`   host: ${config.host} | port: ${port}`);
console.log(`   process: ${processType}`);
console.log(`   provider: ${process.env.LLM_PROVIDER || 'gemini'}`);
console.log(`   model: ${process.env.AGENT_MODEL || 'gemini-2.0-flash'}`);
console.log(`   pid: ${process.pid}`);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`   listening on http://0.0.0.0:${info.port}`);
  if (hasDist) {
    console.log(`   dashboard: http://0.0.0.0:${info.port}`);
  } else {
    console.log(`   dashboard: cd src/dashboard && npx vite (port 5173)`);
  }
  console.log(`   websocket: ws://0.0.0.0:${info.port}/ws`);
  console.log(`\n   📡 v2 API ready:`);
  console.log(`      POST /api/v2/agents/spawn   — spawn agent`);
  console.log(`      GET  /api/v2/agents          — list agents`);
  console.log(`      POST /api/v2/agents/:id/chat — chat`);
  console.log(`      GET  /api/v2/memory/search?q — search memory`);
  console.log(`      GET  /api/v2/memory/stats    — KB stats`);
  console.log(`      POST /api/v2/agents/broadcast — broadcast`);
});

// ─── WebSocket /ws — Dashboard real-time updates ────────────────
const wss = new WebSocketServer({ server: server as any, path: '/ws' });

// Broadcast helper — send to all connected WS clients
function wsBroadcast(data: any) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(msg);
    }
  }
}

// Make broadcast available to other modules (agent-bridge, etc.)
(globalThis as any).__wsBroadcast = wsBroadcast;

// ─── Dashboard session polling ──────────────────────────────────
// Dashboard expects periodic "sessions" messages via WebSocket
// containing running tmux/pty sessions + agent list.

function listTmuxSessions(): { name: string; attached: boolean }[] {
  try {
    const { execSync } = require('child_process');
    const raw = execSync(
      `tmux list-sessions -F '#{session_name}:#{session_attached}' 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map((line: string) => {
      const [name, attached] = line.split(':');
      return { name, attached: attached === '1' };
    });
  } catch {
    return [];
  }
}

function broadcastDashboardState() {
  try {
    const sessions = listTmuxSessions();

    // Scan for agents in tmux sessions (Claude/Oracle processes)
    const agents: { target: string; name: string; session: string }[] = [];
    for (const sess of sessions) {
      try {
        const { execSync } = require('child_process');
        const cmd = execSync(
          `tmux list-panes -t '${sess.name}' -F '#{pane_current_command}' 2>/dev/null`,
          { encoding: 'utf-8', timeout: 3000 }
        ).trim();
        if (/claude|oracle|codex/i.test(cmd)) {
          agents.push({ target: sess.name, name: sess.name, session: sess.name });
        }
      } catch {}
    }

    wsBroadcast({ type: 'sessions', sessions, agents, ts: Date.now() });
  } catch {}
}

// Broadcast every 10 seconds
setInterval(broadcastDashboardState, 10000);
// Also broadcast immediately on new WS connection
const origOnConnection = wss.listeners('connection')[0];
wss.removeAllListeners('connection');
wss.on('connection', (ws: any, req: any) => {
  const ip = req.socket.remoteAddress;
  console.log(`🔌 WebSocket connected: ${ip}`);

  // Send current state immediately
  try {
    const sessions = listTmuxSessions();
    const agents: { target: string; name: string; session: string }[] = [];
    for (const sess of sessions) {
      try {
        const { execSync } = require('child_process');
        const cmd = execSync(
          `tmux list-panes -t '${sess.name}' -F '#{pane_current_command}' 2>/dev/null`,
          { encoding: 'utf-8', timeout: 3000 }
        ).trim();
        if (/claude|oracle|codex/i.test(cmd)) {
          agents.push({ target: sess.name, name: sess.name, session: sess.name });
        }
      } catch {}
    }
    ws.send(JSON.stringify({ type: 'sessions', sessions, agents, ts: Date.now() }));
  } catch {
    ws.send(JSON.stringify({ type: 'sessions', sessions: [], agents: [], ts: Date.now() }));
  }

  ws.on('message', (raw: any) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      }
    } catch {}
  });

  ws.on('close', () => { console.log(`🔌 WebSocket disconnected: ${ip}`); });
  ws.on('error', (err: any) => { console.error(`🔌 WebSocket error:`, err.message); });
});

console.log(`   🔌 WebSocket ready on /ws`);
