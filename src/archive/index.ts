/**
 * Session-End Archival — Save Before the Window Fills
 * Auto-archives agent state when session ends or context is about to fill.
 * Based on: Agents That Remember Chapter 6 — Session-End Archival
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, appendFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const ARCHIVE_ROOT = join(homedir(), ".oracle", "archive");
const ORACLE_DIR = join(homedir(), ".oracle");

export interface ArchiveEntry {
  id: string;
  agentName: string;
  agentRole: string;
  archivedAt: string;
  reason: "session-end" | "context-full" | "manual" | "crash" | "sleep";
  files: ArchivedFile[];
  metadata: {
    tokenCount?: number;
    uptime?: number;
    messageCount?: number;
    commandsRun?: string[];
  };
}

export interface ArchivedFile {
  path: string;
  type: "journal" | "memory" | "config" | "handoff" | "fyi" | "other";
  size: number;
  preview: string;
}

function ensureDir() { mkdirSync(ARCHIVE_ROOT, { recursive: true }); }
function agentArchiveDir(agentName: string) { return join(ARCHIVE_ROOT, agentName); }
function manifestFile(agentName: string) { return join(agentArchiveDir(agentName), "manifest.jsonl"); }

/**
 * Archive all state for an agent at session end.
 * This is the "save game" — everything important gets captured.
 */
export function archiveSession(
  agentName: string,
  agentRole: string,
  reason: ArchiveEntry["reason"],
  metadata: ArchiveEntry["metadata"] = {}
): ArchiveEntry {
  ensureDir();
  const dir = agentArchiveDir(agentName);
  mkdirSync(dir, { recursive: true });

  const archiveId = `${new Date().toISOString().split("T")[0]}-${Date.now().toString(36)}`;
  const sessionDir = join(dir, archiveId);
  mkdirSync(sessionDir, { recursive: true });

  const files: ArchivedFile[] = [];

  // Archive ~/.oracle files
  const dirsToArchive = [
    { src: join(ORACLE_DIR, "memory"), type: "memory" as const },
    { src: join(ORACLE_DIR, "journal"), type: "journal" as const },
    { src: join(ORACLE_DIR, "inbox"), type: "handoff" as const },
  ];

  for (const { src, type } of dirsToArchive) {
    if (!existsSync(src)) continue;
    try {
      const items = readdirSync(src);
      for (const item of items) {
        const itemPath = join(src, item);
        try {
          const content = readFileSync(itemPath, "utf-8");
          const destPath = join(sessionDir, `${type}_${item}`);
          writeFileSync(destPath, content);
          files.push({
            path: itemPath, type, size: content.length,
            preview: content.substring(0, 200),
          });
        } catch {}
      }
    } catch {}
  }

  // Archive ψ/ files if they exist
  const psiRoots = [join(process.cwd(), "ψ")];
  for (const psiRoot of psiRoots) {
    if (!existsSync(psiRoot)) continue;
    try {
      const walkAndArchive = (dir: string, prefix: string) => {
        const items = readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = join(dir, item.name);
          if (item.isDirectory()) {
            walkAndArchive(fullPath, `${prefix}${item.name}_`);
          } else if (item.isFile()) {
            try {
              const content = readFileSync(fullPath, "utf-8");
              const destPath = join(sessionDir, `psi_${prefix}${item.name}`);
              writeFileSync(destPath, content);
              files.push({ path: fullPath, type: "memory", size: content.length, preview: content.substring(0, 200) });
            } catch {}
          }
        }
      };
      walkAndArchive(psiRoot, "");
    } catch {}
  }

  const entry: ArchiveEntry = {
    id: archiveId, agentName, agentRole,
    archivedAt: new Date().toISOString(), reason, files,
    metadata: { ...metadata, uptime: process.uptime() },
  };

  // Write manifest
  appendFileSync(manifestFile(agentName), JSON.stringify(entry) + "\n");

  // Write entry details
  writeFileSync(join(sessionDir, "archive-entry.json"), JSON.stringify(entry, null, 2));

  return entry;
}

/**
 * List all archives for an agent.
 */
export function listArchives(agentName: string): ArchiveEntry[] {
  const f = manifestFile(agentName);
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf-8").split("\n").filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

/**
 * Get a specific archive entry.
 */
export function getArchive(agentName: string, archiveId: string): ArchiveEntry | null {
  return listArchives(agentName).find(a => a.id === archiveId) || null;
}

/**
 * Restore files from an archive to a target directory.
 */
export function restoreArchive(agentName: string, archiveId: string, targetDir: string): string[] {
  const archive = getArchive(agentName, archiveId);
  if (!archive) return [];

  const sourceDir = join(agentArchiveDir(agentName), archiveId);
  if (!existsSync(sourceDir)) return [];

  mkdirSync(targetDir, { recursive: true });
  const restored: string[] = [];

  try {
    const files = readdirSync(sourceDir);
    for (const file of files) {
      if (file === "archive-entry.json") continue;
      const src = join(sourceDir, file);
      const dest = join(targetDir, file);
      copyFileSync(src, dest);
      restored.push(file);
    }
  } catch {}

  return restored;
}

/**
 * Get archive stats across all agents.
 */
export function getArchiveStats(): { agents: number; totalArchives: number; totalFiles: number; totalSize: number } {
  if (!existsSync(ARCHIVE_ROOT)) return { agents: 0, totalArchives: 0, totalFiles: 0, totalSize: 0 };

  const agents = readdirSync(ARCHIVE_ROOT).filter(f => {
    try { return readdirSync(join(ARCHIVE_ROOT, f)).length > 0; } catch { return false; }
  });

  let totalArchives = 0;
  let totalFiles = 0;
  let totalSize = 0;

  for (const agent of agents) {
    const archives = listArchives(agent);
    totalArchives += archives.length;
    for (const a of archives) {
      totalFiles += a.files.length;
      totalSize += a.files.reduce((sum, f) => sum + f.size, 0);
    }
  }

  return { agents: agents.length, totalArchives, totalFiles, totalSize };
}
