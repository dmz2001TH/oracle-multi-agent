/**
 * Project Detection — stub for oracle tools
 */

export function detectProject(cwd?: string): string | undefined {
  return cwd || process.cwd();
}
