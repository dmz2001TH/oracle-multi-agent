import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { PORT } from './config.ts';
import { SERVER_NAME } from './const.ts';
import { registerHealthRoutes } from './routes/health.ts';
import { registerGraphRoutes } from './routes/graph.ts';

const app = new Hono();

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return origin;
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return origin;
    return null;
  },
  credentials: true,
}));

registerHealthRoutes(app);
registerGraphRoutes(app);

console.log(`
  🕸️  ${SERVER_NAME} running!

  URL: http://localhost:${PORT}

  Endpoints:
  - GET  /api/health              Health check
  - GET  /api/graph/stats         Graph statistics
  - GET  /api/graph/nodes         List nodes
  - GET  /api/graph/nodes/:id     Node + edges
  - GET  /api/graph/bridges       Cross-Oracle bridges
  - GET  /api/graph/traverse      Multi-hop traversal
  - GET  /api/graph/discoveries   List discoveries
  - GET  /api/graph/communities   Leiden communities
  - POST /api/graph/harvest       Trigger harvest
  - POST /api/graph/discover      Trigger discovery
`);

export default { port: PORT, fetch: app.fetch };
