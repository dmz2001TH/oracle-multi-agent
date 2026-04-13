import type { FeedEvent, FeedEventType } from "./lib/feed.js";
import { readdirSync, watch, existsSync } from "fs";
import { join } from "path";

type Gate = (event: Readonly<FeedEvent>) => boolean;
type Filter = (event: FeedEvent) => FeedEvent;
type Handler = (event: Readonly<FeedEvent>) => void | Promise<void>;
type Late = (event: Readonly<FeedEvent>) => void;
export type MawPlugin = (hooks: MawHooks) => void | (() => void);
export type PluginScope = "builtin" | "user";

interface Scoped<T> { fn: T; scope: PluginScope; }

export interface MawHooks {
  gate(event: FeedEventType | "*", fn: Gate): void;
  filter(event: FeedEventType | "*", fn: Filter): void;
  on(event: FeedEventType | "*", fn: Handler): void;
  late(event: FeedEventType | "*", fn: Late): void;
}

export interface PluginInfo {
  name: string; type: "ts" | "js" | "wasm" | "unknown";
  source: PluginScope; loadedAt: string; events: number; errors: number;
  lastEvent?: string; lastError?: string;
}

export class PluginSystem {
  private gates = new Map<string, Scoped<Gate>[]>();
  private filters = new Map<string, Scoped<Filter>[]>();
  private handlers = new Map<string, Scoped<Handler>[]>();
  private lates = new Map<string, Scoped<Late>[]>();
  private teardowns: Scoped<() => void>[] = [];
  private _plugins: PluginInfo[] = [];
  private _totalEvents = 0;
  private _totalErrors = 0;
  private _gated = 0;
  private _startedAt = new Date().toISOString();
  private _currentScope: PluginScope = "user";
  private _reloads = 0;
  private _lastReloadAt?: string;

  private _addTo<T>(map: Map<string, Scoped<T>[]>, event: string, fn: T) {
    const entry: Scoped<T> = { fn, scope: this._currentScope };
    const list = map.get(event);
    if (list) list.push(entry); else map.set(event, [entry]);
  }

  readonly hooks: MawHooks = {
    gate: (event, fn) => this._addTo(this.gates, event, fn),
    filter: (event, fn) => this._addTo(this.filters, event, fn),
    on: (event, fn) => this._addTo(this.handlers, event, fn),
    late: (event, fn) => this._addTo(this.lates, event, fn),
  };

  async emit(event: FeedEvent): Promise<boolean> {
    this._totalEvents++;
    const frozen = Object.freeze({ ...event });
    for (const { fn } of this.gates.get(event.event) ?? []) {
      try { if (fn(frozen) === false) { this._gated++; return false; } }
      catch (err) { this._totalErrors++; console.error(`[plugin:gate] ${event.event}:`, (err as Error).message); }
    }
    for (const { fn } of this.gates.get("*") ?? []) {
      try { if (fn(frozen) === false) { this._gated++; return false; } }
      catch (err) { this._totalErrors++; console.error(`[plugin:gate] *:`, (err as Error).message); }
    }
    for (const { fn } of this.filters.get(event.event) ?? []) {
      try { event = fn(event); } catch (err) { this._totalErrors++; console.error(`[plugin:filter] ${event.event}:`, (err as Error).message); }
    }
    for (const { fn } of this.filters.get("*") ?? []) {
      try { event = fn(event); } catch (err) { this._totalErrors++; console.error(`[plugin:filter] *:`, (err as Error).message); }
    }
    const readOnly = Object.freeze({ ...event });
    for (const { fn } of this.handlers.get(event.event) ?? []) {
      try { await fn(readOnly); } catch (err) { this._totalErrors++; console.error(`[plugin] ${event.event}:`, (err as Error).message); }
    }
    for (const { fn } of this.handlers.get("*") ?? []) {
      try { await fn(readOnly); } catch (err) { this._totalErrors++; console.error(`[plugin] *:`, (err as Error).message); }
    }
    for (const { fn } of this.lates.get(event.event) ?? []) {
      try { fn(readOnly); } catch (err) { this._totalErrors++; console.error(`[plugin:late] ${event.event}:`, (err as Error).message); }
    }
    for (const { fn } of this.lates.get("*") ?? []) {
      try { fn(readOnly); } catch (err) { this._totalErrors++; console.error(`[plugin:late] *:`, (err as Error).message); }
    }
    return true;
  }

  load(plugin: MawPlugin, scope: PluginScope = "user") {
    const prev = this._currentScope;
    this._currentScope = scope;
    try { const teardown = plugin(this.hooks); if (typeof teardown === "function") this.teardowns.push({ fn: teardown, scope }); }
    finally { this._currentScope = prev; }
  }

  register(name: string, type: PluginInfo["type"], source: PluginScope = "user") {
    this._plugins.push({ name, type, source, loadedAt: new Date().toISOString(), events: 0, errors: 0 });
  }

  unloadScope(scope: PluginScope) {
    const keep: Scoped<() => void>[] = [];
    for (const t of this.teardowns) {
      if (t.scope === scope) try { t.fn(); } catch {} else keep.push(t);
    }
    this.teardowns = keep;
    const clean = <T>(map: Map<string, Scoped<T>[]>) => {
      for (const [key, list] of map) {
        const kept = list.filter((e) => e.scope !== scope);
        if (kept.length === 0) map.delete(key); else map.set(key, kept);
      }
    };
    clean(this.gates); clean(this.filters); clean(this.handlers); clean(this.lates);
    this._plugins = this._plugins.filter((p) => p.source !== scope);
  }

  _markReloaded() { this._reloads++; this._lastReloadAt = new Date().toISOString(); }

  stats() {
    const countScoped = <T>(map: Map<string, Scoped<T>[]>) => Object.fromEntries([...map].map(([k, v]) => [k, v.length]));
    return { startedAt: this._startedAt, plugins: this._plugins, totalEvents: this._totalEvents, totalErrors: this._totalErrors, gated: this._gated, reloads: this._reloads, lastReloadAt: this._lastReloadAt, gates: countScoped(this.gates), filters: countScoped(this.filters), handlers: countScoped(this.handlers), lates: countScoped(this.lates) };
  }

  destroy() { for (const t of this.teardowns) try { t.fn(); } catch {} this.teardowns = []; }
}

export async function loadPlugins(system: PluginSystem, dir: string, source: PluginScope = "user", cacheBust = false) {
  let files: string[];
  try { files = readdirSync(dir).filter((f: string) => f.endsWith(".ts") || f.endsWith(".js") || f.endsWith(".wasm")); }
  catch { return; }
  for (const file of files) {
    const path = join(dir, file);
    try {
      const spec = cacheBust ? `${path}?t=${Date.now()}` : path;
      const mod = await import(spec);
      const plugin = mod.default ?? mod;
      if (typeof plugin === "function") { system.load(plugin, source); system.register(file, file.endsWith(".ts") ? "ts" : "js", source); console.log(`[plugin] loaded: ${file} (${source})`); }
    } catch (err) { console.error(`[plugin] failed to load ${file}:`, (err as Error).message); }
  }
}

export async function reloadUserPlugins(system: PluginSystem, dir: string) {
  system.unloadScope("user");
  await loadPlugins(system, dir, "user", true);
  system._markReloaded();
}

export function watchUserPlugins(dir: string, onReload: (changedFile: string) => void | Promise<void>, debounceMs = 200): () => void {
  if (process.env.ORACLE_HOT_RELOAD === "0") return () => {};
  if (!existsSync(dir)) return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastChanged = "";
  try {
    watch(dir, { persistent: false }, (_eventType: string, filename: string | null) => {
      if (!filename || !(filename.endsWith(".ts") || filename.endsWith(".js") || filename.endsWith(".wasm"))) return;
      lastChanged = filename;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; Promise.resolve(onReload(lastChanged)).catch(console.error); }, debounceMs);
    });
  } catch { return () => {}; }
  return () => { if (timer) clearTimeout(timer); };
}
