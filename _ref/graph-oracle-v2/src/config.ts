import path from 'path';
import fs from 'fs';
import * as C from './const.ts';

const home = process.env.HOME || process.env.USERPROFILE;
if (!home) throw new Error('HOME not set');

export const PORT = parseInt(String(process.env.GRAPH_PORT || C.GRAPH_DEFAULT_PORT), 10);
export const DATA_DIR = process.env.GRAPH_DATA_DIR || path.join(home, C.GRAPH_DATA_DIR_NAME);
export const DB_PATH = process.env.GRAPH_DB_PATH || path.join(DATA_DIR, C.GRAPH_DB_FILE);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
