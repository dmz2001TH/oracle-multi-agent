import type { Hono } from 'hono';
import { sqlite } from '../db/index.ts';
import { getOnlineOracles, getOracleUrl } from '../fleet.ts';
import { harvestOracle, buildCrossOracleEdges } from '../harvesters/oracle-harvester.ts';
import { searchByKeyword, getCrossDomainBridges, traverse } from '../engine/traversal.ts';
import { runDiscovery } from '../engine/discovery.ts';
import { rrfMerge } from '../engine/scoring.ts';

export function registerGraphRoutes(app: Hono) {

  // ── Nodes ────────────────────────────────────────────
  app.get('/api/graph/nodes', (c) => {
    const oracle = c.req.query('oracle');
    const label = c.req.query('label');
    const q = c.req.query('q');
    const limit = Math.min(200, parseInt(c.req.query('limit') || '50'));
    const offset = parseInt(c.req.query('offset') || '0');

    let sql = 'SELECT * FROM graph_nodes WHERE 1=1';
    const params: any[] = [];

    if (oracle) { sql += ' AND oracle_source = ?'; params.push(oracle); }
    if (label) { sql += ' AND label = ?'; params.push(label); }
    if (q) { sql += ' AND (name LIKE ? OR properties LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }

    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const nodes = sqlite.prepare(sql).all(...params);
    const total = sqlite.prepare(sql.replace(/SELECT \*/, 'SELECT COUNT(*) as count').replace(/ORDER BY.*/, '')).get(...params.slice(0, -2)) as any;

    return c.json({ nodes, total: total?.count || nodes.length });
  });

  app.get('/api/graph/nodes/:id', (c) => {
    const id = c.req.param('id');
    const node = sqlite.prepare('SELECT * FROM graph_nodes WHERE id = ?').get(id);
    if (!node) return c.json({ error: 'Node not found' }, 404);

    const edges = sqlite.prepare(
      'SELECT * FROM graph_edges WHERE source_id = ? OR target_id = ? ORDER BY confidence DESC'
    ).all(id, id);

    const connectedIds = new Set<string>();
    for (const e of edges as any[]) {
      if (e.source_id !== id) connectedIds.add(e.source_id);
      if (e.target_id !== id) connectedIds.add(e.target_id);
    }

    const connectedNodes = connectedIds.size > 0
      ? sqlite.prepare(`SELECT * FROM graph_nodes WHERE id IN (${[...connectedIds].map(() => '?').join(',')})`).all(...connectedIds)
      : [];

    return c.json({ node, edges, connected_nodes: connectedNodes });
  });

  // ── Search (RRF) ─────────────────────────────────────
  app.get('/api/graph/search', (c) => {
    const q = c.req.query('q');
    if (!q) return c.json({ error: 'Missing q parameter' }, 400);

    const oracle = c.req.query('oracle');
    const label = c.req.query('label');

    // Build multiple ranked lists for RRF
    const lists: any[][] = [];

    // Name match (exact-ish)
    const nameResults = sqlite.prepare(
      'SELECT * FROM graph_nodes WHERE name LIKE ? ORDER BY LENGTH(name) ASC LIMIT 20'
    ).all(`%${q}%`) as any[];
    lists.push(nameResults);

    // Properties match
    const propResults = sqlite.prepare(
      'SELECT * FROM graph_nodes WHERE properties LIKE ? AND name NOT LIKE ? ORDER BY updated_at DESC LIMIT 20'
    ).all(`%${q}%`, `%${q}%`) as any[];
    lists.push(propResults);

    let merged = rrfMerge(lists);

    if (oracle) merged = merged.filter((n: any) => n.oracle_source === oracle);
    if (label) merged = merged.filter((n: any) => n.label === label);

    return c.json({ results: merged.slice(0, 20), total: merged.length, query: q });
  });

  // ── Bridges ──────────────────────────────────────────
  app.get('/api/graph/bridges', (c) => {
    const bridges = getCrossDomainBridges(50);
    return c.json({ bridges, total: bridges.length });
  });

  // ── Traverse ─────────────────────────────────────────
  app.get('/api/graph/traverse', (c) => {
    const from = c.req.query('from');
    if (!from) return c.json({ error: 'Missing from parameter' }, 400);

    const depth = Math.min(4, parseInt(c.req.query('depth') || '3'));
    const crossDomain = c.req.query('cross_domain') === 'true';
    const minConfidence = parseFloat(c.req.query('min_confidence') || '0.5');

    const paths = traverse(from, depth, crossDomain, minConfidence);
    return c.json({ paths, total_paths: paths.length });
  });

  // ── Discoveries ──────────────────────────────────────
  app.get('/api/graph/discoveries', (c) => {
    const minScore = parseFloat(c.req.query('min_score') || '0');
    const type = c.req.query('type');
    const status = c.req.query('status');
    const limit = Math.min(100, parseInt(c.req.query('limit') || '50'));

    let sql = 'SELECT * FROM discoveries WHERE composite_score >= ?';
    const params: any[] = [minScore];

    if (type) { sql += ' AND discovery_type = ?'; params.push(type); }
    if (status) { sql += ' AND status = ?'; params.push(status); }

    sql += ' ORDER BY composite_score DESC LIMIT ?';
    params.push(limit);

    const results = sqlite.prepare(sql).all(...params);
    return c.json({
      discoveries: results.map((r: any) => ({
        ...r,
        source_oracles: JSON.parse(r.source_oracles || '[]'),
        path: JSON.parse(r.path || '[]'),
        impact_radius: JSON.parse(r.impact_radius || '{}'),
        reported_to: JSON.parse(r.reported_to || '[]'),
      })),
      total: results.length,
    });
  });

  // ── Communities ──────────────────────────────────────
  app.get('/api/graph/communities', (c) => {
    // Simple community detection: group concepts by Oracle overlap
    const communities = sqlite.prepare(`
      SELECT cn.name AS concept,
             GROUP_CONCAT(DISTINCT dn.oracle_source) AS oracles,
             COUNT(DISTINCT dn.oracle_source) AS oracle_count,
             COUNT(*) AS node_count
      FROM graph_edges e
      JOIN graph_nodes dn ON dn.id = e.source_id
      JOIN graph_nodes cn ON cn.id = e.target_id
      WHERE e.rel_type = 'SHARES_CONCEPT' AND cn.label = 'concept' AND dn.oracle_source IS NOT NULL
      GROUP BY cn.id
      HAVING oracle_count >= 2
      ORDER BY oracle_count DESC, node_count DESC
      LIMIT 20
    `).all();

    return c.json({
      communities: (communities as any[]).map((c, i) => ({
        id: i + 1,
        label: c.concept,
        oracles: (c.oracles as string).split(','),
        oracle_count: c.oracle_count,
        node_count: c.node_count,
      })),
      total: communities.length,
    });
  });

  // ── Harvest (POST) ───────────────────────────────────
  app.post('/api/graph/harvest', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const targetOracle = (body as any)?.oracle;

    let oracles = await getOnlineOracles();
    if (targetOracle) {
      oracles = oracles.filter(o => o.name === targetOracle);
      if (oracles.length === 0) return c.json({ error: `Oracle "${targetOracle}" not online` }, 404);
    }

    const results = [];
    for (const oracle of oracles) {
      const result = await harvestOracle(oracle);
      results.push(result);
    }

    const crossEdges = buildCrossOracleEdges();

    return c.json({
      harvested: results,
      cross_oracle_edges: crossEdges,
      total_nodes: results.reduce((s, r) => s + r.nodesCreated, 0),
      total_edges: results.reduce((s, r) => s + r.edgesCreated, 0) + crossEdges,
    });
  });

  // ── Discover (POST) ──────────────────────────────────
  app.post('/api/graph/discover', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const minScore = (body as any)?.min_score || 6.0;

    const result = runDiscovery(minScore);
    return c.json(result);
  });
}
