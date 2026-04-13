/**
 * Verify Handler — for oracle tools
 * Verifies knowledge base integrity by comparing ψ/ files on disk vs DB index
 */

import fs from 'fs';
import path from 'path';
import { db, sqlite } from '../db/index.ts';
import { oracleDocuments } from '../db/schema.ts';
import { eq, isNull, or } from 'drizzle-orm';

export interface VerifyResult {
  counts: { healthy: number; missing: number; orphaned: number; drifted: number; untracked: number };
  missing: any[];
  orphaned: any[];
  drifted: any[];
  untracked: any[];
  recommendation: string;
  fixedOrphans?: number;
}

export interface VerifyInput {
  check?: boolean;
  type?: string;
  repoRoot: string;
}

export function verifyKnowledgeBase(input: VerifyInput): VerifyResult {
  const { check = true, type, repoRoot } = input;
  const result: VerifyResult = {
    counts: { healthy: 0, missing: 0, orphaned: 0, drifted: 0, untracked: 0 },
    missing: [],
    orphaned: [],
    drifted: [],
    untracked: [],
    recommendation: '',
  };

  // Get documents from DB
  let docs;
  if (type && type !== 'all') {
    docs = db.select().from(oracleDocuments).where(eq(oracleDocuments.type, type)).all();
  } else {
    docs = db.select().from(oracleDocuments).all();
  }

  for (const doc of docs) {
    const filePath = path.join(repoRoot, doc.sourceFile);
    if (fs.existsSync(filePath)) {
      result.counts.healthy++;
    } else {
      result.counts.orphaned++;
      result.orphaned.push({ id: doc.id, sourceFile: doc.sourceFile, type: doc.type });
    }
  }

  // Scan for untracked ψ/ files
  const psiDir = path.join(repoRoot, 'ψ');
  if (fs.existsSync(psiDir)) {
    const walkAndCheck = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkAndCheck(full);
        } else if (entry.name.endsWith('.md')) {
          const rel = path.relative(repoRoot, full);
          const known = docs.some(d => d.sourceFile === rel);
          if (!known) {
            result.counts.untracked++;
            result.untracked.push({ path: rel });
          }
        }
      }
    };
    walkAndCheck(psiDir);
  }

  if (result.counts.orphaned > 0) {
    result.recommendation = `Found ${result.counts.orphaned} orphaned DB entries (file deleted but still in DB). Run with check=false to flag them.`;
  } else {
    result.recommendation = 'Knowledge base is healthy.';
  }

  return result;
}
