/**
 * Graph Traversal Engine — 4-tier multi-hop queries using SQLite recursive CTEs
 * Adapted from PROMETHEUS deep_retriever patterns + GitNexus BFS constraints
 */

import { sqlite } from '../db/index.ts';
import { MAX_TRAVERSAL_DEPTH, MAX_BRANCH_FACTOR, MIN_CONFIDENCE_THRESHOLD } from '../const.ts';

export interface TraversalPath {
  nodes: string[];
  nodeNames: string[];
  depth: number;
  totalWeight: number;
  confidenceMin: number;
  domainsCrossed: string[];
}

/** Tier 1: Keyword match */
export function searchByKeyword(keyword: string, limit = 20): any[] {
  return sqlite.prepare(`
    SELECT * FROM graph_nodes
    WHERE name LIKE ? OR properties LIKE ?
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(`%${keyword}%`, `%${keyword}%`, limit);
}

/** Tier 2: Neighborhood expansion (1-2 hops) */
export function getNeighborhood(nodeId: string, maxDepth = 2, minConfidence = MIN_CONFIDENCE_THRESHOLD): any[] {
  return sqlite.prepare(`
    WITH RECURSIVE neighbors AS (
      SELECT target_id AS node_id, 1 AS depth, confidence
      FROM graph_edges WHERE source_id = ? AND confidence >= ?
      UNION ALL
      SELECT target_id AS node_id, 1 AS depth, confidence
      FROM graph_edges WHERE target_id = ? AND confidence >= ?
      UNION ALL
      SELECT
        CASE WHEN e.source_id = n.node_id THEN e.target_id ELSE e.source_id END,
        n.depth + 1,
        MIN(n.confidence, e.confidence)
      FROM graph_edges e
      JOIN neighbors n ON (e.source_id = n.node_id OR e.target_id = n.node_id)
      WHERE n.depth < ? AND e.confidence >= ?
    )
    SELECT DISTINCT gn.*, nb.depth, nb.confidence as path_confidence
    FROM neighbors nb
    JOIN graph_nodes gn ON gn.id = nb.node_id
    WHERE gn.id != ?
    ORDER BY nb.depth ASC, nb.confidence DESC
    LIMIT 50
  `).all(nodeId, minConfidence, nodeId, minConfidence, maxDepth, minConfidence, nodeId);
}

/** Tier 3: Cross-domain bridges */
export function getCrossDomainBridges(limit = 50): any[] {
  return sqlite.prepare(`
    SELECT
      cn.name AS concept,
      cn.id AS concept_id,
      GROUP_CONCAT(DISTINCT sn.oracle_source) AS oracles,
      COUNT(DISTINCT sn.oracle_source) AS oracle_count,
      GROUP_CONCAT(DISTINCT sn.domain) AS departments,
      COUNT(DISTINCT sn.domain) AS dept_count,
      COUNT(*) AS edge_count,
      AVG(e.confidence) AS avg_confidence
    FROM graph_edges e
    JOIN graph_nodes sn ON sn.id = e.source_id
    JOIN graph_nodes cn ON cn.id = e.target_id
    WHERE e.rel_type = 'SHARES_CONCEPT'
      AND cn.label = 'concept'
      AND sn.label != 'oracle'
      AND sn.oracle_source IS NOT NULL
    GROUP BY cn.id
    HAVING COUNT(DISTINCT sn.oracle_source) >= 2
    ORDER BY dept_count DESC, oracle_count DESC, edge_count DESC
    LIMIT ?
  `).all(limit);
}

/** Tier 4: Deep chains (3-4 hops) with BFS constraints */
export function getDeepChains(
  startNodeId: string,
  maxDepth = MAX_TRAVERSAL_DEPTH,
  crossDomainOnly = false,
  minConfidence = MIN_CONFIDENCE_THRESHOLD
): TraversalPath[] {
  // BFS with constraints: max depth, max branching, confidence threshold, cycle avoidance
  const paths: TraversalPath[] = [];

  interface QueueItem {
    nodeId: string;
    path: string[];
    names: string[];
    depth: number;
    totalWeight: number;
    minConfidence: number;
    domains: Set<string>;
    visited: Set<string>;
  }

  const startNode = sqlite.prepare('SELECT * FROM graph_nodes WHERE id = ?').get(startNodeId) as any;
  if (!startNode) return [];

  const queue: QueueItem[] = [{
    nodeId: startNodeId,
    path: [startNodeId],
    names: [startNode.name],
    depth: 0,
    totalWeight: 0,
    minConfidence: 1.0,
    domains: new Set(startNode.domain ? [startNode.domain] : []),
    visited: new Set([startNodeId]),
  }];

  const getEdges = sqlite.prepare(`
    SELECT target_id, weight, confidence FROM graph_edges
    WHERE source_id = ? AND confidence >= ?
    UNION ALL
    SELECT source_id, weight, confidence FROM graph_edges
    WHERE target_id = ? AND confidence >= ?
    ORDER BY confidence DESC
    LIMIT ?
  `);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    const edges = getEdges.all(
      current.nodeId, minConfidence,
      current.nodeId, minConfidence,
      MAX_BRANCH_FACTOR
    ) as any[];

    for (const edge of edges) {
      if (current.visited.has(edge.target_id)) continue;

      const targetNode = sqlite.prepare('SELECT * FROM graph_nodes WHERE id = ?').get(edge.target_id) as any;
      if (!targetNode) continue;

      const newDomains = new Set(current.domains);
      if (targetNode.domain) newDomains.add(targetNode.domain);

      const newPath = [...current.path, edge.target_id];
      const newNames = [...current.names, targetNode.name];
      const newConfidence = Math.min(current.minConfidence, edge.confidence);
      const newDepth = current.depth + 1;

      const item: QueueItem = {
        nodeId: edge.target_id,
        path: newPath,
        names: newNames,
        depth: newDepth,
        totalWeight: current.totalWeight + (edge.weight || 1),
        minConfidence: newConfidence,
        domains: newDomains,
        visited: new Set([...current.visited, edge.target_id]),
      };

      // Record paths of depth 2+
      if (newDepth >= 2) {
        const domainsCrossed = [...newDomains];
        if (!crossDomainOnly || domainsCrossed.length >= 2) {
          paths.push({
            nodes: newPath,
            nodeNames: newNames,
            depth: newDepth,
            totalWeight: item.totalWeight,
            confidenceMin: newConfidence,
            domainsCrossed: domainsCrossed,
          });
        }
      }

      if (newDepth < maxDepth) {
        queue.push(item);
      }
    }
  }

  return paths.sort((a, b) => b.domainsCrossed.length - a.domainsCrossed.length || b.totalWeight - a.totalWeight);
}

/** Full traversal: start from a node, explore up to N hops */
export function traverse(fromId: string, depth = 3, crossDomain = false, minConfidence = MIN_CONFIDENCE_THRESHOLD): TraversalPath[] {
  return getDeepChains(fromId, depth, crossDomain, minConfidence).slice(0, 50);
}
