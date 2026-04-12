/**
 * Plugin System — Extensible hook-based plugins
 * Inspired by maw-js plugin system
 *
 * Plugins can hook into: agent_spawn, agent_message, task_create,
 * memory_write, feed_event, shutdown
 */

import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

export class PluginSystem {
  constructor() {
    this.plugins = new Map();
    this.hooks = {};
    this.hookNames = [
      'agent_spawn', 'agent_message', 'agent_status',
      'task_create', 'task_update', 'task_complete',
      'memory_write', 'memory_search',
      'feed_event',
      'team_create', 'team_broadcast',
      'session_start', 'session_end',
      'federation_connect', 'federation_message',
      'shutdown', 'startup'
    ];
    for (const name of this.hookNames) {
      this.hooks[name] = [];
    }
  }

  /**
   * Register a plugin
   */
  register(name, plugin) {
    this.plugins.set(name, plugin);

    // Register hooks
    if (plugin.hooks) {
      for (const [hookName, handler] of Object.entries(plugin.hooks)) {
        if (this.hooks[hookName]) {
          this.hooks[hookName].push({ plugin: name, handler });
        }
      }
    }

    // Call init if present
    if (plugin.init) {
      plugin.init(this);
    }

    return this;
  }

  /**
   * Run all handlers for a hook
   */
  async runHook(hookName, context = {}) {
    const handlers = this.hooks[hookName] || [];
    const results = [];

    for (const { plugin, handler } of handlers) {
      try {
        const result = await handler(context);
        results.push({ plugin, ok: true, result });
      } catch (err) {
        results.push({ plugin, ok: false, error: err.message });
      }
    }

    return results;
  }

  /**
   * Load plugins from a directory
   */
  async loadFromDir(dir) {
    try {
      const files = await readdir(dir);
      const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.mjs'));

      for (const file of jsFiles) {
        try {
          const filePath = resolve(dir, file);
          const mod = await import(pathToFileURL(filePath).href);
          const plugin = mod.default || mod;
          const name = plugin.name || file.replace(/\.(js|mjs)$/, '');
          this.register(name, plugin);
          console.log(`[plugins] Loaded: ${name}`);
        } catch (err) {
          console.error(`[plugins] Failed to load ${file}:`, err.message);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('[plugins] Error loading dir:', err.message);
      }
    }
  }

  /**
   * List loaded plugins
   */
  list() {
    return [...this.plugins.entries()].map(([name, plugin]) => ({
      name,
      hooks: Object.keys(plugin.hooks || {}),
      hasInit: !!plugin.init
    }));
  }

  /**
   * Unregister a plugin
   */
  unregister(name) {
    this.plugins.delete(name);
    for (const hookName of this.hookNames) {
      this.hooks[hookName] = this.hooks[hookName].filter(h => h.plugin !== name);
    }
  }

  /**
   * Shutdown all plugins
   */
  async shutdown() {
    for (const [name, plugin] of this.plugins) {
      if (plugin.shutdown) {
        try { await plugin.shutdown(); } catch {}
      }
    }
  }
}

// === Built-in Plugins ===

/**
 * Logger Plugin — logs all events
 */
export const loggerPlugin = {
  name: 'logger',
  hooks: {
    feed_event: async (ctx) => {
      const { event } = ctx;
      if (event.type !== 'agent_status') { // Skip noisy status updates
        console.log(`[feed] ${event.type}: ${event.agent || event.teamId || event.sessionId || ''}`);
      }
    },
    agent_spawn: async (ctx) => {
      console.log(`[agent] Spawned: ${ctx.agentId} (${ctx.role})`);
    },
    shutdown: async () => {
      console.log('[plugins] Logger shutting down');
    }
  }
};

/**
 * Stats Plugin — tracks aggregate statistics
 */
export const statsPlugin = {
  name: 'stats',
  data: { messages: 0, spawns: 0, tasks: 0, errors: 0 },

  hooks: {
    agent_message: async (ctx) => {
      statsPlugin.data.messages++;
    },
    agent_spawn: async (ctx) => {
      statsPlugin.data.spawns++;
    },
    task_create: async (ctx) => {
      statsPlugin.data.tasks++;
    }
  },

  getStats() {
    return { ...this.data };
  }
};
