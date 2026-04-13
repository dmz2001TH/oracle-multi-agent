/**
 * Vault API — ψ/ knowledge root scanner + stats
 */

import { Hono } from "hono";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const vaultApi = new Hono();

const PSI_ROOT = join(process.cwd(), "ψ");

// GET /api/vault/stats — ψ/ directory statistics
vaultApi.get("/api/vault/stats", (c) => {
  const stats = scanPsiDir(PSI_ROOT);
  return c.json({ ok: true, ...stats });
});

// GET /api/vault/files — list ψ/ files with optional filter
vaultApi.get("/api/vault/files", (c) => {
  const subdir = c.req.query("dir") || "";
  const targetDir = subdir ? join(PSI_ROOT, subdir) : PSI_ROOT;

  if (!existsSync(targetDir)) {
    return c.json({ ok: false, error: "Directory not found" }, 404);
  }

  const files = listFilesRecursive(targetDir, PSI_ROOT);
  return c.json({ ok: true, count: files.length, files });
});

// GET /api/vault/file — read a specific ψ/ file
vaultApi.get("/api/vault/file", (c) => {
  const path = c.req.query("path");
  if (!path) return c.json({ ok: false, error: "path required" }, 400);

  const fullPath = join(PSI_ROOT, path);

  // Security: prevent path traversal
  if (!fullPath.startsWith(PSI_ROOT)) {
    return c.json({ ok: false, error: "Access denied" }, 403);
  }

  if (!existsSync(fullPath)) {
    return c.json({ ok: false, error: "File not found" }, 404);
  }

  try {
    const content = readFileSync(fullPath, "utf-8");
    const stat = statSync(fullPath);
    return c.json({
      ok: true,
      path,
      content,
      size: stat.size,
      modified: stat.mtime.toISOString(),
    });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// POST /api/vault/search — search across ψ/ files
vaultApi.post("/api/vault/search", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const query = (body.query || "").toLowerCase();

  if (!query) return c.json({ ok: false, error: "query required" }, 400);

  const results: { file: string; line: string; lineNumber: number }[] = [];
  searchInDir(PSI_ROOT, query, PSI_ROOT, results);

  return c.json({
    ok: true,
    query: body.query,
    count: results.length,
    results: results.slice(0, 50),
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function scanPsiDir(root: string): {
  exists: boolean;
  totalFiles: number;
  totalSize: number;
  directories: { name: string; files: number; size: number }[];
  recentFiles: { path: string; modified: string; size: number }[];
} {
  if (!existsSync(root)) {
    return { exists: false, totalFiles: 0, totalSize: 0, directories: [], recentFiles: [] };
  }

  let totalFiles = 0;
  let totalSize = 0;
  const dirStats: Map<string, { files: number; size: number }> = new Map();
  const allFiles: { path: string; modified: Date; size: number }[] = [];

  function walk(dir: string, relPath: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        const rel = join(relPath, entry.name);
        if (entry.isDirectory()) {
          walk(full, rel);
        } else if (entry.isFile()) {
          const stat = statSync(full);
          totalFiles++;
          totalSize += stat.size;

          const topDir = rel.split("/")[0] || rel;
          const d = dirStats.get(topDir) || { files: 0, size: 0 };
          d.files++;
          d.size += stat.size;
          dirStats.set(topDir, d);

          allFiles.push({ path: rel, modified: stat.mtime, size: stat.size });
        }
      }
    } catch {}
  }

  walk(root, "");

  allFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());

  const directories = Array.from(dirStats.entries()).map(([name, s]) => ({
    name,
    files: s.files,
    size: s.size,
  }));

  return {
    exists: true,
    totalFiles,
    totalSize,
    directories,
    recentFiles: allFiles.slice(0, 10).map((f) => ({
      path: f.path,
      modified: f.modified.toISOString(),
      size: f.size,
    })),
  };
}

function listFilesRecursive(dir: string, basePath: string): { path: string; size: number; modified: string }[] {
  const files: { path: string; size: number; modified: string }[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = full.replace(basePath + "/", "");
      if (entry.isDirectory()) {
        files.push(...listFilesRecursive(full, basePath));
      } else if (entry.isFile()) {
        const stat = statSync(full);
        files.push({ path: rel, size: stat.size, modified: stat.mtime.toISOString() });
      }
    }
  } catch {}
  return files;
}

function searchInDir(
  dir: string,
  query: string,
  basePath: string,
  results: { file: string; line: string; lineNumber: number }[]
) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        searchInDir(full, query, basePath, results);
      } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".json") || entry.name.endsWith(".jsonl"))) {
        try {
          const content = readFileSync(full, "utf-8");
          const lines = content.split("\n");
          const rel = full.replace(basePath + "/", "");
          lines.forEach((line, idx) => {
            if (line.toLowerCase().includes(query)) {
              results.push({ file: rel, line: line.trim().substring(0, 200), lineNumber: idx + 1 });
            }
          });
        } catch {}
      }
    }
  } catch {}
}
