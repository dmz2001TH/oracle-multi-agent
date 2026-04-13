/**
 * Plugin Loader — loads plugins from plugins/ directory
 *
 * Weight-based loading: 00 (core) → 90 (custom)
 * Each plugin has: plugin.json (manifest) + index.ts (handler)
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { PluginManifest, LoadedPlugin, PluginHandler } from "./types.js";

const PLUGINS_DIR = join(process.cwd(), "plugins");

let loadedPlugins: LoadedPlugin[] = [];
let cliRegistry: Map<string, LoadedPlugin> = new Map();
let apiRegistry: Map<string, LoadedPlugin> = new Map();
let hookRegistry: Map<string, LoadedPlugin[]> = new Map();

/**
 * Scan plugins/ directory and load all valid plugins
 */
export async function loadPlugins(): Promise<LoadedPlugin[]> {
  loadedPlugins = [];
  cliRegistry.clear();
  apiRegistry.clear();
  hookRegistry.clear();

  if (!existsSync(PLUGINS_DIR)) {
    console.log("📦 plugins/ directory not found — no plugins loaded");
    return [];
  }

  const entries = readdirSync(PLUGINS_DIR).filter(e => {
    const fullPath = join(PLUGINS_DIR, e);
    return statSync(fullPath).isDirectory();
  });

  // Sort by name (which includes weight prefix like "00-wake", "20-ping")
  entries.sort();

  const plugins: { dir: string; manifest: PluginManifest }[] = [];

  for (const entry of entries) {
    const dir = join(PLUGINS_DIR, entry);
    const manifestPath = join(dir, "plugin.json");

    if (!existsSync(manifestPath)) continue;

    try {
      const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      plugins.push({ dir, manifest });
    } catch (e: any) {
      console.error(`❌ Failed to parse plugin.json in ${entry}: ${e.message}`);
    }
  }

  // Sort by weight
  plugins.sort((a, b) => a.manifest.weight - b.manifest.weight);

  // Load each plugin
  for (const { dir, manifest } of plugins) {
    const loaded = await loadOnePlugin(dir, manifest);
    loadedPlugins.push(loaded);

    if (loaded.loaded) {
      // Register surfaces
      if (manifest.cli?.command) {
        cliRegistry.set(manifest.cli.command, loaded);
        // Register aliases
        if (manifest.cli.aliases) {
          for (const alias of manifest.cli.aliases) {
            cliRegistry.set(alias, loaded);
          }
        }
      }
      if (manifest.api?.path) {
        apiRegistry.set(manifest.api.path, loaded);
      }
      if (manifest.hooks?.on) {
        for (const event of manifest.hooks.on) {
          if (!hookRegistry.has(event)) hookRegistry.set(event, []);
          hookRegistry.get(event)!.push(loaded);
        }
      }

      console.log(`  ✅ [${String(manifest.weight).padStart(2, "0")}] ${manifest.name} v${manifest.version}`);
    } else {
      console.error(`  ❌ ${manifest.name}: ${loaded.error}`);
    }
  }

  console.log(`📦 Loaded ${loadedPlugins.filter(p => p.loaded).length}/${loadedPlugins.length} plugins`);
  return loadedPlugins;
}

async function loadOnePlugin(dir: string, manifest: PluginManifest): Promise<LoadedPlugin> {
  const entryPath = join(dir, manifest.entry);

  if (!existsSync(entryPath)) {
    return { manifest, handler: async () => ({ ok: false, error: "entry not found" }), dir, loaded: false, error: `Entry file not found: ${manifest.entry}` };
  }

  try {
    // Dynamic import
    const mod = await import(entryPath);
    const handler: PluginHandler = mod.default?.handler || mod.default || mod.handler;

    if (typeof handler !== "function") {
      return { manifest, handler: async () => ({ ok: false, error: "no handler" }), dir, loaded: false, error: "No handler function exported" };
    }

    return { manifest, handler, dir, loaded: true };
  } catch (e: any) {
    return { manifest, handler: async () => ({ ok: false, error: e.message }), dir, loaded: false, error: e.message };
  }
}

/**
 * Execute a CLI command through plugins
 */
export async function executePluginCLI(command: string, args: string[]): Promise<{ handled: boolean; result?: any }> {
  const plugin = cliRegistry.get(command);
  if (!plugin) return { handled: false };

  try {
    const result = await plugin.handler({ source: "cli", args });
    return { handled: true, result };
  } catch (e: any) {
    return { handled: true, result: { ok: false, error: e.message } };
  }
}

/**
 * Execute an API request through plugins
 */
export async function executePluginAPI(path: string, body: Record<string, unknown>): Promise<{ handled: boolean; result?: any }> {
  const plugin = apiRegistry.get(path);
  if (!plugin) return { handled: false };

  try {
    const result = await plugin.handler({ source: "api", args: body });
    return { handled: true, result };
  } catch (e: any) {
    return { handled: true, result: { ok: false, error: e.message } };
  }
}

/**
 * Fire hooks for an event
 */
export async function fireHooks(event: string, data: any): Promise<void> {
  const plugins = hookRegistry.get(event) || [];
  for (const plugin of plugins) {
    try {
      await plugin.handler({ source: "hook", args: { event, data } });
    } catch {}
  }
}

/**
 * Get list of all loaded plugins
 */
export function getPlugins(): LoadedPlugin[] {
  return loadedPlugins;
}

/**
 * Get plugin count
 */
export function getPluginCount(): { total: number; loaded: number; failed: number } {
  return {
    total: loadedPlugins.length,
    loaded: loadedPlugins.filter(p => p.loaded).length,
    failed: loadedPlugins.filter(p => !p.loaded).length,
  };
}

/**
 * Get CLI registry (for command help)
 */
export function getCLICommands(): Map<string, LoadedPlugin> {
  return cliRegistry;
}

/**
 * Get API registry
 */
export function getAPIRoutes(): Map<string, LoadedPlugin> {
  return apiRegistry;
}
