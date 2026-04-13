/**
 * Oracle Multi-Agent v5.0 — Entry point
 */

import { startServer } from "./server.js";
import { loadConfig } from "./config.js";
import { createProcessManager } from "./process/auto-detect.js";
import { PluginSystem } from "./plugins.js";
import { MawEngine } from "./engine/index.js";

const config = loadConfig();
const processManager = createProcessManager();

console.log(`🧠 Oracle Multi-Agent v5.0`);
console.log(`   host: ${config.host} | port: ${config.port}`);
console.log(`   process: ${processManager.constructor.name}`);

startServer();
