/**
 * Discovery Engine — Find bridges, chains, clusters across Oracles
 */

import { sqlite } from '../db/index.ts';
import { getCrossDomainBridges, getDeepChains } from './traversal.ts';
import { scoreBridge, scoreChain, scoreCluster, computeComposite, getGrade, computeImpactRadius } from './scoring.ts';
import { SCORE_B_TIER } from '../const.ts';

function genId(): string {
  return `disc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface DiscoveryResult {
  bridges: number;
  chains: number;
  clusters: number;
  total: number;
  topScore: number;
  durationMs: number;
}

/** Discover cross-domain bridges */
function discoverBridges(minScore: number): number {
  const bridges = getCrossDomainBridges(100);
  const now = Date.now();
  let count = 0;

  const insert = sqlite.prepare(`
    INSERT OR IGNORE INTO discoveries
    (id, discovery_type, title, description, source_oracles, path, score_novelty, score_feasibility,
     score_impact, score_cross_domain, score_specificity, composite_score, impact_radius, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?)
  `);

  for (const bridge of bridges) {
    const oracles = (bridge.oracles as string).split(',');
    const depts = (bridge.departments as string).split(',');

    const scores = scoreBridge(bridge.concept, oracles, depts, bridge.edge_count);
    const composite = computeComposite(scores);
    if (composite < minScore) continue;

    const title = `"${bridge.concept}" connects ${oracles.length} Oracles across ${depts.length} departments`;
    const description = `The concept "${bridge.concept}" appears in ${oracles.join(', ')}. ` +
      `Departments: ${depts.join(', ')}. ${bridge.edge_count} edges with avg confidence ${(bridge.avg_confidence as number).toFixed(2)}.`;
    const impact = computeImpactRadius(oracles);

    // Check for duplicates
    const existing = sqlite.prepare("SELECT id FROM discoveries WHERE title = ?").get(title);
    if (existing) continue;

    insert.run(
      genId(), 'bridge', title, description,
      JSON.stringify(oracles), JSON.stringify([bridge.concept_id]),
      scores.novelty, scores.feasibility, scores.impact, scores.cross_domain, scores.specificity,
      composite, JSON.stringify(impact), now, now
    );
    count++;
  }

  return count;
}

/** Discover multi-hop chains */
function discoverChains(minScore: number): number {
  // Get document nodes from different Oracles as starting points
  const startNodes = sqlite.prepare(`
    SELECT id, oracle_source, domain FROM graph_nodes
    WHERE label IN ('learning', 'principle', 'retro') AND oracle_source IS NOT NULL
    ORDER BY RANDOM() LIMIT 50
  `).all() as any[];

  const now = Date.now();
  let count = 0;
  const seenPaths = new Set<string>();

  const insert = sqlite.prepare(`
    INSERT OR IGNORE INTO discoveries
    (id, discovery_type, title, description, source_oracles, path, score_novelty, score_feasibility,
     score_impact, score_cross_domain, score_specificity, composite_score, impact_radius, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?)
  `);

  for (const start of startNodes) {
    const chains = getDeepChains(start.id, 4, true, 0.5);

    for (const chain of chains.slice(0, 5)) {
      if (chain.domainsCrossed.length < 2) continue;

      const pathKey = chain.nodes.sort().join(',');
      if (seenPaths.has(pathKey)) continue;
      seenPaths.add(pathKey);

      const scores = scoreChain(chain.depth, chain.domainsCrossed, chain.confidenceMin);
      const composite = computeComposite(scores);
      if (composite < minScore) continue;

      // Extract Oracle sources from path
      const oracleSet = new Set<string>();
      for (const nodeId of chain.nodes) {
        const node = sqlite.prepare('SELECT oracle_source FROM graph_nodes WHERE id = ?').get(nodeId) as any;
        if (node?.oracle_source) oracleSet.add(node.oracle_source);
      }
      const oracles = [...oracleSet];
      if (oracles.length < 2) continue;

      const title = `Chain: ${chain.nodeNames[0]} → ${chain.nodeNames[chain.nodeNames.length - 1]}`;
      const description = `${chain.depth}-hop path crossing ${chain.domainsCrossed.join(', ')}. ` +
        `Path: ${chain.nodeNames.join(' → ')}. Confidence: ${chain.confidenceMin.toFixed(2)}.`;
      const impact = computeImpactRadius(oracles);

      insert.run(
        genId(), 'chain', title, description,
        JSON.stringify(oracles), JSON.stringify(chain.nodes),
        scores.novelty, scores.feasibility, scores.impact, scores.cross_domain, scores.specificity,
        composite, JSON.stringify(impact), now, now
      );
      count++;
    }
  }

  return count;
}

/** Discover concept clusters (3+ Oracles sharing 2+ concepts) */
function discoverClusters(minScore: number): number {
  const clusters = sqlite.prepare(`
    SELECT dn.oracle_source, GROUP_CONCAT(DISTINCT cn.name) AS concepts,
           COUNT(DISTINCT cn.name) AS concept_count
    FROM graph_edges e
    JOIN graph_nodes dn ON dn.id = e.source_id
    JOIN graph_nodes cn ON cn.id = e.target_id
    WHERE e.rel_type = 'SHARES_CONCEPT' AND cn.label = 'concept' AND dn.oracle_source IS NOT NULL
    GROUP BY dn.oracle_source
    HAVING concept_count >= 2
  `).all() as any[];

  // Group by shared concepts
  const conceptToOracles = new Map<string, Set<string>>();
  for (const row of clusters) {
    const concepts = (row.concepts as string).split(',');
    for (const c of concepts) {
      const set = conceptToOracles.get(c) || new Set();
      set.add(row.oracle_source);
      conceptToOracles.set(c, set);
    }
  }

  // Find clusters of concepts shared by 3+ Oracles
  const now = Date.now();
  let count = 0;

  const insert = sqlite.prepare(`
    INSERT OR IGNORE INTO discoveries
    (id, discovery_type, title, description, source_oracles, path, score_novelty, score_feasibility,
     score_impact, score_cross_domain, score_specificity, composite_score, impact_radius, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?)
  `);

  for (const [concept, oracleSet] of conceptToOracles) {
    if (oracleSet.size < 3) continue;

    const oracles = [...oracleSet];
    const depts = new Set<string>();
    for (const o of oracles) {
      const node = sqlite.prepare("SELECT domain FROM graph_nodes WHERE id = ?").get(`oracle:${o}`) as any;
      if (node?.domain) depts.add(node.domain);
    }

    const scores = scoreCluster(oracles.length, 1, depts.size);
    const composite = computeComposite(scores);
    if (composite < minScore) continue;

    const title = `Cluster: "${concept}" shared by ${oracles.length} Oracles`;
    const existing = sqlite.prepare("SELECT id FROM discoveries WHERE title = ?").get(title);
    if (existing) continue;

    const description = `${oracles.join(', ')} all work on "${concept}". Potential for standardization.`;
    const impact = computeImpactRadius(oracles);

    insert.run(
      genId(), 'cluster', title, description,
      JSON.stringify(oracles), JSON.stringify([`concept:${concept}`]),
      scores.novelty, scores.feasibility, scores.impact, scores.cross_domain, scores.specificity,
      composite, JSON.stringify(impact), now, now
    );
    count++;
  }

  return count;
}

/** Run all discovery types */
export function runDiscovery(minScore = SCORE_B_TIER): DiscoveryResult {
  const start = Date.now();

  const bridges = discoverBridges(minScore);
  const chains = discoverChains(minScore);
  const clusters = discoverClusters(minScore);

  const topRow = sqlite.prepare('SELECT MAX(composite_score) as top FROM discoveries').get() as any;

  return {
    bridges,
    chains,
    clusters,
    total: bridges + chains + clusters,
    topScore: topRow?.top || 0,
    durationMs: Date.now() - start,
  };
}
