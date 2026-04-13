/**
 * Oracle Harvester — Pull docs + concepts from a single Oracle
 */

import type { OracleNode } from '../fleet.ts';
import { sqlite } from '../db/index.ts';
import { CONFIDENCE } from '../const.ts';

interface OracleDocument {
  id: string;
  type: string;
  source_file: string;
  concepts: string[] | string;
  project?: string;
}

export interface HarvestResult {
  oracle: string;
  nodesCreated: number;
  edgesCreated: number;
  durationMs: number;
  error?: string;
}

export async function harvestOracle(oracle: OracleNode): Promise<HarvestResult> {
  const start = Date.now();
  const url = `http://localhost:${oracle.port}`;
  let nodesCreated = 0;
  let edgesCreated = 0;

  try {
    // Fetch all documents
    const res = await fetch(`${url}/api/list?limit=2000`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { results: OracleDocument[] };
    const docs = data.results || [];

    const now = Date.now();
    const insertNode = sqlite.prepare(`
      INSERT OR REPLACE INTO graph_nodes (id, label, name, oracle_source, domain, properties, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertEdge = sqlite.prepare(`
      INSERT OR IGNORE INTO graph_edges (source_id, target_id, rel_type, weight, confidence, properties, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Create oracle identity node
    insertNode.run(
      `oracle:${oracle.name}`, 'oracle', oracle.name,
      oracle.name, oracle.department,
      JSON.stringify({ role: oracle.role, port: oracle.port }),
      now, now
    );
    nodesCreated++;

    const conceptSet = new Set<string>();

    const transaction = sqlite.transaction(() => {
      for (const doc of docs) {
        const docId = `${oracle.name}:${doc.id}`;
        const concepts = typeof doc.concepts === 'string'
          ? JSON.parse(doc.concepts) as string[]
          : (doc.concepts || []);
        const name = doc.source_file.split('/').pop() || doc.id;

        // Create document node
        insertNode.run(
          docId, doc.type || 'learning', name,
          oracle.name, oracle.department,
          JSON.stringify({ source_file: doc.source_file, concepts, project: doc.project }),
          now, now
        );
        nodesCreated++;

        // BELONGS_TO edge: doc → oracle
        insertEdge.run(docId, `oracle:${oracle.name}`, 'BELONGS_TO', 1.0, CONFIDENCE.SAME_ORACLE_CONCEPT, '{}', now);
        edgesCreated++;

        // Create concept nodes + SHARES_CONCEPT edges
        for (const concept of concepts) {
          const conceptId = `concept:${concept.toLowerCase().trim()}`;
          conceptSet.add(concept.toLowerCase().trim());

          insertNode.run(
            conceptId, 'concept', concept.toLowerCase().trim(),
            null, null, '{}', now, now
          );

          // doc → concept
          insertEdge.run(docId, conceptId, 'SHARES_CONCEPT', 1.0, CONFIDENCE.EXACT_CONCEPT, '{}', now);
          edgesCreated++;
        }
      }
    });

    transaction();
    nodesCreated += conceptSet.size;

    // Log harvest
    sqlite.prepare(`
      INSERT INTO harvest_log (oracle_name, oracle_port, nodes_harvested, edges_created, status, started_at, completed_at)
      VALUES (?, ?, ?, ?, 'success', ?, ?)
    `).run(oracle.name, oracle.port, nodesCreated, edgesCreated, start, Date.now());

    return { oracle: oracle.name, nodesCreated, edgesCreated, durationMs: Date.now() - start };
  } catch (e: any) {
    sqlite.prepare(`
      INSERT INTO harvest_log (oracle_name, oracle_port, status, error, started_at, completed_at)
      VALUES (?, ?, 'failed', ?, ?, ?)
    `).run(oracle.name, oracle.port, e.message, start, Date.now());

    return { oracle: oracle.name, nodesCreated: 0, edgesCreated: 0, durationMs: Date.now() - start, error: e.message };
  }
}

/** Create cross-Oracle edges for shared concepts */
export function buildCrossOracleEdges(): number {
  const now = Date.now();

  // Find concept nodes shared by docs from different Oracles
  const rows = sqlite.prepare(`
    SELECT e1.source_id AS doc_a, e2.source_id AS doc_b, e1.target_id AS concept_id,
           n1.oracle_source AS oracle_a, n2.oracle_source AS oracle_b,
           n1.domain AS domain_a, n2.domain AS domain_b
    FROM graph_edges e1
    JOIN graph_edges e2 ON e1.target_id = e2.target_id AND e1.source_id < e2.source_id
    JOIN graph_nodes n1 ON n1.id = e1.source_id
    JOIN graph_nodes n2 ON n2.id = e2.source_id
    WHERE e1.rel_type = 'SHARES_CONCEPT'
      AND e2.rel_type = 'SHARES_CONCEPT'
      AND n1.oracle_source IS NOT NULL
      AND n2.oracle_source IS NOT NULL
      AND n1.oracle_source != n2.oracle_source
      AND n1.label != 'oracle' AND n2.label != 'oracle'
  `).all() as any[];

  const insert = sqlite.prepare(`
    INSERT OR IGNORE INTO graph_edges (source_id, target_id, rel_type, weight, confidence, properties, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  const transaction = sqlite.transaction(() => {
    for (const row of rows) {
      const crossDomain = row.domain_a !== row.domain_b;
      const confidence = crossDomain ? CONFIDENCE.CROSS_ORACLE_CONCEPT : CONFIDENCE.SAME_ORACLE_CONCEPT;
      const relType = crossDomain ? 'BRIDGES' : 'RELATES_TO';

      insert.run(
        row.doc_a, row.doc_b, relType, 1.0, confidence,
        JSON.stringify({ via_concept: row.concept_id, oracle_a: row.oracle_a, oracle_b: row.oracle_b }),
        now
      );
      count++;
    }
  });

  transaction();
  return count;
}
