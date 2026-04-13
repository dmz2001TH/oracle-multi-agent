/**
 * Auto-detect process manager — picks tmux (Linux/Mac) or node-pty (Windows).
 */

import { execSync } from "child_process";
import type { ProcessManager } from "./index.js";
import { TmuxManager } from "./tmux-manager.js";
import { NodePtyManager } from "./nodepty-manager.js";

let cached: ProcessManager | null = null;

export function hasTmux(): boolean {
  try {
    const cmd = process.platform === "win32" ? "where tmux" : "which tmux";
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function createProcessManager(): ProcessManager {
  if (cached) return cached;

  if (hasTmux()) {
    console.log("[process] using tmux manager");
    cached = new TmuxManager();
  } else {
    console.log("[process] using node-pty manager (tmux not found)");
    cached = new NodePtyManager();
  }

  return cached;
}
