import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { CONFIG_DIR, FLEET_DIR } from "./paths.js";
import { loadConfig } from "./config.js";

export interface OracleEntry {
  org: string; repo: string; name: string; local_path: string;
  has_psi: boolean; has_fleet_config: boolean; budded_from: string | null;
  budded_at: string | null; federation_node: string | null; detected_at: string;
}

export interface RegistryCache { schema: 1; local_scanned_at: string; ghq_root: string; oracles: OracleEntry[]; }

const CACHE_FILE = join(CONFIG_DIR, "oracles.json");
const STALE_HOURS = 1;

export function readCache(): RegistryCache | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
    return raw.schema === 1 ? raw as RegistryCache : null;
  } catch { return null; }
}

export function writeCache(cache: RegistryCache): void {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + "\n", "utf-8");
}

export function isCacheStale(cache: RegistryCache | null): boolean {
  if (!cache) return true;
  return Date.now() - new Date(cache.local_scanned_at).getTime() > STALE_HOURS * 3600_000;
}

function deriveName(repo: string): string { return repo.replace(/-oracle$/, ""); }

export function scanLocal(): OracleEntry[] {
  const config = loadConfig();
  const ghqRoot = config.ghqRoot;
  const now = new Date().toISOString();
  const entries: OracleEntry[] = [];
  const seen = new Set<string>();
  try {
    for (const org of readdirSync(ghqRoot)) {
      const orgPath = join(ghqRoot, org);
      try { if (!statSync(orgPath).isDirectory()) continue; } catch { continue; }
      for (const repo of readdirSync(orgPath)) {
        const repoPath = join(orgPath, repo);
        try { if (!statSync(repoPath).isDirectory()) continue; } catch { continue; }
        const key = `${org}/${repo}`;
        const hasPsi = existsSync(join(repoPath, "ψ"));
        const endsWithOracle = repo.endsWith("-oracle");
        if (!hasPsi && !endsWithOracle) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({ org, repo, name: deriveName(repo), local_path: repoPath, has_psi: hasPsi, has_fleet_config: false, budded_from: null, budded_at: null, federation_node: config.node || null, detected_at: now });
      }
    }
  } catch {}
  return entries.sort((a, b) => a.org !== b.org ? a.org.localeCompare(b.org) : a.name.localeCompare(b.name));
}

export function scanAndCache(): RegistryCache {
  const config = loadConfig();
  const cache: RegistryCache = { schema: 1, local_scanned_at: new Date().toISOString(), ghq_root: config.ghqRoot, oracles: scanLocal() };
  writeCache(cache);
  return cache;
}

export async function scanRemote(orgs?: string[], verbose = false): Promise<OracleEntry[]> {
  const config = loadConfig();
  const targetOrgs = orgs || config.githubOrgs || ["Soul-Brews-Studio"];
  const now = new Date().toISOString();
  const entries: OracleEntry[] = [];
  for (const org of targetOrgs) {
    try {
      if (verbose) console.log(`  scanning ${org}...`);
      const out = execSync(`gh api "/orgs/${org}/repos?per_page=100&type=all" --paginate --jq '.[] | .full_name + " " + .name'`, { encoding: "utf-8", timeout: 30000 });
      for (const line of out.trim().split("\n").filter(Boolean)) {
        const [fullName, repoName] = line.split(" ");
        if (!repoName?.endsWith("-oracle")) continue;
        let hasPsi = false;
        try { execSync(`gh api "/repos/${fullName}/contents/ψ" --silent 2>/dev/null`, { timeout: 5000 }); hasPsi = true; } catch {}
        entries.push({ org, repo: repoName, name: deriveName(repoName), local_path: "", has_psi: hasPsi, has_fleet_config: false, budded_from: null, budded_at: null, federation_node: null, detected_at: now });
      }
    } catch {}
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function scanFull(orgs?: string[], verbose = false): Promise<RegistryCache> {
  const config = loadConfig();
  const localEntries = scanLocal();
  const remoteEntries = await scanRemote(orgs, verbose);
  const merged = new Map<string, OracleEntry>();
  for (const e of localEntries) merged.set(`${e.org}/${e.repo}`, e);
  for (const e of remoteEntries) { const key = `${e.org}/${e.repo}`; if (!merged.has(key)) merged.set(key, e); }
  const cache: RegistryCache = { schema: 1, local_scanned_at: new Date().toISOString(), ghq_root: config.ghqRoot, oracles: [...merged.values()].sort((a, b) => a.org !== b.org ? a.org.localeCompare(b.org) : a.name.localeCompare(b.name)) };
  writeCache(cache);
  return cache;
}
