/**
 * Oracle Drizzle Database Client (better-sqlite3)
 * Adapted from arra-oracle-v3 — bun:sqlite → better-sqlite3
 */

import { eq } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from './schema.ts';
import { DB_PATH, ORACLE_DATA_DIR } from '../config.ts';

export function initFts5(sqliteDb: Database.Database): void {
  sqliteDb.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS oracle_fts USING fts5(
      id UNINDEXED,
      content,
      concepts,
      tokenize='porter unicode61'
    )
  `);
}

function initializeDatabase(sqliteDb: Database.Database, drizzleDb: BetterSQLite3Database<typeof schema>): void {
  sqliteDb.exec('PRAGMA journal_mode = WAL');
  sqliteDb.exec('PRAGMA busy_timeout = 5000');
  initFts5(sqliteDb);
  sqliteDb.exec('INSERT OR IGNORE INTO indexing_status (id, is_indexing) VALUES (1, 0)');
}

export function createDatabase(dbPath?: string): {
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
} {
  const resolvedPath = dbPath || DB_PATH;
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqliteDb = new Database(resolvedPath);
  const drizzleDb = drizzle(sqliteDb, { schema });
  initializeDatabase(sqliteDb, drizzleDb);
  return { sqlite: sqliteDb, db: drizzleDb };
}

// Default connection
if (!fs.existsSync(ORACLE_DATA_DIR)) {
  fs.mkdirSync(ORACLE_DATA_DIR, { recursive: true });
}

const defaultSqlite: Database.Database = new Database(DB_PATH);
const defaultDb: BetterSQLite3Database<typeof schema> = drizzle(defaultSqlite, { schema });
initializeDatabase(defaultSqlite, defaultDb);

export const sqlite: Database.Database = defaultSqlite;
export const db: BetterSQLite3Database<typeof schema> = defaultDb;
export * from './schema.ts';

export function closeDb() {
  defaultSqlite.close();
}

export function getSetting(key: string): string | null {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null): void {
  db.insert(schema.settings)
    .values({ key, value, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value, updatedAt: Date.now() },
    })
    .run();
}
