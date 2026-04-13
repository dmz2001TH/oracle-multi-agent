/**
 * Nanoclaw bridge — sends messages through nanoclaw to Telegram/Discord/etc.
 */

import { loadConfig } from "../config.js";
import { curlFetch } from "../curl-fetch.js";

interface NanoclawConfig { url: string; channels: Record<string, string>; }

export function resolveNanoclawJid(target: string): { jid: string; url: string } | null {
  const nc = (loadConfig() as any).nanoclaw as NanoclawConfig | undefined;
  if (!nc?.url) return null;
  if (/^(tg|dc|sl|wa|gm|mx):/.test(target)) return { jid: target, url: nc.url };
  if (target.includes(":")) { const [, alias] = target.split(":", 2); const jid = nc.channels?.[alias]; if (jid) return { jid, url: nc.url }; }
  const jid = nc.channels?.[target];
  if (jid) return { jid, url: nc.url };
  return null;
}

export async function sendViaNanoclaw(jid: string, text: string, url: string): Promise<boolean> {
  try { const res = await curlFetch(`${url}/send`, { method: "POST", body: JSON.stringify({ jid, text }) }); return res.ok && res.data?.ok; }
  catch { return false; }
}
