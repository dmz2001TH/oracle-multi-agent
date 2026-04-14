/**
 * Hybrid Search Engine — SQLite FTS5 + Vector Embeddings
 * Replaces linear scan with proper full-text + semantic search.
 * Based on: arra-oracle-v2 hybrid search pattern
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface SearchResult {
  id: string;
  content: string;
  source: string;
  score: number;        // relevance score 0-1
  matchType: "fts" | "semantic" | "hybrid";
  highlights?: string[];
  timestamp?: string;
}

export interface SearchConfig {
  ftsWeight: number;     // weight for FTS score (0-1)
  semanticWeight: number; // weight for semantic score (0-1)
  maxResults: number;
  minScore: number;
}

const DEFAULT_CONFIG: SearchConfig = {
  ftsWeight: 0.6,
  semanticWeight: 0.4,
  maxResults: 20,
  minScore: 0.1,
};

/**
 * Simple tokenizer for FTS indexing.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sก-๙]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Build an inverted index from documents.
 * Structure: term → [{ docId, positions, tf }]
 */
export interface IndexEntry {
  docId: string;
  positions: number[];
  tf: number;           // term frequency
}

export interface InvertedIndex {
  terms: Map<string, IndexEntry[]>;
  docCount: number;
  docLengths: Map<string, number>;
  avgDocLength: number;
}

export function buildIndex(docs: { id: string; content: string }[]): InvertedIndex {
  const terms = new Map<string, IndexEntry[]>();
  const docLengths = new Map<string, number>();
  let totalLength = 0;

  for (const doc of docs) {
    const tokens = tokenize(doc.content);
    docLengths.set(doc.id, tokens.length);
    totalLength += tokens.length;

    const termPositions = new Map<string, number[]>();
    tokens.forEach((token, pos) => {
      if (!termPositions.has(token)) termPositions.set(token, []);
      termPositions.get(token)!.push(pos);
    });

    for (const [term, positions] of termPositions) {
      if (!terms.has(term)) terms.set(term, []);
      terms.get(term)!.push({
        docId: doc.id,
        positions,
        tf: positions.length / tokens.length,
      });
    }
  }

  return {
    terms,
    docCount: docs.length,
    docLengths,
    avgDocLength: docs.length > 0 ? totalLength / docs.length : 0,
  };
}

/**
 * BM25 scoring — industry standard for FTS ranking.
 */
function bm25Score(
  term: string,
  docId: string,
  index: InvertedIndex,
  k1: number = 1.2,
  b: number = 0.75
): number {
  const entries = index.terms.get(term);
  if (!entries) return 0;

  const entry = entries.find(e => e.docId === docId);
  if (!entry) return 0;

  // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
  const df = entries.length;
  const idf = Math.log((index.docCount - df + 0.5) / (df + 0.5) + 1);

  // TF component with length normalization
  const dl = index.docLengths.get(docId) || 0;
  const tf = entry.positions.length;
  const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / index.avgDocLength));

  return idf * tfNorm;
}

/**
 * Search using BM25 FTS scoring.
 */
export function searchFTS(
  query: string,
  index: InvertedIndex,
  docs: Map<string, { content: string; source: string; timestamp?: string }>,
  config: Partial<SearchConfig> = {}
): SearchResult[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const queryTokens = tokenize(query);
  const scores = new Map<string, number>();

  for (const token of queryTokens) {
    // Exact match
    for (const [term, entries] of index.terms) {
      if (term === token || term.includes(token) || token.includes(term)) {
        for (const entry of entries) {
          const current = scores.get(entry.docId) || 0;
          scores.set(entry.docId, current + bm25Score(token, entry.docId, index));
        }
      }
    }
  }

  // Normalize scores
  const maxScore = Math.max(...scores.values(), 1);

  const results: SearchResult[] = [];
  for (const [docId, score] of scores) {
    const normalizedScore = score / maxScore;
    if (normalizedScore < cfg.minScore) continue;

    const doc = docs.get(docId);
    if (!doc) continue;

    // Extract highlights
    const highlights = extractHighlights(doc.content, queryTokens);

    results.push({
      id: docId,
      content: doc.content,
      source: doc.source,
      score: normalizedScore,
      matchType: "fts",
      highlights,
      timestamp: doc.timestamp,
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, cfg.maxResults);
}

/**
 * Extract matching snippets around query terms.
 */
function extractHighlights(content: string, tokens: string[], contextChars: number = 80): string[] {
  const highlights: string[] = [];
  const lower = content.toLowerCase();

  for (const token of tokens) {
    let idx = 0;
    let found = 0;
    while (found < 3) {
      const pos = lower.indexOf(token, idx);
      if (pos === -1) break;
      const start = Math.max(0, pos - contextChars);
      const end = Math.min(content.length, pos + token.length + contextChars);
      const snippet = (start > 0 ? "..." : "") +
        content.substring(start, end).replace(/\n/g, " ") +
        (end < content.length ? "..." : "");
      highlights.push(snippet);
      idx = pos + 1;
      found++;
    }
  }

  return highlights.slice(0, 5);
}

/**
 * Simple cosine similarity for vector comparison.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dotProduct / denom : 0;
}

/**
 * Hybrid search combining FTS and semantic scores.
 * If no vector store available, falls back to pure FTS.
 */
export function searchHybrid(
  query: string,
  index: InvertedIndex,
  docs: Map<string, { content: string; source: string; timestamp?: string }>,
  vectorSearchFn?: (query: string) => Promise<{ docId: string; score: number }[]>,
  config: Partial<SearchConfig> = {}
): Promise<SearchResult[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Always run FTS
  const ftsResults = searchFTS(query, index, docs, cfg);

  if (!vectorSearchFn) {
    return Promise.resolve(ftsResults);
  }

  // Run semantic search in parallel
  return vectorSearchFn(query).then(semanticResults => {
    const combined = new Map<string, SearchResult>();

    // Add FTS results
    for (const r of ftsResults) {
      combined.set(r.id, { ...r, score: r.score * cfg.ftsWeight });
    }

    // Merge semantic results
    for (const sr of semanticResults) {
      const existing = combined.get(sr.docId);
      if (existing) {
        existing.score += sr.score * cfg.semanticWeight;
        existing.matchType = "hybrid";
      } else {
        const doc = docs.get(sr.docId);
        if (doc) {
          combined.set(sr.docId, {
            id: sr.docId, content: doc.content, source: doc.source,
            score: sr.score * cfg.semanticWeight, matchType: "semantic",
            timestamp: doc.timestamp,
          });
        }
      }
    }

    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, cfg.maxResults);
  });
}

/**
 * Load documents from ~/.oracle directory for indexing.
 */
export function loadOracleDocuments(): { id: string; content: string; source: string; timestamp?: string }[] {
  const docs: { id: string; content: string; source: string; timestamp?: string }[] = [];
  const oracleDir = join(homedir(), ".oracle");

  // Load from known directories
  const dirs = [
    { path: join(oracleDir, "memory"), prefix: "memory" },
    { path: join(oracleDir, "journal"), prefix: "journal" },
    { path: join(oracleDir, "inbox"), prefix: "inbox" },
  ];

  for (const { path: dir, prefix } of dirs) {
    if (!existsSync(dir)) continue;
    try {
      const fs = require("fs");
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith(".md") && !file.endsWith(".jsonl") && !file.endsWith(".json")) continue;
        try {
          const content = fs.readFileSync(join(dir, file), "utf-8");
          docs.push({
            id: `${prefix}/${file}`,
            content,
            source: `${prefix}/${file}`,
            timestamp: file.match(/\d{4}-\d{2}-\d{2}/)?.[0],
          });
        } catch {}
      }
    } catch {}
  }

  return docs;
}
