/**
 * Hono middleware — inject shared dependencies into request context.
 */

import type { MiddlewareHandler } from "hono";
import { loadConfig, type MawConfig } from "../config.js";

let _config: MawConfig | null = null;

export function withContext(): MiddlewareHandler {
  return async (c, next) => {
    if (!_config) _config = loadConfig();
    c.set("config" as never, _config as never);
    await next();
  };
}

export function refreshContext() {
  _config = null;
}
