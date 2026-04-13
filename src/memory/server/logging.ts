/**
 * Server Logging — Oracle memory search & learn logging
 *
 * Persists search queries and learning events to the SQLite database
 * using the search_log and learn_log tables for analytics.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

let _db: Database.Database | null = null;

function getDb(): Database.Database | null {
  if (_db) return _db;
  try {
    const dbPath = process.env.DB_PATH || './data/oracle.db';
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('synchronous = NORMAL');

    _db.exec(`
      CREATE TABLE IF NOT EXISTS search_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        type TEXT,
        mode TEXT,
        results_count INTEGER,
        search_time_ms INTEGER,
        created_at INTEGER NOT NULL,
        project TEXT,
        results TEXT
      );
      CREATE TABLE IF NOT EXISTS learn_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        pattern_preview TEXT,
        source TEXT,
        concepts TEXT,
        created_at INTEGER NOT NULL,
        project TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_search_project ON search_log(project);
      CREATE INDEX IF NOT EXISTS idx_search_created ON search_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_learn_project ON learn_log(project);
      CREATE INDEX IF NOT EXISTS idx_learn_created ON learn_log(created_at);
    `);

    return _db;
  } catch (err) {
    console.warn(`⚠️ Logging DB init failed: ${(err as Error).message}`);
    return null;
  }
}

export function logSearch(
  query: string,
  type: string,
  mode: string,
  resultsCount: number,
  searchTimeMs: number,
  results: any[] = [],
  project?: string
): void {
  const db = getDb();
  if (!db) return;

  try {
    const topResults = results.slice(0, 5).map(r => ({
      id: r.id,
      type: r.type,
      score: r.score,
      snippet: typeof r.content === 'string' ? r.content.slice(0, 120) : '',
    }));

    db.prepare(`
      INSERT INTO search_log (query, type, mode, results_count, search_time_ms, created_at, project, results)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(query, type || 'all', mode || 'hybrid', resultsCount, searchTimeMs,
      Math.floor(Date.now() / 1000), project || null, JSON.stringify(topResults));
  } catch (err) {
    console.warn(`⚠️ logSearch failed: ${(err as Error).message}`);
  }
}

export function logLearn(
  documentId: string,
  patternPreview: string,
  source: string,
  concepts: string[] = [],
  project?: string
): void {
  const db = getDb();
  if (!db) return;

  try {
    db.prepare(`
      INSERT INTO learn_log (document_id, pattern_preview, source, concepts, created_at, project)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(documentId, patternPreview?.slice(0, 200) || '', source || 'unknown',
      JSON.stringify(concepts), Math.floor(Date.now() / 1000), project || null);
  } catch (err) {
    console.warn(`⚠️ logLearn failed: ${(err as Error).message}`);
  }
}

export function getSearchStats(project?: string, hours: number = 24): {
  totalSearches: number;
  avgTimeMs: number;
  topQueries: { query: string; count: number }[];
} {
  const db = getDb();
  if (!db) return { totalSearches: 0, avgTimeMs: 0, topQueries: [] };

  try {
    const since = Math.floor(Date.now() / 1000) - hours * 3600;
    const whereClause = project
      ? `WHERE created_at > ? AND (project = ? OR project IS NULL)`
      : `WHERE created_at > ?`;
    const params = project ? [since, project] : [since];

    const total = (db.prepare(`SELECT COUNT(*) as cnt FROM search_log ${whereClause}`).get(...params) as any).cnt;
    const avg = (db.prepare(`SELECT AVG(search_time_ms) as avg FROM search_log ${whereClause}`).get(...params) as any).avg || 0;
    const top = db.prepare(`SELECT query, COUNT(*) as cnt FROM search_log ${whereClause} GROUP BY query ORDER BY cnt DESC LIMIT 10`).all(...params) as any[];

    return {
      totalSearches: total,
      avgTimeMs: Math.round(avg),
      topQueries: top.map(t => ({ query: t.query, count: t.cnt })),
    };
  } catch {
    return { totalSearches: 0, avgTimeMs: 0, topQueries: [] };
  }
}
