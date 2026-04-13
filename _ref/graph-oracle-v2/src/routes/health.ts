import type { Hono } from 'hono';
import { PORT } from '../config.ts';
import { SERVER_NAME } from '../const.ts';
import { sqlite } from '../db/index.ts';

export function registerHealthRoutes(app: Hono) {
  app.get('/api/health', (c) => {
    return c.json({ status: 'ok', server: SERVER_NAME, port: PORT });
  });

  app.get('/api/graph/stats', (c) => {
    const nodes = sqlite.prepare('SELECT COUNT(*) as count FROM graph_nodes').get() as any;
    const edges = sqlite.prepare('SELECT COUNT(*) as count FROM graph_edges').get() as any;
    const discs = sqlite.prepare('SELECT COUNT(*) as count FROM discoveries').get() as any;
    const harvests = sqlite.prepare("SELECT COUNT(DISTINCT oracle_name) as count FROM harvest_log WHERE status='success'").get() as any;
    const lastHarvest = sqlite.prepare('SELECT MAX(completed_at) as ts FROM harvest_log').get() as any;

    // Connectivity: % nodes with 3+ edges
    const totalNodes = nodes?.count || 0;
    const connectedNodes = sqlite.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT source_id as nid FROM graph_edges GROUP BY source_id HAVING COUNT(*) >= 3
        UNION
        SELECT target_id as nid FROM graph_edges GROUP BY target_id HAVING COUNT(*) >= 3
      )
    `).get() as any;
    const connectivity = totalNodes > 0 ? (connectedNodes?.count || 0) / totalNodes : 0;

    // Orphan rate: % nodes with 0 edges
    const orphans = sqlite.prepare(`
      SELECT COUNT(*) as count FROM graph_nodes
      WHERE id NOT IN (SELECT source_id FROM graph_edges)
        AND id NOT IN (SELECT target_id FROM graph_edges)
    `).get() as any;
    const orphanRate = totalNodes > 0 ? (orphans?.count || 0) / totalNodes : 0;

    // Cross-domain links
    const crossDomain = sqlite.prepare(`
      SELECT COUNT(*) as count FROM graph_edges e
      JOIN graph_nodes s ON s.id = e.source_id
      JOIN graph_nodes t ON t.id = e.target_id
      WHERE s.domain IS NOT NULL AND t.domain IS NOT NULL AND s.domain != t.domain
    `).get() as any;

    return c.json({
      nodes: nodes?.count || 0,
      edges: edges?.count || 0,
      discoveries: discs?.count || 0,
      oracles_harvested: harvests?.count || 0,
      last_harvest: lastHarvest?.ts ? new Date(lastHarvest.ts).toISOString() : null,
      metrics: {
        connectivity: Math.round(connectivity * 100) / 100,
        orphan_rate: Math.round(orphanRate * 100) / 100,
        cross_domain_links: crossDomain?.count || 0,
      },
    });
  });
}
