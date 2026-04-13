/**
 * Oracle Memory Configuration
 * Adapted from arra-oracle-v3 — uses Node.js path/fs, no Bun APIs
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as C from './const.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const home = process.env.HOME || process.env.USERPROFILE;
if (!home) throw new Error('HOME environment variable not set');

export const HOME_DIR = home;
export const PORT = parseInt(String(process.env.ORACLE_PORT || C.ORACLE_DEFAULT_PORT), 10);
export const ORACLE_DATA_DIR = process.env.ORACLE_DATA_DIR || path.join(HOME_DIR, C.ORACLE_DATA_DIR_NAME);
export const DB_PATH = process.env.ORACLE_DB_PATH || path.join(ORACLE_DATA_DIR, C.ORACLE_DB_FILE);

export const REPO_ROOT = process.env.ORACLE_REPO_ROOT ||
  (fs.existsSync(path.join(PROJECT_ROOT, 'ψ')) ? PROJECT_ROOT : ORACLE_DATA_DIR);

export const FEED_LOG = path.join(ORACLE_DATA_DIR, C.FEED_LOG_FILE);
export const PLUGINS_DIR = path.join(ORACLE_DATA_DIR, C.PLUGINS_DIR_NAME);
export const SCHEDULE_PATH = path.join(ORACLE_DATA_DIR, C.SCHEDULE_FILE);
export const VECTORS_DB_PATH = path.join(ORACLE_DATA_DIR, C.VECTORS_DB_FILE);
export const LANCEDB_DIR = path.join(ORACLE_DATA_DIR, C.LANCEDB_DIR_NAME);
export const CHROMADB_DIR = path.join(HOME_DIR, C.CHROMADB_DIR_NAME);

if (!fs.existsSync(ORACLE_DATA_DIR)) {
  fs.mkdirSync(ORACLE_DATA_DIR, { recursive: true });
}
