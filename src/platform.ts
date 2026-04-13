/**
 * Cross-platform utilities — Windows/Linux/Mac compatible.
 *
 * Centralizes platform detection, quoting, and shell helpers
 * so individual commands don't need to care about the OS.
 */

import { execSync } from "node:child_process";
import { platform } from "node:os";

export const isWindows = platform() === "win32";
export const isMac = platform() === "darwin";
export const isLinux = platform() === "linux";

/**
 * Check if tmux is available on this system.
 */
export function hasTmux(): boolean {
  try {
    if (isWindows) return false; // tmux doesn't run natively on Windows
    execSync(isWindows ? "where tmux" : "which tmux", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the 'at' command is available (Unix scheduler).
 */
export function hasAtCommand(): boolean {
  if (isWindows) return false;
  try {
    execSync("which at", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Escape a shell argument safely for the current platform.
 * Windows cmd uses double quotes; Unix uses single quotes.
 */
export function shellQuote(s: string): string {
  if (isWindows) {
    // cmd.exe: wrap in double quotes, escape inner double quotes
    return `"${s.replace(/"/g, '""')}"`;
  }
  // Unix: wrap in single quotes, escape inner single quotes
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/**
 * Get the default shell for the current platform.
 */
export function defaultShell(): string {
  if (isWindows) return "powershell.exe";
  return process.env.SHELL || "bash";
}

/**
 * Null device path for redirecting output.
 */
export const devNull = isWindows ? "NUL" : "/dev/null";

/**
 * Safe execSync that works cross-platform.
 * Automatically uses the right quoting and null device.
 */
export function safeExec(cmd: string, opts?: { cwd?: string; encoding?: BufferEncoding }): string {
  try {
    return execSync(cmd, {
      cwd: opts?.cwd,
      encoding: opts?.encoding || "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10_000,
    } as any).trim();
  } catch {
    return "";
  }
}

/**
 * Run a tmux command safely. Returns empty string if tmux is not available.
 */
export function tmuxSafe(cmd: string): string {
  if (!hasTmux()) return "";
  return safeExec(`tmux ${cmd}`);
}
