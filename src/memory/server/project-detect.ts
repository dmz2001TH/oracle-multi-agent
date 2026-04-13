/**
 * Project Detection — Detect project from git remote URL
 *
 * Parses .git/config or runs `git remote -v` to extract the project
 * identifier in ghq-style format (e.g., "github.com/owner/repo").
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

let _cachedProject: string | undefined | null = null;
let _cachedCwd: string | null = null;

export function detectProject(cwd?: string): string | undefined {
  const workingDir = cwd || process.cwd();

  // Return cache if same directory
  if (workingDir === _cachedCwd && _cachedProject !== null) {
    return _cachedProject;
  }

  _cachedCwd = workingDir;
  _cachedProject = _tryGitRemote(workingDir) || _tryGitConfig(workingDir) || undefined;
  return _cachedProject;
}

/** Try `git remote -v` command */
function _tryGitRemote(cwd: string): string | null {
  try {
    const output = execSync('git remote -v 2>/dev/null', {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    // Parse first origin line: "origin\thttps://github.com/owner/repo.git (fetch)"
    const originLine = output.split('\n').find(l => l.startsWith('origin'));
    if (!originLine) return null;

    const urlMatch = originLine.match(/\s+(https?:\/\/[^\s]+|git@[^:]+:[^\s]+)/);
    if (!urlMatch) return null;

    return _normalizeGitUrl(urlMatch[1]);
  } catch {
    return null;
  }
}

/** Try reading .git/config directly (faster, no subprocess) */
function _tryGitConfig(cwd: string): string | null {
  try {
    const gitConfig = join(cwd, '.git', 'config');
    if (!existsSync(gitConfig)) return null;

    const content = readFileSync(gitConfig, 'utf-8');
    const remoteMatch = content.match(/\[remote "origin"\]\s*\n\s*url\s*=\s*(.+)/i);
    if (!remoteMatch) return null;

    return _normalizeGitUrl(remoteMatch[1].trim());
  } catch {
    return null;
  }
}

/** Normalize various git URL formats to ghq-style: "host/owner/repo" */
function _normalizeGitUrl(url: string): string {
  let cleaned = url
    .replace(/\.git$/, '')
    .replace(/^git@/, '')
    .replace(/^https?:\/\//, '')
    .replace(/:([^/])/, '/$1');  // SSH colon → slash

  // Ensure it has exactly 3 segments: host/owner/repo
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }

  return cleaned;
}

/** Clear the project detection cache (e.g., when cwd changes) */
export function clearProjectCache(): void {
  _cachedProject = null;
  _cachedCwd = null;
}
