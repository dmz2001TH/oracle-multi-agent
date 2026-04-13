/**
 * Federation Auth — HMAC-SHA256 request signing for peer-to-peer trust.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { MiddlewareHandler } from "hono";
import { loadConfig } from "../config.js";

const WINDOW_SEC = 300;

const PROTECTED = new Set([
  "/api/send", "/api/talk", "/api/transport/send",
  "/api/triggers/fire", "/api/worktrees/cleanup",
]);

const PROTECTED_POST = new Set(["/api/feed"]);

export function sign(token: string, method: string, path: string, timestamp: number): string {
  const payload = `${method}:${path}:${timestamp}`;
  return createHmac("sha256", token).update(payload).digest("hex");
}

export function verify(token: string, method: string, path: string, timestamp: number, signature: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > WINDOW_SEC) return false;
  const expected = sign(token, method, path, timestamp);
  if (expected.length !== signature.length) return false;
  try { return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex")); }
  catch { return false; }
}

export function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1"
    || address === "localhost" || address.startsWith("127.");
}

export function signHeaders(token: string, method: string, path: string): Record<string, string> {
  const ts = Math.floor(Date.now() / 1000);
  return { "X-Maw-Timestamp": String(ts), "X-Maw-Signature": sign(token, method, path, ts) };
}

function isProtected(path: string, method: string): boolean {
  if (PROTECTED.has(path)) return true;
  if (PROTECTED_POST.has(path) && method === "POST") return true;
  return false;
}

export function federationAuth(): MiddlewareHandler {
  return async (c, next) => {
    const config = loadConfig();
    const token = config.federationToken;
    if (!token) return next();
    const url = new URL(c.req.url);
    const path = url.pathname;
    if (!isProtected(path, c.req.method)) return next();
    const clientIp = (c.env as any)?.server?.requestIP?.(c.req.raw)?.address;
    if (isLoopback(clientIp)) return next();
    const sig = c.req.header("x-maw-signature");
    const ts = c.req.header("x-maw-timestamp");
    if (!sig || !ts) return c.json({ error: "federation auth required", reason: "missing_signature" }, 401);
    const timestamp = parseInt(ts, 10);
    if (isNaN(timestamp)) return c.json({ error: "federation auth failed", reason: "invalid_timestamp" }, 401);
    if (!verify(token, c.req.method, path, timestamp, sig)) {
      const delta = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
      return c.json({ error: "federation auth failed", reason: delta > WINDOW_SEC ? "timestamp_expired" : "signature_invalid" }, 401);
    }
    return next();
  };
}
