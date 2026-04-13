import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// ── Graph Nodes ────────────────────────────────────────
export const graphNodes = sqliteTable('graph_nodes', {
  id: text('id').primaryKey(),                    // "{oracle}:{doc_id}" or "concept:{name}"
  label: text('label').notNull(),                 // concept, learning, principle, retro, oracle
  name: text('name').notNull(),                   // human-readable name
  oracleSource: text('oracle_source'),            // which Oracle it came from
  domain: text('domain'),                         // department: management, engineering, etc.
  properties: text('properties').default('{}'),   // JSON metadata
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  supersededBy: text('superseded_by'),            // Nothing is Deleted
}, (t) => [
  index('idx_gn_label').on(t.label),
  index('idx_gn_oracle').on(t.oracleSource),
  index('idx_gn_domain').on(t.domain),
  index('idx_gn_name').on(t.name),
]);

// ── Graph Edges ────────────────────────────────────────
export const graphEdges = sqliteTable('graph_edges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: text('source_id').notNull(),
  targetId: text('target_id').notNull(),
  relType: text('rel_type').notNull(),            // SHARES_CONCEPT, BELONGS_TO, BRIDGES, RELATES_TO
  weight: real('weight').default(1.0),
  confidence: real('confidence').default(0.5),    // 0.0 - 1.0
  properties: text('properties').default('{}'),   // JSON metadata
  createdAt: integer('created_at').notNull(),
}, (t) => [
  index('idx_ge_source').on(t.sourceId),
  index('idx_ge_target').on(t.targetId),
  index('idx_ge_type').on(t.relType),
  index('idx_ge_confidence').on(t.confidence),
  index('idx_ge_pair').on(t.sourceId, t.targetId),
]);

// ── Discoveries ────────────────────────────────────────
export const discoveries = sqliteTable('discoveries', {
  id: text('id').primaryKey(),
  discoveryType: text('discovery_type').notNull(),  // bridge, chain, cluster
  title: text('title').notNull(),
  description: text('description'),
  sourceOracles: text('source_oracles').default('[]'),  // JSON array
  path: text('path').default('[]'),                     // JSON array of node IDs
  scoreNovelty: real('score_novelty').default(0),
  scoreFeasibility: real('score_feasibility').default(0),
  scoreImpact: real('score_impact').default(0),
  scoreCrossDomain: real('score_cross_domain').default(0),
  scoreSpecificity: real('score_specificity').default(0),
  compositeScore: real('composite_score').default(0),
  impactRadius: text('impact_radius').default('{}'),  // JSON: { depth_1: [], depth_2: [], depth_3: [] }
  status: text('status').default('raw'),              // raw, verified, reported, superseded
  reportedTo: text('reported_to').default('[]'),      // JSON array
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => [
  index('idx_disc_type').on(t.discoveryType),
  index('idx_disc_score').on(t.compositeScore),
  index('idx_disc_status').on(t.status),
]);

// ── Harvest Log ────────────────────────────────────────
export const harvestLog = sqliteTable('harvest_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  oracleName: text('oracle_name').notNull(),
  oraclePort: integer('oracle_port'),
  nodesHarvested: integer('nodes_harvested').default(0),
  edgesCreated: integer('edges_created').default(0),
  status: text('status').default('pending'),  // pending, success, failed
  error: text('error'),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at'),
}, (t) => [
  index('idx_hl_oracle').on(t.oracleName),
  index('idx_hl_status').on(t.status),
]);

// ── Graph Metrics ──────────────────────────────────────
export const graphMetrics = sqliteTable('graph_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nodeCount: integer('node_count').default(0),
  edgeCount: integer('edge_count').default(0),
  discoveryCount: integer('discovery_count').default(0),
  connectivity: real('connectivity').default(0),      // % nodes with 3+ edges
  orphanRate: real('orphan_rate').default(0),          // % nodes with 0 edges
  crossDomainLinks: integer('cross_domain_links').default(0),
  communityCount: integer('community_count').default(0),
  measuredAt: integer('measured_at').notNull(),
});
