import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';
import * as schema from './schema.ts';
import { DB_PATH, DATA_DIR } from '../config.ts';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.exec('PRAGMA journal_mode = WAL');
sqlite.exec('PRAGMA busy_timeout = 5000');

// Create tables directly (no migrations needed for v1)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS graph_nodes (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    name TEXT NOT NULL,
    oracle_source TEXT,
    domain TEXT,
    properties TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    superseded_by TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_gn_label ON graph_nodes(label);
  CREATE INDEX IF NOT EXISTS idx_gn_oracle ON graph_nodes(oracle_source);
  CREATE INDEX IF NOT EXISTS idx_gn_domain ON graph_nodes(domain);
  CREATE INDEX IF NOT EXISTS idx_gn_name ON graph_nodes(name);

  CREATE TABLE IF NOT EXISTS graph_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    rel_type TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    confidence REAL DEFAULT 0.5,
    properties TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ge_source ON graph_edges(source_id);
  CREATE INDEX IF NOT EXISTS idx_ge_target ON graph_edges(target_id);
  CREATE INDEX IF NOT EXISTS idx_ge_type ON graph_edges(rel_type);
  CREATE INDEX IF NOT EXISTS idx_ge_confidence ON graph_edges(confidence);

  CREATE TABLE IF NOT EXISTS discoveries (
    id TEXT PRIMARY KEY,
    discovery_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    source_oracles TEXT DEFAULT '[]',
    path TEXT DEFAULT '[]',
    score_novelty REAL DEFAULT 0,
    score_feasibility REAL DEFAULT 0,
    score_impact REAL DEFAULT 0,
    score_cross_domain REAL DEFAULT 0,
    score_specificity REAL DEFAULT 0,
    composite_score REAL DEFAULT 0,
    impact_radius TEXT DEFAULT '{}',
    status TEXT DEFAULT 'raw',
    reported_to TEXT DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_disc_type ON discoveries(discovery_type);
  CREATE INDEX IF NOT EXISTS idx_disc_score ON discoveries(composite_score);
  CREATE INDEX IF NOT EXISTS idx_disc_status ON discoveries(status);

  CREATE TABLE IF NOT EXISTS harvest_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    oracle_name TEXT NOT NULL,
    oracle_port INTEGER,
    nodes_harvested INTEGER DEFAULT 0,
    edges_created INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    error TEXT,
    started_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS graph_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_count INTEGER DEFAULT 0,
    edge_count INTEGER DEFAULT 0,
    discovery_count INTEGER DEFAULT 0,
    connectivity REAL DEFAULT 0,
    orphan_rate REAL DEFAULT 0,
    cross_domain_links INTEGER DEFAULT 0,
    community_count INTEGER DEFAULT 0,
    measured_at INTEGER NOT NULL
  );
`);

export const db = drizzle(sqlite, { schema });
export { sqlite };
export * from './schema.ts';

export function closeDb() {
  sqlite.close();
}
