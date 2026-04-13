/**
 * Plugin System Types — inspired by maw-js plugin architecture
 *
 * One handler, three surfaces: cli / api / hook
 * Weight-based loading order: 00 (core) → 90 (custom)
 */

/** Where the plugin was invoked from */
export type PluginSource = "cli" | "api" | "hook" | "peer";

/** Plugin invocation context */
export interface InvokeContext {
  /** How this plugin was invoked */
  source: PluginSource;
  /** Arguments (cli: string[], api: object, hook: event) */
  args: string[] | Record<string, unknown> | any;
  /** Session ID */
  sessionId?: string;
  /** Raw request (for api) */
  request?: any;
}

/** Plugin return value */
export interface InvokeResult {
  ok: boolean;
  output?: string;
  error?: string;
  data?: any;
  /** HTTP status code (for api surface) */
  statusCode?: number;
}

/** Plugin CLI surface config */
export interface PluginCLISurface {
  command: string;
  aliases?: string[];
  help: string;
  flags?: Record<string, string>;
}

/** Plugin API surface config */
export interface PluginAPISurface {
  path: string;
  methods: string[];
}

/** Plugin hooks surface config */
export interface PluginHooksSurface {
  on?: string[];
}

/** Plugin transport surface config */
export interface PluginTransportSurface {
  peer?: boolean;
}

/** Plugin cron surface config */
export interface PluginCronSurface {
  schedule: string;
  prompt?: string;
  requireIdle?: boolean;
}

/** Plugin manifest (plugin.json) */
export interface PluginManifest {
  name: string;
  version: string;
  /** Loading order: 0=core, 10=infra, 20=tools, 50=features, 90=custom */
  weight: number;
  entry: string;
  sdk?: string;
  description?: string;
  author?: string;
  /** Surface declarations */
  cli?: PluginCLISurface;
  api?: PluginAPISurface;
  hooks?: PluginHooksSurface;
  transport?: PluginTransportSurface;
  cron?: PluginCronSurface;
}

/** Plugin handler function */
export type PluginHandler = (ctx: InvokeContext) => Promise<InvokeResult> | InvokeResult;

/** Loaded plugin */
export interface LoadedPlugin {
  manifest: PluginManifest;
  handler: PluginHandler;
  dir: string;
  loaded: boolean;
  error?: string;
}

/** Plugin hooks (optional lifecycle) */
export interface PluginHooks {
  onGate?(event: any): boolean;
  onFilter?(event: any): any;
  onEvent?(event: any): void;
  onLate?(event: any): void;
}

/** Plugin definition (used with definePlugin) */
export interface PluginDefinition {
  name: string;
  handler: PluginHandler;
  hooks?: PluginHooks;
}
