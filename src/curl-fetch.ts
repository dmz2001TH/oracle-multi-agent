import { signHeaders } from "./lib/federation-auth.js";
import { loadConfig } from "./config.js";

export interface CurlResponse { ok: boolean; status: number; data: any; }

export async function curlFetch(url: string, opts?: { method?: string; body?: string; timeout?: number }): Promise<CurlResponse> {
  const headers: Record<string, string> = {};
  if (opts?.body) headers["Content-Type"] = "application/json";
  try {
    const token = loadConfig().federationToken;
    if (token) {
      const urlObj = new URL(url);
      Object.assign(headers, signHeaders(token, opts?.method || "GET", urlObj.pathname));
    }
  } catch {}
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts?.timeout || 10000);
    const res = await fetch(url, { method: opts?.method || "GET", headers, body: opts?.body, signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    return { ok: res.ok, status: res.status, data };
  } catch { return { ok: false, status: 0, data: null }; }
}
