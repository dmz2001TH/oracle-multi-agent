import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import { homedir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const PROJECT_ROOT = resolve(__dirname, "..");

export const CONFIG_DIR = process.env.ORACLE_CONFIG_DIR || join(homedir(), ".config", "oracle");
export const FLEET_DIR = join(CONFIG_DIR, "fleet");
export const CONFIG_FILE = join(CONFIG_DIR, "oracle.config.json");

mkdirSync(FLEET_DIR, { recursive: true });
