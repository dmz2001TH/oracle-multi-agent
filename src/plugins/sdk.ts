/**
 * Plugin SDK — definePlugin() helper + utilities
 *
 * Inspired by maw-js SDK. One function, three surfaces.
 */

import type { PluginDefinition, PluginHandler, InvokeContext, InvokeResult } from "./types.js";

/**
 * Define a plugin with type-safe handler
 *
 * Usage:
 * ```ts
 * import { definePlugin } from "../plugins/sdk.js";
 *
 * export default definePlugin({
 *   name: "my-plugin",
 *   async handler(ctx) {
 *     if (ctx.source === "cli") {
 *       return { ok: true, output: "Hello from CLI!" };
 *     }
 *     if (ctx.source === "api") {
 *       return { ok: true, data: { message: "Hello from API!" } };
 *     }
 *     return { ok: true, output: "Hello!" };
 *   },
 * });
 * ```
 */
export function definePlugin(def: PluginDefinition): PluginDefinition {
  return def;
}

/**
 * Create a simple CLI-only plugin
 */
export function cliPlugin(name: string, handler: (args: string[]) => string): PluginDefinition {
  return {
    name,
    async handler(ctx: InvokeContext): Promise<InvokeResult> {
      if (ctx.source === "cli") {
        const args = Array.isArray(ctx.args) ? ctx.args : [];
        return { ok: true, output: handler(args) };
      }
      return { ok: false, error: `${name}: only supports CLI surface` };
    },
  };
}

/**
 * Create a simple API-only plugin
 */
export function apiPlugin(name: string, handler: (body: Record<string, unknown>) => any): PluginDefinition {
  return {
    name,
    async handler(ctx: InvokeContext): Promise<InvokeResult> {
      if (ctx.source === "api") {
        const body = (ctx.args || {}) as Record<string, unknown>;
        return { ok: true, data: handler(body) };
      }
      return { ok: false, error: `${name}: only supports API surface` };
    },
  };
}

/**
 * Capture console.log output while running a function
 */
export async function captureOutput(fn: () => void | Promise<void>): Promise<string> {
  const logs: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (...a: any[]) => logs.push(a.map(String).join(" "));
  console.error = (...a: any[]) => logs.push(a.map(String).join(" "));
  try {
    await fn();
    return logs.join("\n");
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}
