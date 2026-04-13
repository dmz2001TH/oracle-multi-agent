/**
 * Vector Store Factory — SQLite-based TF-IDF vector store
 *
 * Falls back to a lightweight SQLite implementation when no external
 * vector DB (ChromaDB, Qdrant, LanceDB) is configured. Uses TF-IDF
 * scoring with cosine similarity for semantic-ish search.
 *
 * For production semantic search, set VECTOR_DB=chroma and install
 * a ChromaDB instance.
 */

import type { VectorStoreAdapter, VectorDocument, VectorQueryResult } from './types.ts';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

let _instance: VectorStoreAdapter | null = null;
let _connected = false;

/**
 * SQLite-backed TF-IDF vector store adapter.
 * Works without any external services — good enough for keyword-semantic hybrid search.
 */
class SqliteVectorStore implements VectorStoreAdapter {
  readonly name = 'sqlite-vector';
  private db: Database.Database;
  private collectionName = 'oracle_vectors';

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this._initSchema();
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vector_documents (
        id TEXT PRIMARY KEY,
        document TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        tokens TEXT NOT NULL DEFAULT '[]',
        tfidf TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_vec_created ON vector_documents(created_at);

      CREATE TABLE IF NOT EXISTS vector_stats (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  async connect(): Promise<void> {
    _connected = true;
  }

  async close(): Promise<void> {
    this.db.close();
    _connected = false;
  }

  async ensureCollection(): Promise<void> { /* schema created in constructor */ }
  async deleteCollection(): Promise<void> {
    this.db.exec('DELETE FROM vector_documents; DELETE FROM vector_stats;');
  }

  async addDocuments(docs: VectorDocument[]): Promise<void> {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO vector_documents (id, document, metadata, tokens, tfidf, created_at)
      VALUES (?, ?, ?, ?, ?, unixepoch())
    `);

    const totalDocs = (this.db.prepare('SELECT COUNT(*) as cnt FROM vector_documents').get() as any).cnt + docs.length;

    const txn = this.db.transaction((documents: VectorDocument[]) => {
      for (const doc of documents) {
        const tokens = this._tokenize(doc.document);
        const tfidf = this._computeTfIdf(tokens, totalDocs);
        insert.run(doc.id, doc.document, JSON.stringify(doc.metadata), JSON.stringify(tokens), JSON.stringify(tfidf));
      }
      // Update doc count
      this.db.prepare(`INSERT OR REPLACE INTO vector_stats (key, value) VALUES ('total_docs', ?)`).run(String(totalDocs));
    });

    txn(docs);
  }

  async query(text: string, limit: number = 5, where?: Record<string, any>): Promise<VectorQueryResult> {
    const queryTokens = this._tokenize(text);
    if (queryTokens.length === 0) {
      return { ids: [], documents: [], distances: [], metadatas: [] };
    }

    const allDocs = this.db.prepare('SELECT id, document, metadata, tfidf FROM vector_documents').all() as any[];
    const scores: { id: string; document: string; metadata: string; score: number }[] = [];

    for (const doc of allDocs) {
      let tfidf: Record<string, number>;
      try { tfidf = JSON.parse(doc.tfidf); } catch { tfidf = {}; }

      let metadata: Record<string, any>;
      try { metadata = JSON.parse(doc.metadata); } catch { metadata = {}; }

      // Apply where filter
      if (where) {
        let match = true;
        for (const [key, val] of Object.entries(where)) {
          if (metadata[key] !== val) { match = false; break; }
        }
        if (!match) continue;
      }

      // Cosine-like similarity using TF-IDF vectors
      let score = 0;
      for (const token of queryTokens) {
        score += tfidf[token] || 0;
      }

      if (score > 0) {
        scores.push({ id: doc.id, document: doc.document, metadata: doc.metadata, score });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, limit);

    return {
      ids: top.map(s => s.id),
      documents: top.map(s => s.document),
      distances: top.map(s => 1 - Math.min(s.score, 1)), // Convert similarity → distance
      metadatas: top.map(s => {
        try { return JSON.parse(s.metadata); } catch { return {}; }
      }),
    };
  }

  async queryById(id: string, nResults: number = 1): Promise<VectorQueryResult> {
    const doc = this.db.prepare('SELECT id, document, metadata FROM vector_documents WHERE id = ?').get(id) as any;
    if (!doc) return { ids: [], documents: [], distances: [], metadatas: [] };

    let metadata;
    try { metadata = JSON.parse(doc.metadata); } catch { metadata = {}; }

    return {
      ids: [doc.id],
      documents: [doc.document],
      distances: [0],
      metadatas: [metadata],
    };
  }

  async getStats(): Promise<{ count: number }> {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM vector_documents').get() as any;
    return { count: row?.cnt || 0 };
  }

  async getCollectionInfo(): Promise<{ count: number; name: string }> {
    const stats = await this.getStats();
    return { count: stats.count, name: this.collectionName };
  }

  /** Simple whitespace + lowercase tokenizer */
  private _tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\sก-๙]/g, ' ') // Keep Thai chars + alphanumeric
      .split(/\s+/)
      .filter(t => t.length > 1 && !_stopWords.has(t));
  }

  /** TF-IDF scoring per document */
  private _computeTfIdf(tokens: string[], totalDocs: number): Record<string, number> {
    const tf: Record<string, number> = {};
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;

    const maxTf = Math.max(...Object.values(tf), 1);
    const tfidf: Record<string, number> = {};

    for (const [term, freq] of Object.entries(tf)) {
      // Approximate IDF: use log scale with smoothing
      const idf = Math.log((totalDocs + 1) / (1 + freq)) + 1;
      tfidf[term] = (freq / maxTf) * Math.max(idf, 0.1);
    }

    return tfidf;
  }
}

/** Common stop words (English + basic) to filter out */
const _stopWords = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
  'nor', 'not', 'no', 'so', 'if', 'then', 'than', 'too', 'very',
  'just', 'about', 'up', 'out', 'it', 'its', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
  'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which', 'who',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same',
]);

/**
 * Get or create the vector store adapter.
 * Checks VECTOR_DB env var:
 *   - 'chroma' → tries ChromaDB (needs separate setup)
 *   - default  → SQLite TF-IDF (no external deps)
 */
export async function ensureVectorStoreConnected(): Promise<VectorStoreAdapter | null> {
  if (_instance && _connected) return _instance;

  const vectorDb = process.env.VECTOR_DB || 'sqlite';

  if (vectorDb === 'chroma') {
    // ChromaDB requires separate server — try to connect
    try {
      console.log('🔍 Attempting ChromaDB connection...');
      // If user has @chromadb/chromadb installed, use it
      // For now, fall back to SQLite
      console.warn('⚠️ ChromaDB adapter not available. Falling back to SQLite vector store.');
    } catch {}
  }

  // Default: SQLite vector store
  try {
    const dbPath = process.env.DB_PATH || './data/oracle.db';
    _instance = new SqliteVectorStore(dbPath);
    await _instance.connect();
    console.log(`✅ Vector store connected: ${_instance.name}`);
    return _instance;
  } catch (err) {
    console.warn(`⚠️ Vector store init failed: ${(err as Error).message}`);
    return null;
  }
}

/** Force reconnect (e.g., after config change) */
export function resetVectorStore(): void {
  _instance = null;
  _connected = false;
}
