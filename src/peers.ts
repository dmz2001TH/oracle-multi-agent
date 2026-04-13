import { loadConfig, cfgTimeout } from "./config.js";
import type { Session } from "./ssh.js";

let aggregatedCache: { peers: (Session & { source?: string })[]; ts: number } | null = null;
const CACHE_TTL = 30_000;
const CLOCK_WARN_MS = 3 * 60 * 1000;

export interface PeerStatus {
  url: string; reachable: boolean; latency?: number;
  node?: string; agents?: string[]; clockDeltaMs?: number; clockWarning?: boolean;
}

async function checkPeerReachable(url: string): Promise<{ reachable: boolean; latency: number; node?: string; agents?: string[]; clockDeltaMs?: number }> {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), cfgTimeout("http"));
    const res = await fetch(`${url}/api/sessions`, { signal: ctrl.signal });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    let node: string | undefined; let agents: string[] | undefined; let clockDeltaMs: number | undefined;
    try {
      const res2 = await fetch(`${url}/api/identity`, { signal: ctrl.signal });
      const id = await res2.json();
      node = id.node; agents = id.agents;
      if (id.clockUtc) { const peerTime = new Date(id.clockUtc).getTime(); clockDeltaMs = peerTime - Date.now(); }
    } catch {}
    return { reachable: res.ok, latency, node, agents, clockDeltaMs };
  } catch { return { reachable: false, latency: Date.now() - start }; }
}

export function getPeers(): string[] {
  const config = loadConfig();
  const flat = config.peers ?? [];
  const named = (config.namedPeers ?? []).map(p => p.url);
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const url of [...flat, ...named]) { if (!seen.has(url)) { seen.add(url); merged.push(url); } }
  return merged;
}

export async function getAggregatedSessions(localSessions: Session[]): Promise<(Session & { source?: string })[]> {
  const peers = getPeers();
  if (peers.length === 0) return localSessions;
  const local = localSessions.map(s => ({ ...s, source: "local" }));
  if (aggregatedCache && Date.now() - aggregatedCache.ts < CACHE_TTL) return [...local, ...aggregatedCache.peers];
  const peerResults = await Promise.all(peers.map(async (url) => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), cfgTimeout("http"));
      const res = await fetch(`${url}/api/sessions?local=true`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return [];
      const sessions = await res.json();
      return (sessions as Session[]).map(s => ({ ...s, source: url }));
    } catch { return []; }
  }));
  const seen = new Set<string>();
  const peerSessions = peerResults.flat().filter(s => { const key = `${s.source}:${s.name}`; if (seen.has(key)) return false; seen.add(key); return true; });
  aggregatedCache = { peers: peerSessions, ts: Date.now() };
  return [...local, ...peerSessions];
}

export async function getFederationStatus(): Promise<{
  localUrl: string; peers: PeerStatus[]; totalPeers: number; reachablePeers: number;
  clockHealth: { clockUtc: string; timezone: string; uptimeSeconds: number };
}> {
  const config = loadConfig();
  const peers = getPeers();
  const localUrl = `http://localhost:${config.port}`;
  const rawStatuses = await Promise.all(peers.map(async (url) => {
    const { reachable, latency, node, agents, clockDeltaMs } = await checkPeerReachable(url);
    return { url, reachable, latency, node, agents, clockDeltaMs };
  }));
  const byNode = new Map<string, PeerStatus>();
  for (const s of rawStatuses) {
    const key = s.node || s.url;
    const existing = byNode.get(key);
    if (!existing || (s.reachable && (!existing.reachable || (s.latency ?? Infinity) < (existing.latency ?? Infinity)))) {
      byNode.set(key, { ...s, clockWarning: s.clockDeltaMs != null ? Math.abs(s.clockDeltaMs) > CLOCK_WARN_MS : undefined });
    }
  }
  const statuses = [...byNode.values()];
  return { localUrl, peers: statuses, totalPeers: peers.length, reachablePeers: statuses.filter(s => s.reachable).length, clockHealth: { clockUtc: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, uptimeSeconds: Math.floor(process.uptime()) } };
}
