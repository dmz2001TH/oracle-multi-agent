/**
 * Vault Handler — for oracle tools
 * Provides getVaultPsiRoot and related functions
 */

import path from 'path';
import fs from 'fs';
import { ORACLE_DATA_DIR } from '../config.ts';

export type VaultResult = { path: string } | { needsInit: true; hint: string };

export function getVaultPsiRoot(): VaultResult {
  const psiPath = path.join(ORACLE_DATA_DIR, 'psi');
  if (!fs.existsSync(psiPath)) {
    return { needsInit: true, hint: `Vault not initialized. Create ${psiPath} first.` };
  }
  return { path: psiPath };
}

export function walkFiles(dir: string, exts?: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, exts));
    } else if (!exts || exts.includes(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}
